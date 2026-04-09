import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getRulesContext } from "../lib/rulesEngine";
import { getCached, getStale, cacheKey, TTL, setCache } from "../lib/fplCache";
import { fetchFromFpl } from "../lib/fplRateLimiter";
import { VIBE_PROMPTS } from "../lib/vibes";

const router = Router();

const POSITION_MAP: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };

interface FPLPlayer {
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
}

interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
}

interface FPLEvent {
  id: number;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
  deadline_time: string;
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

interface FPLPick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

interface FPLPicksResponse {
  entry_history: {
    event: number;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
  };
  picks: FPLPick[];
}

interface FPLTransfer {
  element_in: number;
  element_in_cost: number;
  element_out: number;
  event: number;
}

interface FPLHistory {
  current: Array<{
    event: number;
    event_transfers: number;
  }>;
  chips: Array<{
    name: string;
    event: number;
  }>;
}

interface BootstrapData {
  elements: FPLPlayer[];
  teams: FPLTeam[];
  events: FPLEvent[];
}

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

function calculateSellingPrice(purchasePrice: number, currentPrice: number): number {
  if (currentPrice <= purchasePrice) return currentPrice;
  const rise = currentPrice - purchasePrice;
  const profit = Math.floor((rise * 10) / 2) / 10;
  return purchasePrice + profit;
}

function calculateFreeTransfers(history: FPLHistory, currentGw: number): number {
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

function getChipsRemaining(history: FPLHistory, currentGw: number): string[] {
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

async function fetchCachedData<T>(key: string, path: string, ttl: number): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) return cached.data;

  try {
    const data = await fetchFromFpl<T>(path);
    setCache(key, data, ttl);
    return data;
  } catch (error) {
    const stale = getStale<T>(key);
    if (stale) {
      console.warn(`[transfer] Serving stale cache for ${key} after FPL API failure`);
      return stale.data;
    }
    throw error;
  }
}

function preFilterCandidates(
  allPlayers: FPLPlayer[],
  squadIds: Set<number>,
  maxAffordable: number,
  fixtures: FPLFixture[],
  currentGw: number,
  teams: FPLTeam[],
): Array<{
  player: FPLPlayer;
  team: FPLTeam;
  upcomingFdr: number[];
  score: number;
}> {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const upcomingGws = [currentGw, currentGw + 1, currentGw + 2];

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

  const eligible = allPlayers.filter((p) => {
    if (squadIds.has(p.id)) return false;
    if (p.status === "u" || p.status === "i" || p.status === "s" || p.status === "n") return false;
    if (p.chance_of_playing_next_round === 0) return false;
    if (p.now_cost / 10 > maxAffordable) return false;
    if (p.minutes < 90) return false;
    return true;
  });

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

  return result;
}

router.post("/transfer-advice", async (req: Request, res: Response) => {
  try {
    const { manager_id, vibe } = req.body;

    if (!manager_id || !vibe) {
      res.status(400).json({ error: "Missing manager_id or vibe" });
      return;
    }

    const vibePrompt = VIBE_PROMPTS[vibe];
    if (!vibePrompt) {
      res.status(400).json({ error: "Invalid vibe" });
      return;
    }

    const managerId = String(manager_id);

    const bootstrap = await fetchCachedData<BootstrapData>(
      cacheKey("bootstrap-static"),
      "/bootstrap-static/",
      TTL.STATIC,
    );

    const currentEvent = bootstrap.events.find((e) => e.is_current);
    const nextEvent = bootstrap.events.find((e) => e.is_next);
    const activeEvent = nextEvent ?? currentEvent;
    if (!activeEvent) {
      res.status(503).json({ error: "No active gameweek found" });
      return;
    }
    const currentGw = activeEvent.id;
    const deadline = activeEvent.deadline_time;

    const picksGw = currentEvent && !currentEvent.finished ? currentEvent.id : (currentGw > 1 ? currentGw - 1 : 1);

    const [fixtures, picksData, transferHistory, historyData] = await Promise.all([
      fetchCachedData<FPLFixture[]>(cacheKey("fixtures"), "/fixtures/", TTL.STATIC),
      fetchCachedData<FPLPicksResponse>(
        cacheKey("picks", managerId, String(picksGw)),
        `/entry/${managerId}/event/${picksGw}/picks/`,
        TTL.USER,
      ),
      fetchCachedData<FPLTransfer[]>(
        cacheKey("transfers", managerId),
        `/entry/${managerId}/transfers/`,
        TTL.USER,
      ),
      fetchCachedData<FPLHistory>(
        cacheKey("history", managerId),
        `/entry/${managerId}/history/`,
        TTL.USER,
      ),
    ]);

    const playerMap = new Map(bootstrap.elements.map((p) => [p.id, p]));
    const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));

    const squadIds = new Set(picksData.picks.map((p) => p.element));
    const bank = picksData.entry_history.bank / 10;

    const freeTransfers = calculateFreeTransfers(historyData, currentGw);
    const chipsRemaining = getChipsRemaining(historyData, currentGw);

    const squadWithDetails = picksData.picks.map((pick) => {
      const player = playerMap.get(pick.element);
      const team = player ? teamMap.get(player.team) : undefined;
      const purchaseCost = transferHistory.find((t) => t.element_in === pick.element)?.element_in_cost;
      const purchasePrice = purchaseCost ? purchaseCost / 10 : (player ? player.now_cost / 10 : 0);
      const currentPrice = player ? player.now_cost / 10 : 0;
      const sellingPrice = calculateSellingPrice(purchasePrice, currentPrice);

      const gwFixtures = fixtures.filter((f) => f.event === currentGw);
      const fixture = player ? gwFixtures.find((f) => f.team_h === player.team || f.team_a === player.team) : undefined;
      const isHome = fixture ? fixture.team_h === player?.team : false;
      const opponentId = fixture ? (isHome ? fixture.team_a : fixture.team_h) : undefined;
      const opponent = opponentId ? teamMap.get(opponentId) : undefined;
      const fdr = fixture ? (isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty) : 3;

      return {
        id: pick.element,
        name: player ? `${player.first_name} ${player.second_name}` : `Player ${pick.element}`,
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

    const candidates = preFilterCandidates(
      bootstrap.elements,
      squadIds,
      maxAffordable,
      fixtures,
      currentGw,
      bootstrap.teams,
    );

    const candidatesSummary = candidates.slice(0, 50).map((c) => {
      const pos = POSITION_MAP[c.player.element_type] ?? "UNK";
      return `- ${c.player.first_name} ${c.player.second_name} (${pos}, ${c.team.short_name}) | Price: £${(c.player.now_cost / 10).toFixed(1)}m | Form: ${c.player.form} | Total: ${c.player.total_points} | Own: ${c.player.selected_by_percent}% | Status: ${c.player.status} | FDR: ${c.upcomingFdr.join(",")}`;
    }).join("\n");

    const squadSummary = squadWithDetails.map((p) =>
      `- ${p.name} (${p.position}, ${p.team}) | Price: £${p.price.toFixed(1)}m | Sell: £${p.sellingPrice.toFixed(1)}m | Form: ${p.form} | Pts: ${p.totalPoints} | Own: ${p.ownershipPct}% | vs ${p.opponent} | FDR: ${p.fdr} | Status: ${p.status}${p.isBench ? " [BENCH]" : ""}`
    ).join("\n");

    const rulesContext = getRulesContext(currentGw);

    const transferInstructions = `You are generating transfer recommendations for this FPL manager. Analyse their squad, upcoming fixtures, budget, and available free transfers. Return 3 to 5 transfer options. Each option must specify: one player to sell (from their squad) and one player to buy (from the available pool), the net cost or profit of the trade, whether it uses a free transfer or costs a 4-point hit, the expected points impact over the next 3 gameweeks, a confidence level (one of: BANKER, CALCULATED_RISK, BOLD_PUNT), one sentence of upside, one sentence of risk, and a persona-voiced case.

VALIDATION RULES:
- The buy player's price must not exceed the user's budget (£${bank.toFixed(1)}m) plus the sell player's selling price
- The transfer must not result in 4+ players from the same club (R1.03)
- Maintain position counts: 2 GK, 5 DEF, 5 MID, 3 FWD (R1.04)
- If the user has 0 free transfers, every suggestion costs a 4-point hit
- Do not recommend buying injured players (chance_of_playing = 0)
- Factor in sell price formula: user keeps 50% of price rises, rounded down (R3.06)
- If holding the transfer makes sense, include a "hold" option

If it makes sense to HOLD the transfer, include that as one of the options. 'Do nothing' is valid advice.

Exactly one recommendation should have is_superscout_pick: true.
Mark hold recommendations with is_hold_recommendation: true (player_out and player_in should be null for holds).

You MUST respond with valid JSON only — no markdown, no backticks, no preamble.

JSON structure:
{
  "gameweek": ${currentGw},
  "free_transfers": ${freeTransfers},
  "budget_remaining": ${bank.toFixed(1)},
  "recommendations": [
    {
      "player_out": "Name or null",
      "player_out_team": "Team or null",
      "player_out_selling_price": 10.2,
      "player_in": "Name or null",
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
}`;

    const context = `GAMEWEEK: ${currentGw}
DEADLINE: ${deadline}
FREE TRANSFERS: ${freeTransfers}
BUDGET IN BANK: £${bank.toFixed(1)}m
CHIPS REMAINING: ${chipsRemaining.length > 0 ? chipsRemaining.join(", ") : "none"}

YOUR SQUAD (15 players):
${squadSummary}

TOP TRANSFER TARGETS (pre-filtered by form, fixtures, value):
${candidatesSummary}

${transferInstructions}`;

    const systemPrompt = [
      vibePrompt,
      rulesContext,
      `IMPORTANT: You MUST respond with valid JSON only. No markdown, no backticks, no preamble.`,
      `CRITICAL PERSONA REQUIREMENT: Write the "case" field in your assigned persona voice.`,
    ].filter(Boolean).join("\n\n");

    const client = getClient();
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: context }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response format" });
      return;
    }

    const parsed = extractJSON(block.text) as {
      gameweek?: number;
      free_transfers?: number;
      budget_remaining?: number;
      recommendations?: Array<Record<string, unknown>>;
    } | null;

    if (!parsed || !parsed.recommendations) {
      req.log.error({ rawText: block.text.substring(0, 500) }, "Failed to parse transfer AI JSON");
      res.status(500).json({ error: "Could not parse AI response" });
      return;
    }

    const validated = parsed.recommendations.filter((rec) => {
      if (rec.is_hold_recommendation) return true;

      const playerInName = String(rec.player_in ?? "");
      const playerOutName = String(rec.player_out ?? "");

      const playerOut = squadWithDetails.find(
        (p) => p.name.toLowerCase() === playerOutName.toLowerCase()
      );
      if (!playerOut && playerOutName) {
        req.log.warn({ playerOutName }, "Transfer validation: player_out not in squad");
        return false;
      }

      const playerIn = bootstrap.elements.find(
        (p) => `${p.first_name} ${p.second_name}`.toLowerCase() === playerInName.toLowerCase()
          || p.web_name?.toLowerCase() === playerInName.toLowerCase()
      );
      if (!playerIn && playerInName) {
        req.log.warn({ playerInName }, "Transfer validation: player_in not found");
        return false;
      }

      if (playerIn && (playerIn.status === "u" || playerIn.status === "i" || playerIn.status === "s" || playerIn.chance_of_playing_next_round === 0)) {
        req.log.warn({ playerInName }, "Transfer validation: player_in unavailable");
        return false;
      }

      if (playerOut && playerIn) {
        const cost = (playerIn.now_cost / 10) - playerOut.sellingPrice;
        if (cost > bank + 0.1) {
          req.log.warn({ playerInName, cost, bank }, "Transfer validation: cannot afford");
          return false;
        }

        const playerInTeamId = playerIn.team;
        const currentClubCount = squadWithDetails.filter(
          (p) => p.teamId === playerInTeamId && p.id !== playerOut.id
        ).length;
        if (currentClubCount >= 3) {
          req.log.warn({ playerInName, playerInTeamId, currentClubCount }, "Transfer validation: club limit");
          return false;
        }
      }

      return true;
    });

    res.json({
      gameweek: parsed.gameweek ?? currentGw,
      free_transfers: parsed.free_transfers ?? freeTransfers,
      budget_remaining: parsed.budget_remaining ?? bank,
      recommendations: validated,
    });
  } catch (error) {
    req.log.error({ err: error }, "Transfer advice generation failed");
    res.status(500).json({ error: "Failed to generate transfer advice" });
  }
});

export default router;
