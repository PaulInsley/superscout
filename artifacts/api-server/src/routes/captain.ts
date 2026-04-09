import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getRulesContext, loadRules } from "../lib/rulesEngine";
import { VIBE_PROMPTS } from "../lib/vibes";

loadRules("fpl");

const router = Router();

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
    // try to find JSON object by matching balanced braces
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
          // keep looking
        }
      }
    }
  }

  return null;
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

    const client = getClient();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: context }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response format" });
      return;
    }

    const rawText = block.text;
    req.log.info({ rawLength: rawText.length }, "AI response received");

    const parsed = extractJSON(rawText);
    if (!parsed) {
      req.log.error({ rawText: rawText.substring(0, 500) }, "Failed to parse AI JSON");
      res.status(500).json({ error: "Could not parse AI response" });
      return;
    }

    res.json(parsed);
  } catch (error) {
    req.log.error({ err: error }, "Captain picks generation failed");
    res.status(500).json({ error: "Failed to generate captain picks" });
  }
});

export default router;
