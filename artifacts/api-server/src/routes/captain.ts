import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getRulesContext, loadRules } from "../lib/rulesEngine";
import { getCached, getStale, cacheKey, TTL, setCache } from "../lib/fplCache";
import { fetchFromFpl } from "../lib/fplRateLimiter";
import { VIBE_PROMPTS } from "../lib/vibes";
import {
  checkCaptainHallucinations,
  ANTI_HALLUCINATION_PROMPT_SUFFIX,
} from "../services/validation/hallucination-check";

loadRules("fpl");

const router = Router();

interface BootstrapData {
  elements: Array<{
    id: number;
    first_name: string;
    second_name: string;
    web_name: string;
    now_cost: number;
    team: number;
    element_type: number;
    status: string;
    chance_of_playing_next_round: number | null;
  }>;
  teams: Array<{ id: number; name: string; short_name: string }>;
  events: Array<{ id: number; is_current: boolean; is_next: boolean; finished: boolean; deadline_time: string }>;
}

interface FPLFixture {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  started: boolean;
  finished: boolean;
}

function getClient(): Anthropic {
  return new Anthropic({
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  });
}

function extractJSON(text: string): unknown | null {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
  }

  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          return JSON.parse(cleaned.substring(start, i + 1));
        } catch {
        }
      }
    }
  }

  return null;
}

async function fetchCachedData<T>(key: string, path: string, ttl: number): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) return cached.data;
  try {
    const data = await fetchFromFpl<T>(path);
    setCache(key, data, ttl);
    return data;
  } catch (error) {
    const stale = getStale<T>(key);
    if (stale) return stale.data;
    throw error;
  }
}

async function generateCaptainPicks(
  vibe: string,
  context: string,
  systemPrompt: string,
): Promise<{ parsed: Record<string, unknown> | null; rawText: string }> {
  const client = getClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: context }],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    return { parsed: null, rawText: "" };
  }

  const parsed = extractJSON(block.text) as Record<string, unknown> | null;
  return { parsed, rawText: block.text };
}

router.post("/captain-picks", async (req: Request, res: Response) => {
  try {
    const { vibe, context } = req.body;

    if (!vibe || !context) {
      res.status(400).json({ error: "Missing vibe or context" });
      return;
    }

    const vibePrompt = VIBE_PROMPTS[vibe];
    if (!vibePrompt) {
      res.status(400).json({ error: "Invalid vibe" });
      return;
    }

    const gwMatch = context.match(/GAMEWEEK:\s*(\d+)/i);
    const gameweek = gwMatch ? parseInt(gwMatch[1], 10) : undefined;
    const rulesContext = getRulesContext(gameweek);

    const systemPrompt = [
      vibePrompt,
      rulesContext,
      `IMPORTANT: You MUST respond with valid JSON only. No markdown, no backticks, no preamble. Follow the EXACT JSON structure specified in the user message — use the exact field names provided (player_name, team, opponent, expected_points, confidence, ownership_pct, upside, risk, case, is_superscout_pick). Do not add extra fields or rename fields.`,
      `CRITICAL PERSONA REQUIREMENT: You MUST write the "case" field in your assigned persona voice. The Expert is calm and analytical — no emojis, no exclamation marks, references data. The Critic is sharp and sarcastic — dry wit, rhetorical questions, no emojis. The Fanboy uses CAPITALS for emphasis, slang like BRO and DUDE, 1-2 emojis (🔥🚀🚨), and extreme hype. If the case text could have been written by any of the three personas, you have failed the task.`,
    ].filter(Boolean).join("\n\n");

    let bootstrap: BootstrapData | null = null;
    let fixtures: FPLFixture[] | null = null;
    try {
      [bootstrap, fixtures] = await Promise.all([
        fetchCachedData<BootstrapData>(cacheKey("bootstrap-static"), "/bootstrap-static/", TTL.STATIC),
        fetchCachedData<FPLFixture[]>(cacheKey("fixtures"), "/fixtures/", TTL.STATIC),
      ]);
    } catch {
      req.log.warn("Could not fetch FPL data for hallucination check — skipping");
    }

    const { parsed, rawText } = await generateCaptainPicks(vibe, context, systemPrompt);

    req.log.info({ rawLength: rawText.length }, "AI response received");

    if (!parsed) {
      req.log.error({ rawText: rawText.substring(0, 500) }, "Failed to parse AI JSON");
      res.status(500).json({ error: "Could not parse AI response" });
      return;
    }

    const recs = parsed.recommendations as Array<Record<string, unknown>> | undefined;

    if (recs && bootstrap && fixtures && gameweek) {
      const hallucinationCtx = {
        players: bootstrap.elements,
        teams: bootstrap.teams,
        fixtures,
        gameweek,
        logger: req.log,
      };

      const { filtered, result } = checkCaptainHallucinations(recs, hallucinationCtx);

      if (result.removedCount > 0 || result.correctedCount > 0) {
        req.log.info(
          { removed: result.removedCount, corrected: result.correctedCount, warnings: result.warnings },
          "Hallucination check completed",
        );
      }

      if (result.flaggedStats.length > 0) {
        req.log.info({ flaggedStats: result.flaggedStats }, "Stat claims flagged for review");
      }

      parsed.recommendations = filtered;

      if (filtered.length < 2) {
        req.log.warn({ remaining: filtered.length }, "Too few recs after hallucination check — retrying");

        const retryPrompt = systemPrompt + ANTI_HALLUCINATION_PROMPT_SUFFIX;
        const { parsed: retryParsed } = await generateCaptainPicks(vibe, context, retryPrompt);

        if (retryParsed) {
          const retryRecs = retryParsed.recommendations as Array<Record<string, unknown>> | undefined;
          if (retryRecs) {
            const { filtered: retryFiltered, result: retryResult } = checkCaptainHallucinations(
              retryRecs,
              hallucinationCtx,
            );
            req.log.info(
              { removed: retryResult.removedCount, corrected: retryResult.correctedCount, remaining: retryFiltered.length },
              "Retry hallucination check completed",
            );
            if (retryFiltered.length > filtered.length) {
              parsed.recommendations = retryFiltered;
            }
          }
        }
      }
    }

    res.json(parsed);
  } catch (error) {
    req.log.error({ err: error }, "Captain picks generation failed");
    res.status(500).json({ error: "Failed to generate captain picks" });
  }
});

export default router;
