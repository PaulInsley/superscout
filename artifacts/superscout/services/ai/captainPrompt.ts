export const CAPTAIN_PICKER_INSTRUCTION = `
You are generating captain recommendations for this FPL manager. Analyse their squad and upcoming fixtures. Return exactly 3 captain options. For each option provide: the player name, their team, the opponent and whether it is home or away, an expected points estimate (your best estimate based on form, fixtures, and historical data), a confidence level (one of: BANKER, CALCULATED_RISK, or BOLD_PUNT), the player's ownership percentage, one clear upside sentence, one clear risk sentence, a vibe-voiced one-liner making the case for this pick (this is where your personality shines — make it memorable), and whether this is the SuperScout Pick (exactly one option must be true).

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
      "is_superscout_pick": true|false
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
`.trim();
