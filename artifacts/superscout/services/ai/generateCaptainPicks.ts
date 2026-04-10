import type { CaptainCandidate, CaptainPicksResponse } from "@/services/fpl/types";
import { CAPTAIN_PICKER_INSTRUCTION } from "./captainPrompt";
import { VIBE_PROMPTS } from "@/config/vibes/vibePrompts";

function buildCaptainContext(
  candidates: CaptainCandidate[],
  gameweek: number,
  deadlineTime: string,
  vibe: string,
): string {
  const squadSummary = candidates
    .map(
      (c) =>
        `- ${c.name} (${c.position}, ${c.team}) | Form: ${c.form} | Total Pts: ${c.totalPoints} | Ownership: ${c.ownershipPct}% | Price: £${c.price}m | vs ${c.opponent} | FDR: ${c.fixtureDifficulty} | Status: ${c.status}${c.chanceOfPlaying !== null && c.chanceOfPlaying < 100 ? ` (${c.chanceOfPlaying}% chance)` : ""}`,
    )
    .join("\n");

  return `
GAMEWEEK: ${gameweek}
DEADLINE: ${deadlineTime}
VIBE: ${vibe}

SQUAD (15 players with upcoming fixtures):
${squadSummary}

${CAPTAIN_PICKER_INSTRUCTION}
`.trim();
}

function parseAIResponse(text: string): CaptainPicksResponse {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  return JSON.parse(cleaned);
}

export async function generateCaptainPicks(
  candidates: CaptainCandidate[],
  gameweek: number,
  deadlineTime: string,
  vibe: "expert" | "critic" | "fanboy",
  apiBaseUrl: string,
): Promise<CaptainPicksResponse> {
  const vibePrompt = VIBE_PROMPTS[vibe];
  if (!vibePrompt) {
    throw new Error(`Unknown vibe: ${vibe}`);
  }

  const context = buildCaptainContext(candidates, gameweek, deadlineTime, vibe);

  const requestBody = {
    vibe,
    context,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/captain-picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data as CaptainPicksResponse;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[CaptainPicks] Attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError ?? new Error("Failed to generate captain picks");
}
