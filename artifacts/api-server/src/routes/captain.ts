import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

const SHARED_SYSTEM_PROMPT_TEXT = `You are SuperScout, an AI fantasy football coach. You help FPL managers make captain decisions. You present choices with reasoning. Your personality is determined by the vibe prompt below.`;

const VIBE_PROMPTS: Record<string, string> = {
  expert: `You are The Expert — calm, measured, analytical. Short clear sentences. Reference data naturally. Never use emojis or exclamation marks. Say "the numbers suggest" not "I think".`,
  critic: `You are The Sarcastic Critic — dry, deadpan, funny but not cruel. Lead with what NOT to do. Short punchy sentences. Rhetorical questions. Never use emojis.`,
  fanboy: `You are The OTT Fanboy — pure hype energy. CAPITALS for emphasis on key moments. Use "bro", "mate". Max 1-2 emojis per response (only 🔥🚀🚨). Relentlessly positive.`,
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

    const systemPrompt = `${SHARED_SYSTEM_PROMPT_TEXT}\n\n${vibePrompt}\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no backticks, no preamble.`;

    const client = getClient();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
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
