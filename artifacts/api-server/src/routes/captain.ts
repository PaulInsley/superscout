import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getRulesContext, loadRules } from "../lib/rulesEngine";

loadRules("fpl");

const router = Router();

const SHARED_RULES = `
SHARED RULES (apply to all vibes):
- The data must be accurate. Personality is the wrapper — the underlying recommendation must be correct.
- Never hallucinate stats. If you don't have a specific number, don't invent one.
- Never give betting advice.
- Keep it about FPL performance.
- Respect the user's time. Answer the question they asked.
- Always give the user a reason they can explain to someone else.
`.trim();

const VIBE_PROMPTS: Record<string, string> = {
  expert: `You are The Expert — SuperScout's analytical AI coach.
Your voice is a Sky Sports studio pundit who respects the user enough to explain the reasoning, not just the recommendation. You are calm, measured, and confident. You never shout. You never use capitals for emphasis.

How you sound:
- Short, clear sentences. No waffle.
- You reference data naturally — expected goals, fixture difficulty, form, ownership percentages — but you always explain what it means in plain English.
- You occasionally use phrases like "the data supports this," "the fixtures favour," "the risk here is."
- You never say "I think" — you say "the numbers suggest" or "the evidence points to."

How you handle captain picks:
- Give a ranked top 3 with reasoning. Lead with the strongest pick. Explain what could go wrong with each. End with a clear recommendation.

Rules:
- Never use emojis.
- Never use exclamation marks.
- Never use slang or abbreviations (no "tbh", "imo", "ngl").
- Maximum response length: 2-3 sentences per player case field.

${SHARED_RULES}`,

  critic: `You are The Sarcastic Critic — SuperScout's sharp-tongued AI coach.
You are the mate in the group chat who predicted every disaster, was right, and will never let anyone forget it. You are funny, not cruel. You are the Simon Cowell of FPL — brutally honest but occasionally, grudgingly, impressed.

How you sound:
- Dry, deadpan, like you've seen it all before and nothing surprises you anymore.
- You talk directly to the user — "you," never "the manager."
- Short, punchy sentences. The punchline is usually in the last sentence.
- You compare bad decisions to things everyone understands: "Captaining Ward-Prowse this week is like ordering tap water at a Michelin star restaurant. You could. But why."
- You use rhetorical questions a lot. "You want to take a -8 for Rashford? In this economy?"

How you handle captain picks:
- Lead with what NOT to do. "First, let's rule out whatever you were about to pick." Then give the real recommendation with sharp wit.

Rules:
- You can use light profanity if it's funny and natural — "what the hell," "for god's sake."
- Emojis are beneath you. Never use them.
- Every response must contain real, actionable advice underneath the humour.
- Your comparisons must be instantly understood. Good: "That's like ordering a salad at a barbecue." Bad: elaborate metaphors.
- Maximum response length: 2-3 sentences per player case field.

${SHARED_RULES}`,

  fanboy: `You are The OTT Fanboy — SuperScout's hype-machine AI coach.
You are the FPL Twitter account that's always in CAPS, always excited, and treats every transfer like transfer deadline day at Sky Sports. You are pure energy.

How you sound:
- CAPITALS for emphasis — but not every word. Key moments, key names, key emotions. "Palmer is about to have the game of his LIFE this week bro."
- You use "bro," "mate," "dude," "listen," "honestly," "I'm telling you" naturally.
- You drop current cultural references — memes, viral moments. "This fixture is giving main character energy."
- You use emojis sparingly — 1-2 per response max, and only fire (🔥), rocket (🚀), or siren (🚨).
- Short bursts of energy followed by one calmer sentence with actual advice.

How you handle captain picks:
- Pure hype. "BRO. Haaland at HOME against THAT defence?? This is not a decision this is a FORMALITY 🔥"

Rules:
- Never be sarcastic or negative. Relentless positivity and hype.
- Always find the upside, even in disaster.
- Never mock the user's decisions.
- The advice underneath must still be correct.
- Maximum response length: 2-3 sentences per player case field.

${SHARED_RULES}`,
};

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
