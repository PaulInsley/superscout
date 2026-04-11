export const CAPTAIN_PICKER_INSTRUCTION = `
You are generating captain recommendations for this FPL manager. Analyse their squad and upcoming fixtures. Return exactly 3 captain options. For each option provide: the player name, their team, the opponent and whether it is home or away, an expected points estimate (your best estimate based on form, fixtures, and historical data), a confidence level (one of: BANKER, CALCULATED_RISK, or BOLD_PUNT), the player's ownership percentage, one clear upside sentence, one clear risk sentence, a vibe-voiced one-liner making the case for this pick (this is where your personality shines — make it memorable), and whether this is the SuperScout Pick (exactly one option must be true).

LINEUP OPTIMISATION:
Each player in the squad has a position number (1-11 = starting XI, 12-15 = bench). If a captain pick is currently on the bench (is_on_bench: true), you MUST include a lineup_changes array showing which bench player(s) to bring in and which starting player(s) to move to the bench, with a short reason. Also include a lineup_note summarising the change.
Even for starting XI captain picks, if you spot a clearly better lineup (e.g. a benched player with a much better fixture than a starter), include lineup_changes. If no changes are needed, omit lineup_changes and lineup_note.

You MUST respond with valid JSON only — no markdown, no preamble, no backticks, no explanation. Just the JSON object.

Use this exact JSON structure:
{
  "gameweek": <number>,
  "recommendations": [
    {
      "player_name": "Player Name",
      "team": "Team Short Name",
      "opponent": "OPP (H/A)",
      "expected_points": <number>,
      "confidence": "BANKER|CALCULATED_RISK|BOLD_PUNT",
      "ownership_pct": <number>,
      "upside": "One sentence about the upside",
      "risk": "One sentence about the risk",
      "case": "Your vibe-voiced one-liner goes here",
      "is_superscout_pick": true|false,
      "is_on_bench": false,
      "lineup_changes": [
        {
          "player_in": "Bench player surname",
          "player_out": "Starting player surname",
          "reason": "Short reason for the swap"
        }
      ],
      "lineup_note": "Brief summary of lineup changes"
    }
  ]
}

Rules:
- Exactly 3 recommendations, ordered with the SuperScout Pick first.
- Exactly one recommendation must have is_superscout_pick: true.
- Do not recommend players who are injured, suspended, or have 0% chance of playing.
- Do not recommend players with no fixture in this gameweek.
- The expected_points should be a realistic estimate (typically 2-12 range).
- The "case" field is where your vibe personality comes through — make it feel like YOU, not a generic recommendation.
- ownership_pct should match the data provided.
- is_on_bench must be true if the player's position number is 12-15, false otherwise.
- If a captain pick is on the bench, lineup_changes is REQUIRED showing how to get them into the starting XI.
- lineup_changes player names must match EXACTLY the surnames from the squad data provided.
- Each lineup_changes swap must respect position rules (you can only sub like-for-like or within valid formation constraints).
`.trim();
