import Anthropic from "@anthropic-ai/sdk";
import { SHARED_SYSTEM_PROMPT } from "./sharedSystemPrompt";
import { EXPERT_PROMPT } from "./expertPrompt";
import { CRITIC_PROMPT } from "./criticPrompt";
import { FANBOY_PROMPT } from "./fanBoyPrompt";

const personaPrompts: Record<string, string> = {
  expert: EXPERT_PROMPT,
  critic: CRITIC_PROMPT,
  fanboy: FANBOY_PROMPT,
};

function getClient(): Anthropic {
  return new Anthropic({
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  });
}

export async function generateRecommendation(
  persona: "expert" | "critic" | "fanboy",
  context: string,
): Promise<string> {
  const personaPrompt = personaPrompts[persona];
  if (!personaPrompt) {
    throw new Error(
      `Unknown persona: ${persona}. Must be one of: expert, critic, fanboy`,
    );
  }

  const systemPrompt = `${SHARED_SYSTEM_PROMPT}\n\n---\n\n${personaPrompt}`;

  const client = getClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: context,
      },
    ],
  });

  const block = message.content[0];
  if (block.type === "text") {
    return block.text;
  }

  throw new Error("Unexpected response format from Claude API");
}
