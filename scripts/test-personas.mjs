import Anthropic from "@anthropic-ai/sdk";
import { SHARED_SYSTEM_PROMPT } from "../artifacts/superscout/services/sharedSystemPrompt.ts";
import { VIBE_PROMPTS } from "../artifacts/superscout/config/vibes/vibePrompts.ts";

const client = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
});

const testContext = "GW18 captain pick, options are Haaland, Palmer, and Salah. Pro tier user. This is the first time using SuperScout so no Manager Profile exists yet. Intelligence Engine Level 1 (FPL API only).";

async function testPersona(persona) {
  const vibe = VIBE_PROMPTS[persona];
  const systemPrompt = `${SHARED_SYSTEM_PROMPT}\n\n---\n\n${vibe.systemPrompt}`;

  console.log(`\n${"=".repeat(80)}`);
  console.log(`  THE ${persona.toUpperCase()}`);
  console.log(`${"=".repeat(80)}\n`);

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: testContext }],
  });

  const block = message.content[0];
  if (block.type === "text") {
    console.log(block.text);
  }

  console.log(`\n[Tokens: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out]`);
}

console.log("[SuperScout] Testing all three vibes with context:");
console.log(`"${testContext}"\n`);

await testPersona("expert");
await testPersona("critic");
await testPersona("fanboy");

console.log(`\n${"=".repeat(80)}`);
console.log("[SuperScout] All three vibe tests complete.");
