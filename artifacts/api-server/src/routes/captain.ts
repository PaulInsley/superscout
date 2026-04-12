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
import { analyseGameweek } from "../lib/gameweekAnalysis";
import { getSupabase } from "../lib/supabase";
import { extractTransferOutPlayers, buildTransferContextPrompt } from "../lib/crossCheck";

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
    news: string;
    news_added: string | null;
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
    timeout: 30000,
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
    max_tokens: 2500,
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

const STALE_KEYWORDS = /injured|knock|doubt|ruled out|suspended|illness|not in squad/i;

function checkCaptainStaleness(
  cachedResponse: Record<string, unknown>,
  players: BootstrapData["elements"],
  generatedAt: string,
  logger: Request["log"],
): { stale: boolean; reason?: string } {
  const recs = cachedResponse.recommendations as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(recs)) return { stale: false };

  const playerMap = new Map(players.map((p) => [p.web_name.toLowerCase(), p]));
  const generatedTime = new Date(generatedAt).getTime();

  for (const rec of recs) {
    const name = rec.player_name ? String(rec.player_name) : null;
    if (!name) continue;

    const player = playerMap.get(name.toLowerCase());
    if (!player) continue;

    if (player.status === "i" || player.status === "s" || player.status === "u") {
      return { stale: true, reason: `${name}: status changed to '${player.status}'` };
    }

    if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round <= 25) {
      return { stale: true, reason: `${name}: chance_of_playing dropped to ${player.chance_of_playing_next_round}%` };
    }

    if (player.news && player.news_added) {
      const newsTime = new Date(player.news_added).getTime();
      if (newsTime > generatedTime && STALE_KEYWORDS.test(player.news)) {
        return { stale: true, reason: `${name}: news updated after cache — "${player.news}"` };
      }
    }
  }

  return { stale: false };
}

router.post("/captain-picks", async (req: Request, res: Response) => {
  try {
    const { vibe, context, user_id: clientUserId, skip_cache: skipCache } = req.body;

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

    if (skipCache) {
      req.log.info("skip_cache=true — bypassing pre-generated cache for captain picks");
    }

    if (!skipCache && clientUserId && gameweek && bootstrap) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const cacheTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));

          const cacheCheck = (async () => {
            const { data: rows } = await supabase
              .from("pre_generated_recommendations")
              .select("id, response_json, generated_at")
              .eq("user_id", clientUserId)
              .eq("gameweek", gameweek)
              .eq("decision_type", "captain")
              .eq("vibe", vibe)
              .gt("expires_at", new Date().toISOString())
              .order("generated_at", { ascending: false })
              .limit(1);

            return rows?.[0] ?? null;
          })();

          const cached = await Promise.race([cacheCheck, cacheTimeout]);

          if (cached) {
            const responseJson = cached.response_json as Record<string, unknown>;
            const staleness = checkCaptainStaleness(responseJson, bootstrap.elements, cached.generated_at, req.log);

            if (staleness.stale) {
              req.log.info({ reason: staleness.reason }, "Cache discarded — stale data detected");
            } else {
              req.log.info({ cacheId: cached.id, gameweek }, "Serving cached captain picks");
              res.json({ ...responseJson, source: "cached" });
              return;
            }
          } else {
            req.log.info("No cached captain picks found — using live generation");
          }
        } catch (cacheErr) {
          req.log.warn({ err: cacheErr }, "Cache lookup failed — falling through to live generation");
        }
      }
    }

    let transferContextPrompt = "";
    if (clientUserId && gameweek) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data: transferRows } = await supabase
            .from("pre_generated_recommendations")
            .select("response_json")
            .eq("user_id", clientUserId)
            .eq("gameweek", gameweek)
            .eq("decision_type", "transfer")
            .eq("vibe", vibe)
            .gt("expires_at", new Date().toISOString())
            .order("generated_at", { ascending: false })
            .limit(1);

          if (transferRows?.[0]) {
            const outPlayers = extractTransferOutPlayers(transferRows[0].response_json as Record<string, unknown>);
            if (outPlayers.length > 0) {
              transferContextPrompt = buildTransferContextPrompt(outPlayers);
              req.log.info({ outPlayers }, "Transfer cross-check: excluding OUT players from captain picks");
            }
          }
        } catch (err) {
          req.log.warn({ err }, "Transfer cross-check lookup failed — generating without transfer context");
        }
      }
    }

    let gwAnalysisPrompt = "";
    if (bootstrap && fixtures && gameweek) {
      const gwAnalysis = analyseGameweek(gameweek, fixtures, bootstrap.teams);
      if (gwAnalysis.promptContext) {
        gwAnalysisPrompt = gwAnalysis.promptContext;
        req.log.info({ gwType: gwAnalysis.type, blankCount: gwAnalysis.blankTeams.length, doubleCount: gwAnalysis.doubleTeams.length }, "Gameweek analysis");
      }
    }

    const chipMatch = context.match(/ACTIVE_CHIP:\s*(\w+)/i);
    const activeChip = chipMatch ? chipMatch[1].toLowerCase() : null;
    let chipPrompt = "";
    if (activeChip === "3xc") {
      chipPrompt = "TRIPLE CAPTAIN ACTIVE: The manager has activated the Triple Captain chip. The captain will earn TRIPLE points this gameweek instead of double. This makes captain selection even more critical — prioritise safety and high-floor picks. Emphasise the magnified impact in your recommendations.";
    } else if (activeChip === "bboost") {
      chipPrompt = "BENCH BOOST ACTIVE: The manager has activated Bench Boost. All bench players will score points this gameweek. Consider this when making captain recommendations — bench players earning points means the captain differential is relatively less impactful, but still choose the highest-ceiling option.";
    } else if (activeChip === "wildcard") {
      chipPrompt = "WILDCARD ACTIVE: The manager has activated their Wildcard chip and can change their entire squad. Captain recommendations should reflect the squad they end up with — focus on the best available captain options from the full player pool, not just their current squad.";
    } else if (activeChip === "freehit") {
      chipPrompt = "FREE HIT ACTIVE: The manager has activated their Free Hit chip — they can pick any squad for this single gameweek. Captain recommendations should consider ALL available players since the squad will revert next week. Prioritise the absolute best captain pick regardless of current squad composition.";
    }

    const ownershipPrompt = `OWNERSHIP CONTEXT RULE:
For each captain option, include an "ownership_context" field. This is a single short sentence (max 20 words) telling the user what the ownership percentage means for their rank if they captain this player.
Guidelines by ownership band:
- 50%+: NOT captaining this player is the risk. Most of the field benefits if he hauls.
- 30-49%: Popular pick. A haul helps you but helps many others too. Protects rank, doesn't gain ground.
- 10-29%: Differential territory. A haul gains ground on most managers.
- 3-9%: Strong differential. Very few managers benefit if he delivers.
- Below 3%: Extreme differential. Almost nobody benefits but you.
NEVER imply low ownership is automatically better. If a differential pick has 3+ fewer expected points than the top option, acknowledge the trade-off. If expected points are below 4, gently discourage regardless of ownership. Write in the active vibe voice. If ownership data is unavailable, omit the field.`;

    const systemPrompt = [
      vibePrompt,
      rulesContext,
      gwAnalysisPrompt,
      chipPrompt,
      transferContextPrompt,
      ownershipPrompt,
      `IMPORTANT: You MUST respond with valid JSON only. No markdown, no backticks, no preamble. Follow the EXACT JSON structure specified in the user message — use the exact field names provided (player_name, team, opponent, expected_points, confidence, ownership_pct, ownership_context, upside, risk, case, is_superscout_pick, is_on_bench, lineup_changes, lineup_note). Do not rename fields.`,
      `LINEUP OPTIMISATION: Each player has a position number (1-11 starting XI, 12-15 bench). If a captain pick is on the bench set is_on_bench: true and include lineup_changes showing which bench player to start and which starter to bench, with a reason. For starting XI picks, include lineup_changes only if there is a clearly better lineup. If no changes needed, omit lineup_changes and lineup_note.`,
      `CRITICAL PERSONA REQUIREMENT: You MUST write the "case" field in your assigned persona voice. The Expert is calm and analytical — no emojis, no exclamation marks, references data. The Critic is sharp and sarcastic — dry wit, rhetorical questions, no emojis. The Fanboy uses CAPITALS for emphasis, slang like BRO and DUDE, 1-2 emojis (🔥🚀🚨), and extreme hype. If the case text could have been written by any of the three personas, you have failed the task.`,
    ].filter(Boolean).join("\n\n");

    const { parsed, rawText } = await generateCaptainPicks(vibe, context, systemPrompt);

    req.log.info({ rawLength: rawText.length }, "AI response received");

    if (!parsed) {
      req.log.error({ rawText: rawText.substring(0, 500) }, "Failed to parse AI JSON");
      res.status(500).json({ error: "Could not parse AI response" });
      return;
    }

    const recs = parsed.recommendations as Array<Record<string, unknown>> | undefined;

    if (recs && bootstrap && fixtures && gameweek) {
      const squadNameMatches = context.match(/^- (.+?) \(/gm) ?? [];
      const squadPlayerNames = new Set(squadNameMatches.map((m: string) => m.replace(/^- /, "").replace(/ \($/, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").trim()));

      const hallucinationCtx = {
        players: bootstrap.elements,
        teams: bootstrap.teams,
        fixtures,
        gameweek,
        squadPlayerNames: squadPlayerNames.size > 0 ? squadPlayerNames : undefined,
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

    res.json({ ...parsed, source: "live" });
  } catch (error: any) {
    if (error?.status === 408 || error?.code === "ETIMEDOUT" || error?.message?.includes("timed out") || error?.message?.includes("timeout")) {
      req.log.warn({ err: error }, "Claude API timeout during captain picks");
      res.status(504).json({ error: "SuperScout is taking longer than usual — please try again in a moment." });
    } else {
      req.log.error({ err: error }, "Captain picks generation failed");
      res.status(500).json({ error: "Failed to generate captain picks" });
    }
  }
});

export default router;
