import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getRulesContext } from "../lib/rulesEngine";
import { getCached, getStale, cacheKey, TTL, setCache } from "../lib/fplCache";
import { fetchFromFpl } from "../lib/fplRateLimiter";
import { VIBE_PROMPTS } from "../lib/vibes";
import { getSupabase } from "../lib/supabase";
import {
  checkCaptainHallucinations,
  checkTransferHallucinations,
} from "../services/validation/hallucination-check";
import { analyseGameweek } from "../lib/gameweekAnalysis";
import { extractTransferOutPlayers, buildTransferContextPrompt } from "../lib/crossCheck";

const router = Router();

const VIBES = ["expert", "critic", "fanboy"] as const;
const POSITION_MAP: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };

function getClient(): Anthropic {
  return new Anthropic({
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    timeout: 45000,
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
    // fallback
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface BootstrapData {
  elements: Array<{
    id: number;
    first_name: string;
    second_name: string;
    web_name: string;
    now_cost: number;
    form: string;
    team: number;
    element_type: number;
    total_points: number;
    selected_by_percent: string;
    status: string;
    chance_of_playing_next_round: number | null;
    cost_change_start: number;
    transfers_in_event: number;
    transfers_out_event: number;
    points_per_game: string;
    minutes: number;
  }>;
  teams: Array<{ id: number; name: string; short_name: string }>;
  events: Array<{
    id: number;
    is_current: boolean;
    is_next: boolean;
    finished: boolean;
    deadline_time: string;
  }>;
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

function calculateSellingPrice(purchasePrice: number, currentPrice: number): number {
  if (currentPrice <= purchasePrice) return currentPrice;
  const rise = currentPrice - purchasePrice;
  const profit = Math.floor((rise * 10) / 2) / 10;
  return purchasePrice + profit;
}

function calculateFreeTransfers(history: { current: Array<{ event: number; event_transfers: number }>; chips: Array<{ name: string; event: number }> }, currentGw: number): number {
  if (!history.current || history.current.length === 0) return 1;
  let freeTransfers = 1;
  const sorted = [...history.current].sort((a, b) => a.event - b.event);
  for (const gw of sorted) {
    const used = gw.event_transfers;
    const wasWildcard = history.chips.some(
      (c) => c.event === gw.event && (c.name === "wildcard" || c.name === "freehit")
    );
    if (wasWildcard) {
      freeTransfers = 1;
    } else {
      freeTransfers = Math.min(freeTransfers - used + 1, 5);
      if (freeTransfers < 1) freeTransfers = 1;
    }
    if (gw.event === 15) {
      freeTransfers = 5;
    }
  }
  return freeTransfers;
}

function getChipsRemaining(history: { current: Array<{ event: number }>; chips: Array<{ name: string; event: number }> }, currentGw: number): string[] {
  const allChips = ["wildcard", "freehit", "3xc", "bboost"];
  const firstHalfChips = allChips.map((c) => `${c}_1`);
  const secondHalfChips = allChips.map((c) => `${c}_2`);
  const usedChips = new Set(history.chips.map((c) => {
    const isFirstHalf = c.event <= 19;
    return `${c.name}_${isFirstHalf ? 1 : 2}`;
  }));
  const remaining: string[] = [];
  const chipSet = currentGw <= 19 ? firstHalfChips : secondHalfChips;
  for (const chip of chipSet) {
    if (!usedChips.has(chip)) {
      remaining.push(chip.replace(/_\d$/, ""));
    }
  }
  return remaining;
}

async function generateCaptainPicks(
  managerId: string,
  gameweek: number,
  deadline: string,
  vibe: string,
  bootstrap: BootstrapData,
  fixtures: FPLFixture[],
  transferOutPlayers: string[] = [],
): Promise<unknown | null> {
  const playerMap = new Map(bootstrap.elements.map((p) => [p.id, p]));
  const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const gwFixtures = fixtures.filter((f) => f.event === gameweek);

  let picksData: { picks: Array<{ element: number; position: number; multiplier: number }> } | null = null;
  const gwsToTry = [gameweek, gameweek - 1];
  for (const gw of gwsToTry) {
    try {
      picksData = await fetchCachedData(
        cacheKey("picks", managerId, String(gw)),
        `/entry/${managerId}/event/${gw}/picks/`,
        TTL.USER,
      );
      break;
    } catch {
      // try next
    }
  }
  if (!picksData) return null;

  const candidates = picksData.picks.map((pick) => {
    const player = playerMap.get(pick.element);
    if (!player) return null;
    const team = teamMap.get(player.team);
    const fixture = gwFixtures.find((f) => f.team_h === player.team || f.team_a === player.team);
    if (!fixture) return null;
    const isHome = fixture.team_h === player.team;
    const opponentId = isHome ? fixture.team_a : fixture.team_h;
    const opponentTeam = teamMap.get(opponentId);
    const fdr = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;
    return {
      name: player.web_name,
      position: POSITION_MAP[player.element_type] ?? "UNK",
      team: team?.short_name ?? "UNK",
      form: player.form,
      totalPoints: player.total_points,
      ownershipPct: parseFloat(player.selected_by_percent) || 0,
      price: player.now_cost / 10,
      opponent: `${opponentTeam?.short_name ?? "UNK"} (${isHome ? "H" : "A"})`,
      fixtureDifficulty: fdr,
      status: player.status,
      chanceOfPlaying: player.chance_of_playing_next_round,
      pickPosition: pick.position,
      isBench: pick.position >= 12,
    };
  }).filter(Boolean);

  if (candidates.length === 0) return null;

  const squadSummary = candidates.map((c: any) =>
    `- ${c.name} (${c.position}, ${c.team}) | Pos: ${c.pickPosition}${c.isBench ? " [BENCH]" : ""} | Form: ${c.form} | Total Pts: ${c.totalPoints} | Ownership: ${c.ownershipPct}% | Price: £${c.price}m | vs ${c.opponent} | FDR: ${c.fixtureDifficulty} | Status: ${c.status}${c.chanceOfPlaying !== null && c.chanceOfPlaying < 100 ? ` (${c.chanceOfPlaying}% chance)` : ""}`
  ).join("\n");

  const context = `GAMEWEEK: ${gameweek}
DEADLINE: ${deadline}
VIBE: ${vibe}

SQUAD (15 players — positions 1-11 = starting XI, 12-15 = bench):
${squadSummary}

You are generating captain recommendations for this FPL manager. Analyse their squad and upcoming fixtures. Return exactly 3 captain options. For each option provide: the player name, their team, the opponent and whether it is home or away, an expected points estimate (your best estimate based on form, fixtures, and historical data), a confidence level (one of: BANKER, CALCULATED_RISK, or BOLD_PUNT), the player's ownership percentage, one clear upside sentence, one clear risk sentence, a persona-voiced one-liner making the case for this pick (this is where your personality shines — make it memorable), and whether this is the SuperScout Pick (exactly one option must be true).

LINEUP OPTIMISATION:
- Set is_on_bench to true if the captain pick is currently on the bench (position 12-15), false otherwise.
- If a captain pick is on the bench, you MUST include a lineup_changes array showing which bench player to bring in and which starting player to bench, plus a lineup_note summarising the change.
- Even for starting XI captains, if you spot a clearly better lineup (e.g. a benched player with much better fixture than a starter of the same position), include lineup_changes.
- If no lineup changes are needed, omit lineup_changes and lineup_note entirely.
- lineup_changes player names must use the EXACT names from the squad data above.

Confidence levels explained:
- BANKER — the safe, obvious pick. The one you'd tell your nan to captain.
- CALCULATED_RISK — good data supports it but not guaranteed. A smart pick with some variance.
- BOLD_PUNT — high ceiling, real chance it blanks. The pick you make when chasing a gap.

You MUST respond with valid JSON only — no markdown, no preamble, no backticks, no explanation. Just the JSON object.

Use this exact JSON structure:
{
  "gameweek": ${gameweek},
  "recommendations": [
    {
      "player_name": "Player Name",
      "team": "Team Short Name",
      "opponent": "OPP (H/A)",
      "expected_points": <number>,
      "confidence": "BANKER|CALCULATED_RISK|BOLD_PUNT",
      "ownership_pct": <number>,
      "ownership_context": "One short persona-voiced sentence about what this ownership means for rank",
      "upside": "One sentence about the upside",
      "risk": "One sentence about the risk",
      "case": "Your persona-voiced one-liner goes here",
      "is_superscout_pick": true|false,
      "is_on_bench": false,
      "lineup_changes": [
        {
          "player_in": "Bench player name",
          "player_out": "Starting player name",
          "reason": "Short reason"
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
- The "case" field is where your vibe personality comes through.
- ownership_pct should match the data provided.
- is_on_bench must be true if the player's position number is 12-15.
- If a captain pick is on the bench, lineup_changes is REQUIRED.
- lineup_changes player names must match EXACTLY the names from the squad data.

OWNERSHIP CONTEXT RULE:
For each captain option, include an "ownership_context" field. This is a single short sentence (max 20 words) telling the user what the ownership percentage means for their rank if they captain this player.
Guidelines by ownership band:
- 50%+: NOT captaining this player is the risk. Most of the field benefits if he hauls.
- 30-49%: Popular pick. A haul helps you but helps many others too. Protects rank, doesn't gain ground.
- 10-29%: Differential territory. A haul gains ground on most managers.
- 3-9%: Strong differential. Very few managers benefit if he delivers.
- Below 3%: Extreme differential. Almost nobody benefits but you.
NEVER imply low ownership is automatically better. If a differential pick has 3+ fewer expected points than the top option, acknowledge the trade-off. If expected points are below 4, gently discourage regardless of ownership. Write in the active vibe voice. If ownership data is unavailable, omit the field.`;

  const vibePrompt = VIBE_PROMPTS[vibe];
  const rulesContext = getRulesContext(gameweek);

  const gwAnalysis = analyseGameweek(gameweek, fixtures, bootstrap.teams);

  const transferContext = transferOutPlayers.length > 0 ? buildTransferContextPrompt(transferOutPlayers) : "";

  const systemPrompt = [
    vibePrompt,
    rulesContext,
    gwAnalysis.promptContext,
    transferContext,
    `IMPORTANT: You MUST respond with valid JSON only. No markdown, no backticks, no preamble. Follow the EXACT JSON structure specified in the user message — use the exact field names provided including ownership_context.`,
    `CRITICAL PERSONA REQUIREMENT: You MUST write the "case" field in your assigned persona voice. The Expert is calm and analytical — no emojis, no exclamation marks, references data. The Critic is sharp and sarcastic — dry wit, rhetorical questions, no emojis. The Fanboy uses CAPITALS for emphasis, slang like BRO and DUDE, 1-2 emojis (🔥🚀🚨), and extreme hype.`,
  ].filter(Boolean).join("\n\n");

  const client = getClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: "user", content: context }],
  });

  const block = message.content[0];
  if (block.type !== "text") return null;

  const parsed = extractJSON(block.text) as Record<string, unknown> | null;
  if (!parsed) return null;

  const recs = parsed.recommendations as Array<Record<string, unknown>> | undefined;
  if (recs) {
    const squadNames = new Set(candidates.filter(Boolean).map((c: any) => (c.name as string).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").trim()));
    const halCtx = { players: bootstrap.elements, teams: bootstrap.teams, fixtures, gameweek, squadPlayerNames: squadNames.size > 0 ? squadNames : undefined };
    const { filtered } = checkCaptainHallucinations(recs, halCtx);
    parsed.recommendations = filtered;
  }

  if (gwAnalysis.type !== "normal") {
    (parsed as any).gw_type = gwAnalysis.type;
    (parsed as any).blank_teams = gwAnalysis.blankTeams.map((t) => t.short_name);
    (parsed as any).double_teams = gwAnalysis.doubleTeams.map((t) => t.short_name);
  }

  return parsed;
}

function splitIntoSegments(text: string): string[] {
  const segments: string[] = [];
  const raw = text.split(/(?<=[.!?])\s+|(?<=[.!?])(?=")|(?<=\.)\s*(?=[A-Z])/);
  for (const seg of raw) {
    const sub = seg.split(/\s*(?:—|--)\s*/);
    for (const s of sub) {
      const trimmed = s.trim();
      if (trimmed.length > 0) segments.push(trimmed);
    }
  }
  return segments;
}

function sanitiseTransferCommentary(
  recs: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const allCardNames = recs.map((r) => {
    const names = new Set<string>();
    if (r.is_hold_recommendation) return names;
    if (r.is_package && Array.isArray(r.transfers)) {
      for (const t of r.transfers as Array<Record<string, string>>) {
        if (t.player_out) names.add(t.player_out);
        if (t.player_in) names.add(t.player_in);
      }
    } else {
      if (r.player_out) names.add(String(r.player_out));
      if (r.player_in) names.add(String(r.player_in));
    }
    return names;
  });

  return recs.map((rec, idx) => {
    if (rec.is_hold_recommendation) return rec;
    const ownNames = allCardNames[idx];
    const foreignNames = new Set<string>();
    for (let i = 0; i < allCardNames.length; i++) {
      if (i === idx) continue;
      for (const name of allCardNames[i]) {
        if (!ownNames.has(name)) foreignNames.add(name);
      }
    }
    if (foreignNames.size === 0) return rec;

    const patternParts = [...foreignNames]
      .sort((a, b) => b.length - a.length)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const foreignPattern = new RegExp(`\\b(${patternParts.join("|")})\\b`, "i");

    let changed = false;
    const cleaned = { ...rec };
    for (const field of ["upside", "risk", "case"] as const) {
      const text = rec[field];
      if (typeof text !== "string" || !foreignPattern.test(text)) continue;

      const segments = splitIntoSegments(text);
      const crossRefPhrases = /\b(both of these|all of these|these two|these three|this pairs with|this combines with|together these|the other move|the other transfer)\b/i;
      const isForeign = segments.map((s) => foreignPattern.test(s) || crossRefPhrases.test(s));
      for (let si = 1; si < segments.length; si++) {
        if (isForeign[si - 1] && !isForeign[si] && /^(he|she|they|his|her|their|that|it)\b/i.test(segments[si])) {
          isForeign[si] = true;
        }
      }
      const kept = segments.filter((_, si) => !isForeign[si]);

      if (kept.length < segments.length) {
        const joined = kept.map((s) => {
          let seg = s.trim();
          if (seg && !seg.match(/[.!?'"]$/)) seg += ".";
          return seg;
        });
        let result = joined.join(" ").replace(/\.{2,}/g, ".").replace(/\s{2,}/g, " ").trim();

        result = result.replace(/^(?:And |But |Also |Plus |Meanwhile )/i, "");

        if (field === "case" && result) {
          result = result.replace(/^["'"]+/, "").replace(/["'"]+$/, "").trim();
          result = `"${result}"`;
        }

        cleaned[field] = result || segments[0];
        changed = true;
      }
    }
    return changed ? cleaned : rec;
  });
}

async function generateTransferAdvice(
  managerId: string,
  gameweek: number,
  deadline: string,
  vibe: string,
  bootstrap: BootstrapData,
  fixtures: FPLFixture[],
): Promise<unknown | null> {
  const playerMap = new Map(bootstrap.elements.map((p) => [p.id, p]));
  const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));

  let picksData: { entry_history: { bank: number }; picks: Array<{ element: number; position: number; multiplier: number; is_captain: boolean; is_vice_captain: boolean }> } | null = null;
  const currentEvent = bootstrap.events.find((e) => e.is_current);
  const picksGw = currentEvent && !currentEvent.finished ? currentEvent.id : (gameweek > 1 ? gameweek - 1 : 1);
  const gwsToTry = [picksGw];
  if (picksGw > 1) gwsToTry.push(picksGw - 1);

  for (const gw of gwsToTry) {
    try {
      picksData = await fetchCachedData(
        cacheKey("picks", managerId, String(gw)),
        `/entry/${managerId}/event/${gw}/picks/`,
        TTL.USER,
      );
      break;
    } catch {
      // try next
    }
  }
  if (!picksData) return null;

  const [transferHistory, historyData] = await Promise.all([
    fetchCachedData<Array<{ element_in: number; element_in_cost: number; element_out: number; event: number }>>(
      cacheKey("transfers", managerId),
      `/entry/${managerId}/transfers/`,
      TTL.USER,
    ),
    fetchCachedData<{ current: Array<{ event: number; event_transfers: number }>; chips: Array<{ name: string; event: number }> }>(
      cacheKey("history", managerId),
      `/entry/${managerId}/history/`,
      TTL.USER,
    ),
  ]);

  const squadIds = new Set(picksData.picks.map((p) => p.element));
  const bank = picksData.entry_history.bank / 10;
  const freeTransfers = calculateFreeTransfers(historyData, gameweek);
  const chipsRemaining = getChipsRemaining(historyData, gameweek);

  const squadWithDetails = picksData.picks.map((pick) => {
    const player = playerMap.get(pick.element);
    const team = player ? teamMap.get(player.team) : undefined;
    const purchaseCost = transferHistory.find((t) => t.element_in === pick.element)?.element_in_cost;
    const purchasePrice = purchaseCost ? purchaseCost / 10 : (player ? player.now_cost / 10 : 0);
    const currentPrice = player ? player.now_cost / 10 : 0;
    const sellingPrice = calculateSellingPrice(purchasePrice, currentPrice);
    const gwFixtures = fixtures.filter((f) => f.event === gameweek);
    const fixture = player ? gwFixtures.find((f) => f.team_h === player.team || f.team_a === player.team) : undefined;
    const isHome = fixture ? fixture.team_h === player?.team : false;
    const opponentId = fixture ? (isHome ? fixture.team_a : fixture.team_h) : undefined;
    const opponent = opponentId ? teamMap.get(opponentId) : undefined;
    const fdr = fixture ? (isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty) : 3;
    return {
      id: pick.element,
      name: player?.web_name ?? `Player ${pick.element}`,
      position: player ? POSITION_MAP[player.element_type] ?? "UNK" : "UNK",
      team: team?.short_name ?? "UNK",
      teamId: player?.team ?? 0,
      price: currentPrice,
      sellingPrice,
      form: player?.form ?? "0.0",
      totalPoints: player?.total_points ?? 0,
      ownershipPct: player ? parseFloat(player.selected_by_percent) || 0 : 0,
      status: player?.status ?? "a",
      chanceOfPlaying: player?.chance_of_playing_next_round ?? null,
      opponent: opponent ? `${opponent.short_name} (${isHome ? "H" : "A"})` : "TBD",
      fdr,
      isBench: pick.position >= 12,
    };
  });

  const highestSellingByPos: Record<string, number> = {};
  for (const p of squadWithDetails) {
    const current = highestSellingByPos[p.position] ?? 0;
    if (p.sellingPrice > current) highestSellingByPos[p.position] = p.sellingPrice;
  }
  const maxAffordable = bank + Math.max(...Object.values(highestSellingByPos), 0);

  const eligible = bootstrap.elements.filter((p) => {
    if (squadIds.has(p.id)) return false;
    if (p.status === "u" || p.status === "i" || p.status === "s" || p.status === "n") return false;
    if (p.chance_of_playing_next_round === 0) return false;
    if (p.now_cost / 10 > maxAffordable) return false;
    if (p.minutes < 90) return false;
    return true;
  });

  const upcomingGws = [gameweek, gameweek + 1, gameweek + 2];
  const teamFixtures = new Map<number, FPLFixture[]>();
  for (const f of fixtures) {
    if (f.event && upcomingGws.includes(f.event)) {
      const hArr = teamFixtures.get(f.team_h) ?? [];
      hArr.push(f);
      teamFixtures.set(f.team_h, hArr);
      const aArr = teamFixtures.get(f.team_a) ?? [];
      aArr.push(f);
      teamFixtures.set(f.team_a, aArr);
    }
  }

  const scored = eligible.map((p) => {
    const team = teamMap.get(p.team);
    const fxts = teamFixtures.get(p.team) ?? [];
    const fdrs = fxts.map((f) => {
      const isHome = f.team_h === p.team;
      return isHome ? f.team_h_difficulty : f.team_a_difficulty;
    });
    const avgFdr = fdrs.length > 0 ? fdrs.reduce((a, b) => a + b, 0) / fdrs.length : 3;
    const formScore = parseFloat(p.form) || 0;
    const ppm = p.total_points / (p.now_cost / 10);
    const fdrInverted = 6 - avgFdr;
    const score = formScore * 2 + fdrInverted * 1.5 + ppm * 0.5;
    return { player: p, team: team!, upcomingFdr: fdrs, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const result: typeof scored = [];
  const positionCounts: Record<string, number> = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const item of scored) {
    const pos = POSITION_MAP[item.player.element_type] ?? "UNK";
    result.push(item);
    positionCounts[pos] = (positionCounts[pos] ?? 0) + 1;
    if (result.length >= 50) break;
  }
  for (const pos of ["GKP", "DEF", "MID", "FWD"]) {
    if ((positionCounts[pos] ?? 0) < 5) {
      const needed = 5 - (positionCounts[pos] ?? 0);
      const posType = Object.entries(POSITION_MAP).find(([, v]) => v === pos)?.[0];
      if (!posType) continue;
      const extras = scored.filter(
        (s) => s.player.element_type === parseInt(posType) && !result.includes(s)
      ).slice(0, needed);
      result.push(...extras);
    }
  }

  const diverseCandidates: typeof result = [];
  const byPos: Record<number, typeof result> = { 1: [], 2: [], 3: [], 4: [] };
  for (const c of result) byPos[c.player.element_type]?.push(c);
  const minPerPos = 4;
  for (const posPlayers of Object.values(byPos)) {
    diverseCandidates.push(...posPlayers.slice(0, minPerPos));
  }
  for (const c of result) {
    if (diverseCandidates.length >= 30) break;
    if (!diverseCandidates.includes(c)) diverseCandidates.push(c);
  }

  const candidatesSummary = diverseCandidates.slice(0, 30).map((c) => {
    const pos = POSITION_MAP[c.player.element_type] ?? "UNK";
    return `- ${c.player.web_name} (${pos}, ${c.team.short_name}) £${(c.player.now_cost / 10).toFixed(1)}m | Form: ${c.player.form} | Pts: ${c.player.total_points} | Own: ${c.player.selected_by_percent}% | FDR: ${c.upcomingFdr.join(",")}`;
  }).join("\n");

  const squadSummary = squadWithDetails.map((p) =>
    `- ${p.name} (${p.position}, ${p.team}) | Price: £${p.price.toFixed(1)}m | Sell: £${p.sellingPrice.toFixed(1)}m | Form: ${p.form} | Pts: ${p.totalPoints} | Own: ${p.ownershipPct}% | vs ${p.opponent} | FDR: ${p.fdr} | Status: ${p.status}${p.isBench ? " [BENCH]" : ""}`
  ).join("\n");

  const rulesContext = getRulesContext(gameweek);
  const activeChip = historyData.chips.find((c) => c.event === gameweek);
  const isWildcardActive = activeChip?.name === "wildcard";
  const isFreeHitActive = activeChip?.name === "freehit";
  const isChipMode = isWildcardActive || isFreeHitActive;

  let modeInstructions: string;
  let recommendationCount: string;

  if (isChipMode) {
    modeInstructions = `MODE: FULL SQUAD OVERHAUL (${isWildcardActive ? "Wildcard" : "Free Hit"} available)
The manager has a ${isWildcardActive ? "Wildcard" : "Free Hit"} chip available. Recommend comprehensive squad restructure packages.
Each recommendation should be a PACKAGE of 3-6 coordinated transfers that work together as a strategy.
Every package needs a creative package_name.
Show how the transfers combine for maximum impact. Budget constraint applies across ALL transfers in the package.
Each package MUST have a DIFFERENT strategic focus.`;
    recommendationCount = "Return exactly 3 to 4 restructure packages, each with a distinctly different strategy";
  } else if (freeTransfers >= 4) {
    modeInstructions = `MODE: RESTRUCTURE (${freeTransfers} free transfers banked)
The manager has ${freeTransfers} free transfers — this is a major restructure opportunity.
You MUST return ALL of the following:
1. PACKAGE A: A restructure package using 2-${Math.min(freeTransfers, 4)} free transfers.
2. PACKAGE B: A DIFFERENT restructure package using 2-${Math.min(freeTransfers, 4)} free transfers.
3. OPTIONAL PACKAGE C: If there's a third viable strategy, include it.
4. ONE best individual swap.
5. ONE hold option.
Each package needs a creative package_name.`;
    recommendationCount = "Return exactly 4 to 5 recommendations: 2-3 packages + 1 individual swap + 1 hold option";
  } else if (freeTransfers >= 2) {
    modeInstructions = `MODE: MIXED (${freeTransfers} free transfers available)
The manager has ${freeTransfers} free transfers. You MUST return ALL of the following:
1. ONE OR TWO multi-transfer packages.
2. ONE OR TWO individual swap options.
3. ONE hold option if holding transfers makes strategic sense.`;
    recommendationCount = "Return exactly 4 to 5 recommendations: 1-2 packages + 1-2 individual swaps + 1 hold option";
  } else {
    modeInstructions = `MODE: INDIVIDUAL SWAPS (${freeTransfers} free transfer${freeTransfers === 1 ? "" : "s"})
The manager has ${freeTransfers} free transfer${freeTransfers === 1 ? "" : "s"}. Recommend individual player swaps only.
If the user has 0 free transfers, every suggestion costs a 4-point hit.
Include 1 hold option if holding transfers makes strategic sense.`;
    recommendationCount = "Return 3 to 4 transfer options + 1 hold option";
  }

  const transferInstructions = `You are generating transfer recommendations for this FPL manager.

${modeInstructions}

${recommendationCount}.

VALIDATION RULES:
- The buy player's price must not exceed the user's budget (£${bank.toFixed(1)}m) plus the sell player's selling price
- The transfer must not result in 4+ players from the same club
- Maintain position counts: 2 GK, 5 DEF, 5 MID, 3 FWD
- Do not recommend buying injured players
- For packages: validate the ENTIRE package together
- ALWAYS include a hold option as the LAST recommendation with is_hold_recommendation: true

Exactly one recommendation should have is_superscout_pick: true.
For player_out and player_in, use the exact names as shown in the squad/candidate data above (e.g. "Cunha", "Salah", "B.Fernandes"). Do NOT use full legal names.

CRITICAL COMMENTARY RULE — ZERO CROSS-REFERENCES:
Each recommendation is displayed as an ISOLATED card. The user sees ONE card at a time with NO visibility of other cards.
Therefore: the "upside", "risk", and "case" fields for a recommendation must mention ONLY the player_out and player_in named in THAT card (or the players in that card's transfers array for packages).
DO NOT reference, compare, contrast, or allude to any player from ANY other recommendation.
Treat each recommendation as if it is the ONLY recommendation you are writing. No "both of these", no "this pairs with", no mentioning other transfers.

You MUST respond with valid JSON only — no markdown, no backticks, no preamble.

JSON structure:
{
  "gameweek": ${gameweek},
  "free_transfers": ${freeTransfers},
  "budget_remaining": ${bank.toFixed(1)},
  "recommendations": [
    {
      "is_package": false,
      "player_out": "Surname or null",
      "player_out_team": "Team or null",
      "player_out_selling_price": 10.2,
      "player_in": "Surname or null",
      "player_in_team": "Team or null",
      "player_in_price": 13.0,
      "net_cost": 2.8,
      "uses_free_transfer": true,
      "hit_cost": 0,
      "expected_points_gain_3gw": 4.5,
      "confidence": "BANKER|CALCULATED_RISK|BOLD_PUNT",
      "upside": "text",
      "risk": "text",
      "case": "persona text",
      "is_superscout_pick": false,
      "is_hold_recommendation": false
    }
  ]
}

${recommendationCount}. Returning fewer is a failure.`;

  const context = `GAMEWEEK: ${gameweek}
DEADLINE: ${deadline}
FREE TRANSFERS: ${freeTransfers}
BUDGET IN BANK: £${bank.toFixed(1)}m
CHIPS REMAINING: ${chipsRemaining.length > 0 ? chipsRemaining.join(", ") : "none"}

YOUR SQUAD (15 players):
${squadSummary}

TOP TRANSFER TARGETS (pre-filtered by form, fixtures, value):
${candidatesSummary}

${transferInstructions}`;

  const vibePrompt = VIBE_PROMPTS[vibe];

  const gwAnalysis = analyseGameweek(gameweek, fixtures, bootstrap.teams);

  const systemPrompt = [
    vibePrompt,
    rulesContext,
    gwAnalysis.promptContext,
    `IMPORTANT: You MUST respond with valid JSON only. No markdown, no backticks, no preamble.`,
    `CRITICAL PERSONA REQUIREMENT: Write the "case" field in your assigned persona voice.`,
  ].filter(Boolean).join("\n\n");

  const client = getClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: "user", content: context }],
  });

  const block = message.content[0];
  if (block.type !== "text") return null;

  const parsed = extractJSON(block.text) as Record<string, unknown> | null;
  if (!parsed) return null;

  const recs = parsed.recommendations as Array<Record<string, unknown>> | undefined;
  if (recs) {
    const halCtx = { players: bootstrap.elements, teams: bootstrap.teams, fixtures, gameweek };
    const { filtered } = checkTransferHallucinations(recs, halCtx);
    parsed.recommendations = sanitiseTransferCommentary(filtered);
  }

  if (gwAnalysis.type !== "normal") {
    (parsed as any).gw_type = gwAnalysis.type;
    (parsed as any).blank_teams = gwAnalysis.blankTeams.map((t) => t.short_name);
    (parsed as any).double_teams = gwAnalysis.doubleTeams.map((t) => t.short_name);
  }

  return parsed;
}

router.post("/pre-generate/:gameweek", async (req: Request, res: Response) => {
  try {
    const adminSecret = process.env.PROCESS_DECISIONS_SECRET;
    if (!adminSecret) {
      res.status(500).json({ error: "Server configuration error: admin secret not set. Contact the administrator." });
      return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const gw = parseInt(String(req.params.gameweek), 10);
    if (isNaN(gw) || gw < 1 || gw > 50) {
      res.status(400).json({ error: "Invalid gameweek" });
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const bootstrap = await fetchCachedData<BootstrapData>(
      cacheKey("bootstrap-static"),
      "/bootstrap-static/",
      TTL.STATIC,
    );

    const targetEvent = bootstrap.events.find((e) => e.id === gw);
    if (!targetEvent) {
      res.status(404).json({ error: "Gameweek not found" });
      return;
    }
    const deadline = targetEvent.deadline_time;

    const fixtures = await fetchCachedData<FPLFixture[]>(
      cacheKey("fixtures"),
      "/fixtures/",
      TTL.STATIC,
    );

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, fpl_manager_id")
      .not("fpl_manager_id", "is", null);

    if (usersError || !users) {
      res.status(500).json({ error: "Failed to fetch users", details: usersError?.message });
      return;
    }

    const usersWithFpl = users.filter((u) => u.fpl_manager_id);
    req.log.info({ userCount: usersWithFpl.length, gameweek: gw }, "Starting pre-generation");

    const results = {
      total_users: usersWithFpl.length,
      captain_generated: 0,
      captain_failed: 0,
      transfer_generated: 0,
      transfer_failed: 0,
      banter_generated: 0,
      banter_failed: 0,
      skipped: 0,
    };

    for (const user of usersWithFpl) {
      const managerId = user.fpl_manager_id;

      for (const vibe of VIBES) {
        let transferOutPlayers: string[] = [];

        try {
          const transferResult = await generateTransferAdvice(managerId, gw, deadline, vibe, bootstrap, fixtures);
          if (transferResult) {
            transferOutPlayers = extractTransferOutPlayers(transferResult as Record<string, unknown>);
            const { error: insertErr } = await supabase.from("pre_generated_recommendations").insert({
              user_id: user.id,
              gameweek: gw,
              season: "2026-27",
              decision_type: "transfer",
              vibe,
              response_json: transferResult,
              expires_at: deadline,
            });
            if (insertErr) {
              req.log.error({ err: insertErr, userId: user.id, vibe }, "Pre-gen transfer insert failed");
              results.transfer_failed++;
            } else {
              results.transfer_generated++;
            }
          } else {
            results.transfer_failed++;
          }
        } catch (err: any) {
          const isTimeout = err?.status === 408 || err?.code === "ETIMEDOUT" || err?.message?.includes("timed out") || err?.message?.includes("timeout");
          req.log.error({ err, userId: user.id, vibe, type: "transfer", isTimeout }, "Pre-gen transfer failed");
          results.transfer_failed++;
        }

        await delay(2000);

        try {
          req.log.info({ vibe, transferOutPlayers }, "Generating captain picks with transfer context");
          const captainResult = await generateCaptainPicks(managerId, gw, deadline, vibe, bootstrap, fixtures, transferOutPlayers);
          if (captainResult) {
            const { error: insertErr } = await supabase.from("pre_generated_recommendations").insert({
              user_id: user.id,
              gameweek: gw,
              season: "2026-27",
              decision_type: "captain",
              vibe,
              response_json: captainResult,
              expires_at: deadline,
            });
            if (insertErr) {
              req.log.error({ err: insertErr, userId: user.id, vibe }, "Pre-gen captain insert failed");
              results.captain_failed++;
            } else {
              results.captain_generated++;
            }
          } else {
            results.captain_failed++;
          }
        } catch (err: any) {
          const isTimeout = err?.status === 408 || err?.code === "ETIMEDOUT" || err?.message?.includes("timed out") || err?.message?.includes("timeout");
          req.log.error({ err, userId: user.id, vibe, type: "captain", isTimeout }, "Pre-gen captain failed");
          results.captain_failed++;
        }

        await delay(2000);
      }

      try {
        const { data: userLeagues } = await supabase
          .from("mini_league_context")
          .select("*")
          .eq("user_id", user.id)
          .eq("season", "2026-27");

        if (userLeagues && userLeagues.length > 0) {
          const { data: userPrefs } = await supabase
            .from("users")
            .select("default_persona")
            .eq("id", user.id)
            .single();

          const banterVibe = userPrefs?.default_persona ?? "expert";

          try {
            const banterUrl = `http://localhost:${process.env.PORT || 3001}/api/banter/${gw}?user_id=${user.id}&vibe=${banterVibe}`;
            const banterRes = await fetch(banterUrl);
            if (banterRes.ok) {
              const banterData = await banterRes.json();
              if (banterData.banter_cards && banterData.banter_cards.length > 0) {
                const { error: insertErr } = await supabase
                  .from("pre_generated_recommendations")
                  .insert({
                    user_id: user.id,
                    gameweek: gw,
                    season: "2026-27",
                    decision_type: "banter",
                    vibe: banterVibe,
                    response_json: banterData,
                    expires_at: deadline,
                  });
                if (insertErr) {
                  req.log.error({ err: insertErr, userId: user.id }, "Pre-gen banter insert failed");
                  results.banter_failed++;
                } else {
                  results.banter_generated++;
                }
              }
            } else {
              results.banter_failed++;
            }
          } catch (err) {
            req.log.error({ err, userId: user.id }, "Pre-gen banter failed");
            results.banter_failed++;
          }
          await delay(2000);
        }
      } catch (err) {
        req.log.error({ err, userId: user.id }, "Pre-gen banter league check failed");
      }
    }

    req.log.info(results, "Pre-generation complete");
    res.json({ success: true, gameweek: gw, ...results });
  } catch (error) {
    req.log.error({ err: error }, "Pre-generation pipeline failed");
    res.status(500).json({ error: "Pre-generation pipeline failed" });
  }
});

router.get("/pre-generated/:gameweek", async (req: Request, res: Response) => {
  try {
    let gw: number;
    const gwParam = String(req.params.gameweek);
    if (gwParam === "current") {
      try {
        const bootstrap = await fetchCachedData<BootstrapData>(
          cacheKey("bootstrap-static"),
          "/bootstrap-static/",
          TTL.STATIC,
        );
        const nextEvent = bootstrap.events.find((e) => e.is_next);
        const currentEvent = bootstrap.events.find((e) => e.is_current);
        gw = nextEvent?.id ?? currentEvent?.id ?? 1;
      } catch {
        res.json({ found: false });
        return;
      }
    } else {
      gw = parseInt(gwParam, 10);
    }
    const { user_id, decision_type, vibe } = req.query;

    if (isNaN(gw) || !user_id || !decision_type || !vibe) {
      res.status(400).json({ error: "Missing required parameters: user_id, decision_type, vibe" });
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { data, error } = await supabase
      .from("pre_generated_recommendations")
      .select("id, response_json, generated_at")
      .eq("user_id", user_id)
      .eq("gameweek", gw)
      .eq("decision_type", decision_type)
      .eq("vibe", vibe)
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      res.json({ found: false });
      return;
    }

    let bootstrap: BootstrapData | null = null;
    try {
      bootstrap = await fetchCachedData<BootstrapData>(
        cacheKey("bootstrap-static"),
        "/bootstrap-static/",
        TTL.STATIC,
      );
    } catch {}

    if (bootstrap) {
      const responseJson = data.response_json as Record<string, unknown>;
      const recs = responseJson.recommendations as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(recs)) {
        const playerMap = new Map(bootstrap.elements.map((p) => [p.web_name.toLowerCase(), p]));
        const nameField = String(decision_type) === "captain" ? "player_name" : "player_in";

        let stale = false;
        let staleReason = "";

        for (const rec of recs) {
          const names: string[] = [];
          const mainName = rec[nameField] ? String(rec[nameField]) : null;
          if (mainName) names.push(mainName);
          if (rec.is_package && Array.isArray(rec.transfers)) {
            for (const t of rec.transfers as Array<Record<string, unknown>>) {
              if (t.player_in) names.push(String(t.player_in));
            }
          }

          const generatedTime = new Date(data.generated_at).getTime();
          const staleKeywords = /injured|knock|doubt|ruled out|suspended|illness|not in squad/i;

          for (const name of names) {
            const player = playerMap.get(name.toLowerCase());
            if (!player) continue;
            if (player.status === "i" || player.status === "s" || player.status === "u") {
              stale = true;
              staleReason = `${name}: status '${player.status}'`;
              break;
            }
            if (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round <= 25) {
              stale = true;
              staleReason = `${name}: chance_of_playing ${player.chance_of_playing_next_round}%`;
              break;
            }
            if ((player as any).news && (player as any).news_added) {
              const newsTime = new Date((player as any).news_added).getTime();
              if (newsTime > generatedTime && staleKeywords.test((player as any).news)) {
                stale = true;
                staleReason = `${name}: news updated — "${(player as any).news}"`;
                break;
              }
            }
          }
          if (stale) break;
        }

        if (stale) {
          req.log.info({ reason: staleReason }, "Pre-gen cache discarded — stale data detected");
          supabase.from("pre_generated_recommendations").update({ used: true }).eq("id", data.id).then(() => {});
          res.json({ found: false });
          return;
        }
      }
    }

    res.json({ found: true, response: data.response_json, source: "cached", generated_at: data.generated_at });
  } catch (error) {
    req.log.error({ err: error }, "Pre-gen check failed");
    res.json({ found: false });
  }
});

export default router;
