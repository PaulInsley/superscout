export function extractTransferOutPlayers(responseJson: Record<string, unknown>): string[] {
  const recs = responseJson.recommendations as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(recs)) return [];

  const outPlayers: string[] = [];

  for (const rec of recs) {
    if (rec.is_hold_recommendation) continue;

    if (rec.is_package && Array.isArray(rec.transfers)) {
      for (const t of rec.transfers as Array<Record<string, unknown>>) {
        if (t.player_out && typeof t.player_out === "string") {
          outPlayers.push(t.player_out);
        }
      }
    } else if (rec.player_out && typeof rec.player_out === "string") {
      outPlayers.push(rec.player_out);
    }
  }

  return [...new Set(outPlayers)];
}

export function extractCaptainPicks(responseJson: Record<string, unknown>): Array<{ name: string; confidence: string }> {
  const recs = responseJson.recommendations as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(recs)) return [];

  return recs
    .filter((r) => r.player_name && typeof r.player_name === "string")
    .map((r) => ({
      name: r.player_name as string,
      confidence: (r.confidence as string) ?? "UNKNOWN",
    }));
}

export function buildTransferContextPrompt(outPlayers: string[]): string {
  if (outPlayers.length === 0) {
    return `TRANSFER CONTEXT:
The Transfer Advisor has recommended the following changes for this gameweek (same user, same vibe):
No transfers recommended (hold was the top pick).

RULE: Generate captain picks normally without transfer constraints.`;
  }

  return `TRANSFER CONTEXT:
The Transfer Advisor has recommended the following changes for this gameweek (same user, same vibe):
OUT: ${outPlayers.join(", ")}

CRITICAL RULES:
1. Do NOT recommend captaining any player who appears in the OUT list above. If the Transfer Advisor recommends selling a player, they should not be a captain option.
2. If the user's current captain is in the OUT list, acknowledge this explicitly in the SuperScout Pick commentary. For example: "The Transfer Advisor suggests moving [player] on this week — which means your captaincy needs to come from elsewhere."
3. If no transfer context is available (fallback scenario), generate captain picks normally without this constraint. Do not mention transfers.`;
}

export function buildCaptainContextPrompt(captainPicks: Array<{ name: string; confidence: string }>): string {
  if (captainPicks.length === 0) return "";

  const picksList = captainPicks
    .map((p) => `${p.name} (${p.confidence})`)
    .join(", ");

  return `CAPTAIN CONTEXT:
The Captain Picker has recommended the following players as captain options: ${picksList}

RULE: If a player appears as a strong captain option (BANKER or CALCULATED_RISK confidence), think carefully before recommending them as a transfer OUT. It's not forbidden — a player can be a good captain this week but worth selling for the longer term — but if you do recommend selling a captain option, explicitly acknowledge the tension in the commentary.`;
}
