import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getRulesContext } from "../lib/rulesEngine";
import { getCached, getStale, cacheKey, TTL, setCache, clearCache } from "../lib/fplCache";
import { fetchFromFpl } from "../lib/fplRateLimiter";
import { VIBE_PROMPTS } from "../lib/vibes";
import {
  checkTransferHallucinations,
  ANTI_HALLUCINATION_PROMPT_SUFFIX,
} from "../services/validation/hallucination-check";
import { analyseGameweek } from "../lib/gameweekAnalysis";
import { getSupabase } from "../lib/supabase";
import { getSupabaseForRequest } from "../lib/supabaseUser";
import { extractCaptainPicks, buildCaptainContextPrompt } from "../lib/crossCheck";
import { validateBody } from "../lib/validateRequest";
import { transferAdviceSchema } from "../schemas/transfer";

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
  news: string;
  news_added: string | null;
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
  element_out_cost: number;
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

function getClient(timeoutMs = 30000): Anthropic {
  return new Anthropic({
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    timeout: timeoutMs,
  });
}

function extractJSON(text: string): unknown | null {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    /* JSON parse fallback — try nested extraction */
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
        } catch (_) {
          /* keep scanning */
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
  const firstGw = sorted[0]?.event;

  for (const gw of sorted) {
    const used = gw.event_transfers;
    const wasWildcard = history.chips.some(
      (c) => c.event === gw.event && (c.name === "wildcard" || c.name === "freehit"),
    );

    if (gw.event === firstGw) {
      freeTransfers = 1;
    } else if (wasWildcard) {
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

  const usedChips = new Set(
    history.chips.map((c) => {
      const isFirstHalf = c.event <= 19;
      return `${c.name}_${isFirstHalf ? 1 : 2}`;
    }),
  );

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

  const currentGwFixtures = fixtures.filter((f) => f.event === currentGw);
  const teamsWithFixture = new Set<number>();
  for (const f of currentGwFixtures) {
    teamsWithFixture.add(f.team_h);
    teamsWithFixture.add(f.team_a);
  }

  const eligible = allPlayers.filter((p) => {
    if (squadIds.has(p.id)) return false;
    if (p.status === "u" || p.status === "i" || p.status === "s" || p.status === "n") return false;
    if (p.chance_of_playing_next_round === 0) return false;
    if (p.now_cost / 10 > maxAffordable) return false;
    if (p.minutes < 90) return false;
    if (!teamsWithFixture.has(p.team)) return false;
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
      const extras = scored
        .filter((s) => s.player.element_type === parseInt(posType) && !result.includes(s))
        .slice(0, needed);
      result.push(...extras);
    }
  }

  return result;
}

const STALE_KEYWORDS = /injured|knock|doubt|ruled out|suspended|illness|not in squad/i;

interface CachedResponse {
  recommendations?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

function checkStaleness(
  cachedResponse: CachedResponse,
  players: FPLPlayer[],
  generatedAt: string,
  logger: Request["log"],
  liveBank?: number,
  liveFreeTransfers?: number,
): { stale: boolean; reason?: string } {
  const cachedBank = cachedResponse.budget_remaining ?? cachedResponse.bank;
  if (liveBank !== undefined && typeof cachedBank === "number") {
    const bankDiff = Math.abs(cachedBank - liveBank);
    if (bankDiff > 0.1) {
      return { stale: true, reason: `Bank changed: cached £${cachedBank}m vs live £${liveBank}m` };
    }
  }
  const cachedFT = cachedResponse.free_transfers ?? cachedResponse.freeTransfers;
  if (liveFreeTransfers !== undefined && typeof cachedFT === "number") {
    if (cachedFT !== liveFreeTransfers) {
      return {
        stale: true,
        reason: `Free transfers changed: cached ${cachedFT} vs live ${liveFreeTransfers}`,
      };
    }
  }

  const recs = cachedResponse.recommendations;
  if (!Array.isArray(recs)) return { stale: false };

  const playerMap = new Map(players.map((p) => [p.web_name.toLowerCase(), p]));
  const generatedTime = new Date(generatedAt).getTime();

  for (const rec of recs) {
    const inNames: string[] = [];

    if (rec.player_in) inNames.push(String(rec.player_in));

    if (rec.is_package && Array.isArray(rec.transfers)) {
      for (const t of rec.transfers as Array<Record<string, unknown>>) {
        if (t.player_in) inNames.push(String(t.player_in));
      }
    }

    for (const name of inNames) {
      const player = playerMap.get(name.toLowerCase());
      if (!player) continue;

      if (player.status === "i" || player.status === "s" || player.status === "u") {
        return { stale: true, reason: `${name}: status changed to '${player.status}'` };
      }

      if (
        player.chance_of_playing_next_round !== null &&
        player.chance_of_playing_next_round <= 25
      ) {
        return {
          stale: true,
          reason: `${name}: chance_of_playing dropped to ${player.chance_of_playing_next_round}%`,
        };
      }

      if (player.news && player.news_added) {
        const newsTime = new Date(player.news_added).getTime();
        if (newsTime > generatedTime && STALE_KEYWORDS.test(player.news)) {
          return { stale: true, reason: `${name}: news updated after cache — "${player.news}"` };
        }
      }
    }
  }

  return { stale: false };
}

function getCardPlayerNames(rec: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  if (rec.is_hold_recommendation) return names;

  if (rec.is_package && Array.isArray(rec.transfers)) {
    for (const t of rec.transfers as Array<Record<string, string>>) {
      if (t.player_out) names.add(t.player_out);
      if (t.player_in) names.add(t.player_in);
    }
  } else {
    if (rec.player_out) names.add(String(rec.player_out));
    if (rec.player_in) names.add(String(rec.player_in));
  }
  return names;
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

function getCardOutPlayerNames(rec: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  if (rec.is_hold_recommendation) return names;
  if (rec.is_package && Array.isArray(rec.transfers)) {
    for (const t of rec.transfers as Array<Record<string, string>>) {
      if (t.player_out) names.add(t.player_out);
    }
  } else {
    if (rec.player_out) names.add(String(rec.player_out));
  }
  return names;
}

function sanitiseCommentary(
  recs: Array<Record<string, unknown>>,
  logger: Request["log"],
  allPlayerNames?: Set<string>,
): Array<Record<string, unknown>> {
  const allCardNames = recs.map((r) => getCardPlayerNames(r));

  return recs.map((rec, idx) => {
    if (rec.is_hold_recommendation) return rec;

    const ownNames = allCardNames[idx];
    const outNames = getCardOutPlayerNames(rec);
    const foreignNames = new Set<string>();
    for (const name of outNames) {
      foreignNames.add(name);
    }
    for (let i = 0; i < allCardNames.length; i++) {
      if (i === idx) continue;
      for (const name of allCardNames[i]) {
        if (!ownNames.has(name)) foreignNames.add(name);
      }
    }

    if (allPlayerNames) {
      const commentaryText = (["upside", "risk", "case"] as const)
        .map((f) => (typeof rec[f] === "string" ? rec[f] : ""))
        .join(" ");
      if (commentaryText) {
        const words = new Set(commentaryText.split(/[\s.,;:!?()"'—–-]+/).filter(Boolean));
        for (const pName of allPlayerNames) {
          if (ownNames.has(pName) && !outNames.has(pName)) continue;
          if (foreignNames.has(pName)) continue;
          const parts = pName.split(/\s+/);
          const lastPart = parts[parts.length - 1];
          if (!words.has(lastPart) && !words.has(pName)) continue;
          const esc = pName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          if (new RegExp(`\\b${esc}\\b`, "i").test(commentaryText)) {
            foreignNames.add(pName);
          }
        }
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
      if (typeof text !== "string") continue;
      if (!foreignPattern.test(text)) continue;

      const segments = splitIntoSegments(text);
      const crossRefPhrases =
        /\b(both of these|all of these|these two|these three|this pairs with|this combines with|together these|the other move|the other transfer)\b/i;
      const isForeign = segments.map((s) => foreignPattern.test(s) || crossRefPhrases.test(s));
      for (let si = 1; si < segments.length; si++) {
        if (
          isForeign[si - 1] &&
          !isForeign[si] &&
          /^(he|she|they|his|her|their|that|it)\b/i.test(segments[si])
        ) {
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
        let result = joined
          .join(" ")
          .replace(/\.{2,}/g, ".")
          .replace(/\s{2,}/g, " ")
          .trim();

        result = result.replace(/^(?:And |But |Also |Plus |Meanwhile )/i, "");
        result = result.replace(/^\s*he\b/i, (m) => m);

        if (field === "case" && result) {
          result = result
            .replace(/^["'"]+/, "")
            .replace(/["'"]+$/, "")
            .trim();
          result = `"${result}"`;
        }

        cleaned[field] = result || text.split(/(?<=[.!?])\s+/)[0];
        changed = true;
        logger.info(
          {
            field,
            removed: segments.length - kept.length,
            foreignHits: segments
              .filter((s) => foreignPattern.test(s))
              .map((s) => s.substring(0, 60)),
          },
          "Stripped cross-card player references from commentary",
        );
      }
    }

    return changed ? cleaned : rec;
  });
}

router.post(
  "/transfer-advice",
  validateBody(transferAdviceSchema),
  async (req: Request, res: Response) => {
    const isSSE = (req.headers.accept ?? "").includes("text/event-stream");

    function sendStage(stage: string, data?: Record<string, unknown>) {
      if (!isSSE) return;
      const payload = JSON.stringify({ stage, ...data });
      res.write(`data: ${payload}\n\n`);
    }

    function sendError(statusCode: number, body: Record<string, string>) {
      if (isSSE) {
        res.write(`data: ${JSON.stringify({ error: body.error, message: body.message })}\n\n`);
        res.end();
      } else {
        res.status(statusCode).json(body);
      }
    }

    try {
      const { manager_id, vibe, skip_cache: skipCache } = req.body;

      const vibePrompt = VIBE_PROMPTS[vibe];

      if (isSSE) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
      }

      sendStage("squad");
      req.log.info({ manager_id, vibe, skipCache: !!skipCache }, "Transfer advice started");

      const managerId = String(manager_id);

      if (skipCache) {
        clearCache(cacheKey("entry", managerId));
        clearCache(cacheKey("transfers", managerId));
        clearCache(cacheKey("history", managerId));
        clearCache(cacheKey("picks", managerId, String(31)));
        clearCache(cacheKey("picks", managerId, String(32)));
        clearCache(cacheKey("picks", managerId, String(33)));
        clearCache(cacheKey("picks", managerId, String(34)));
        req.log.info("skip_cache=true — cleared FPL data cache for manager");
      }

      const [bootstrap, managerInfo] = await Promise.all([
        fetchCachedData<BootstrapData>(
          cacheKey("bootstrap-static"),
          "/bootstrap-static/",
          TTL.STATIC,
        ),
        fetchCachedData<{
          started_event: number;
          entered_events?: number[];
          last_deadline_bank: number;
          last_deadline_value: number;
          last_deadline_total_transfers: number;
        }>(cacheKey("entry", managerId), `/entry/${managerId}/`, TTL.USER),
      ]);

      const currentEvent = bootstrap.events.find((e) => e.is_current);
      const nextEvent = bootstrap.events.find((e) => e.is_next);
      const activeEvent = nextEvent ?? currentEvent;
      if (!activeEvent) {
        sendError(200, {
          error: "season_not_started",
          message:
            "The FPL season hasn't started yet. Transfer advice will be available once the season begins.",
        });
        return;
      }
      const currentGw = activeEvent.id;
      const deadline = activeEvent.deadline_time;

      const enteredEvents = managerInfo.entered_events ?? [];
      const hasPlayedGameweeks = enteredEvents.length > 0;

      if (!hasPlayedGameweeks) {
        sendError(400, {
          error: "new_manager",
          message:
            "Your FPL team hasn't played any gameweeks yet. Transfer advice will be available once you've entered a gameweek.",
        });
        return;
      }

      if (skipCache) {
        req.log.info("skip_cache=true — bypassing pre-generated cache for transfer advice");
      }

      const supabase = getSupabaseForRequest(req);
      if (!skipCache && supabase) {
        try {
          const cacheTimeout = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), 3000),
          );

          const cacheCheck = (async () => {
            const t0 = Date.now();
            const { data: userRow } = await supabase
              .from("users")
              .select("id")
              .eq("fpl_manager_id", parseInt(managerId, 10))
              .limit(1)
              .single();

            if (!userRow) {
              req.log.info({ ms: Date.now() - t0 }, "Cache: no user row found for manager");
              return null;
            }

            const { data: rows, error: cacheErr } = await supabase
              .from("pre_generated_recommendations")
              .select("id, response_json, generated_at")
              .eq("user_id", userRow.id)
              .eq("gameweek", currentGw)
              .eq("decision_type", "transfer")
              .eq("vibe", vibe)
              .gt("expires_at", new Date().toISOString())
              .order("generated_at", { ascending: false })
              .limit(1);

            const cached = rows?.[0] ?? null;
            req.log.info(
              {
                ms: Date.now() - t0,
                found: !!cached,
                userId: userRow.id,
                rows: rows?.length,
                err: cacheErr?.message,
              },
              "Cache lookup complete",
            );
            if (!cached) return null;

            return { cacheRow: cached, userId: userRow.id };
          })();

          const cacheResult = await Promise.race([cacheCheck, cacheTimeout]);

          if (cacheResult) {
            const { cacheRow, userId } = cacheResult;
            const responseJson = cacheRow.response_json as CachedResponse;

            let liveBank: number | undefined;
            let liveFreeTransfers: number | undefined;
            try {
              const [freshEntry, freshTransfers, freshHistory] = await Promise.all([
                fetchCachedData<{ last_deadline_bank: number }>(
                  cacheKey("entry", managerId),
                  `/entry/${managerId}/`,
                  60_000,
                ),
                fetchCachedData<FPLTransfer[]>(
                  cacheKey("transfers", managerId),
                  `/entry/${managerId}/transfers/`,
                  60_000,
                ),
                fetchCachedData<FPLHistory>(
                  cacheKey("history", managerId),
                  `/entry/${managerId}/history/`,
                  60_000,
                ),
              ]);
              const pendingXfers = freshTransfers.filter((t) => t.event === currentGw);
              const bankDelta =
                pendingXfers.reduce(
                  (sum, t) => sum + (t.element_out_cost || 0) - (t.element_in_cost || 0),
                  0,
                ) / 10;
              liveBank = (freshEntry.last_deadline_bank ?? 0) / 10 + bankDelta;
              liveFreeTransfers = Math.max(
                calculateFreeTransfers(freshHistory, currentGw) - pendingXfers.length,
                0,
              );
            } catch (err) {
              req.log.warn(
                { err },
                "Could not fetch fresh data for cache validation — skipping bank/FT check",
              );
            }

            const staleness = checkStaleness(
              responseJson,
              bootstrap.elements as FPLPlayer[],
              cacheRow.generated_at,
              req.log,
              liveBank,
              liveFreeTransfers,
            );

            if (staleness.stale) {
              req.log.info({ reason: staleness.reason }, "Cache discarded — stale data detected");
            } else {
              req.log.info(
                { cacheId: cacheRow.id, gameweek: currentGw },
                "Serving cached transfer advice",
              );

              if (Array.isArray(responseJson.recommendations)) {
                const playerNameSet = new Set<string>(
                  (bootstrap.elements as FPLPlayer[]).map((p) => p.web_name),
                );
                responseJson.recommendations = sanitiseCommentary(
                  responseJson.recommendations as Array<Record<string, unknown>>,
                  req.log,
                  playerNameSet,
                );
              }

              const result = {
                ...responseJson,
                source: "cached",
                generated_at: cacheRow.generated_at,
              };

              if (isSSE) {
                sendStage("done");
                res.write(`data: ${JSON.stringify({ stage: "result", ...result })}\n\n`);
                res.end();
              } else {
                res.json(result);
              }
              return;
            }
          } else {
            req.log.info("No cached transfer advice found — using live generation");
          }
        } catch (cacheErr) {
          req.log.warn(
            { err: cacheErr },
            "Cache lookup failed — falling through to live generation",
          );
        }
      }

      const picksGw =
        currentEvent && !currentEvent.finished
          ? currentEvent.id
          : currentGw > 1
            ? currentGw - 1
            : 1;
      const gwsToTry = [picksGw];
      if (picksGw > 1) gwsToTry.push(picksGw - 1);
      if (picksGw > 2) gwsToTry.push(picksGw - 2);

      const parallelDataPromise = Promise.all([
        fetchCachedData<FPLFixture[]>(cacheKey("fixtures"), "/fixtures/", TTL.STATIC),
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

      let picksData: FPLPicksResponse | null = null;
      for (const gw of gwsToTry) {
        try {
          picksData = await fetchCachedData<FPLPicksResponse>(
            cacheKey("picks", managerId, String(gw)),
            `/entry/${managerId}/event/${gw}/picks/`,
            TTL.USER,
          );
          break;
        } catch (err) {
          req.log.warn({ err, managerId, gw }, "No picks for gameweek, trying previous");
        }
      }

      if (!picksData) {
        sendError(400, {
          error: "no_picks",
          message: "Could not find your squad picks. Make sure you have an active FPL team.",
        });
        return;
      }

      sendStage("market");

      const [fixtures, transferHistory, historyData] = await parallelDataPromise;

      const playerMap = new Map(bootstrap.elements.map((p) => [p.id, p]));
      const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));

      req.log.info(
        {
          managerId,
          picksGw: picksData.entry_history.event,
          picksBank: picksData.entry_history.bank,
          picksValue: picksData.entry_history.value,
          picksEventTransfers: picksData.entry_history.event_transfers,
          entryBank: managerInfo.last_deadline_bank,
          entryValue: managerInfo.last_deadline_value,
          entryTotalTransfers: managerInfo.last_deadline_total_transfers,
          transferHistoryCount: transferHistory.length,
          transferHistoryGw33: transferHistory.filter((t) => t.event === currentGw).length,
          currentGw,
          squad: picksData.picks.map((p) => {
            const pl = playerMap.get(p.element);
            return pl ? `${pl.web_name}(${p.element})` : String(p.element);
          }),
        },
        "Raw FPL API data",
      );

      if (transferHistory.length > 0) {
        req.log.info(
          {
            transfers: transferHistory.map((t) => ({
              event: t.event,
              playerIn: playerMap.get(t.element_in)?.web_name ?? t.element_in,
              playerOut: playerMap.get(t.element_out)?.web_name ?? t.element_out,
              inCost: t.element_in_cost,
              outCost: t.element_out_cost,
            })),
          },
          "Transfer history detail",
        );
      }

      const pendingTransfers = transferHistory.filter((t) => t.event === currentGw);
      const pendingBankDelta =
        pendingTransfers.reduce(
          (sum, t) => sum + (t.element_out_cost || 0) - (t.element_in_cost || 0),
          0,
        ) / 10;

      const baseBankFromPicks = picksData.entry_history.bank / 10;
      const baseBankFromEntry = (managerInfo.last_deadline_bank ?? 0) / 10;

      const baseBank = baseBankFromEntry > 0 ? baseBankFromEntry : baseBankFromPicks;
      const bank = baseBank + pendingBankDelta;

      const baseFreeTransfers = calculateFreeTransfers(historyData, currentGw);
      const freeTransfers = Math.max(baseFreeTransfers - pendingTransfers.length, 0);
      const chipsRemaining = getChipsRemaining(historyData, currentGw);

      req.log.info(
        {
          baseBankPicks: baseBankFromPicks,
          baseBankEntry: baseBankFromEntry,
          pendingBankDelta,
          finalBank: bank,
          baseFreeTransfers,
          finalFreeTransfers: freeTransfers,
          pendingCount: pendingTransfers.length,
          historyGws: historyData.current?.length ?? 0,
          firstGw: historyData.current?.[0]?.event,
        },
        "Bank/FT calculation",
      );

      if (Math.abs(baseBankFromPicks - baseBankFromEntry) > 0.1 && baseBankFromEntry > 0) {
        req.log.warn(
          {
            picksBank: baseBankFromPicks,
            entryBank: baseBankFromEntry,
            diff: Math.abs(baseBankFromPicks - baseBankFromEntry),
          },
          "Bank mismatch between picks and entry endpoints — using entry value",
        );
      }

      const adjustedPicks = [...picksData.picks];
      if (pendingTransfers.length > 0) {
        for (const transfer of pendingTransfers) {
          const idx = adjustedPicks.findIndex((p) => p.element === transfer.element_out);
          if (idx !== -1) {
            adjustedPicks[idx] = { ...adjustedPicks[idx], element: transfer.element_in };
          }
        }
        req.log.info(
          {
            swaps: pendingTransfers.map((t) => ({
              out: playerMap.get(t.element_out)?.web_name ?? t.element_out,
              in: playerMap.get(t.element_in)?.web_name ?? t.element_in,
            })),
            adjustedSquad: adjustedPicks.map(
              (p) => playerMap.get(p.element)?.web_name ?? p.element,
            ),
          },
          "Squad adjusted for pending GW transfers",
        );
      }

      const adjustedSquadIds = new Set(adjustedPicks.map((p) => p.element));

      const squadWithDetails = adjustedPicks.map((pick) => {
        const player = playerMap.get(pick.element);
        const team = player ? teamMap.get(player.team) : undefined;
        const purchaseCost = transferHistory.find(
          (t) => t.element_in === pick.element,
        )?.element_in_cost;
        const purchasePrice = purchaseCost ? purchaseCost / 10 : player ? player.now_cost / 10 : 0;
        const currentPrice = player ? player.now_cost / 10 : 0;
        const sellingPrice = calculateSellingPrice(purchasePrice, currentPrice);

        const gwFixtures = fixtures.filter((f) => f.event === currentGw);
        const fixture = player
          ? gwFixtures.find((f) => f.team_h === player.team || f.team_a === player.team)
          : undefined;
        const isHome = fixture ? fixture.team_h === player?.team : false;
        const opponentId = fixture ? (isHome ? fixture.team_a : fixture.team_h) : undefined;
        const opponent = opponentId ? teamMap.get(opponentId) : undefined;
        const fdr = fixture ? (isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty) : 3;

        return {
          id: pick.element,
          name: player?.web_name ?? `Player ${pick.element}`,
          position: player ? (POSITION_MAP[player.element_type] ?? "UNK") : "UNK",
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

      sendStage("rules");

      const highestSellingByPos: Record<string, number> = {};
      for (const p of squadWithDetails) {
        const current = highestSellingByPos[p.position] ?? 0;
        if (p.sellingPrice > current) highestSellingByPos[p.position] = p.sellingPrice;
      }

      const maxAffordable = bank + Math.max(...Object.values(highestSellingByPos), 0);

      const candidates = preFilterCandidates(
        bootstrap.elements,
        adjustedSquadIds,
        maxAffordable,
        fixtures,
        currentGw,
        bootstrap.teams,
      );

      req.log.info(
        { candidateCount: candidates.length, squadSize: squadWithDetails.length },
        "Candidates filtered",
      );

      const diverseCandidates: typeof candidates = [];
      const byPos: Record<number, typeof candidates> = { 1: [], 2: [], 3: [], 4: [] };
      for (const c of candidates) byPos[c.player.element_type]?.push(c);
      const minPerPos = 4;
      for (const posPlayers of Object.values(byPos)) {
        diverseCandidates.push(...posPlayers.slice(0, minPerPos));
      }
      for (const c of candidates) {
        if (diverseCandidates.length >= 30) break;
        if (!diverseCandidates.includes(c)) diverseCandidates.push(c);
      }

      const candidatesSummary = diverseCandidates
        .slice(0, 20)
        .map((c) => {
          const pos = POSITION_MAP[c.player.element_type] ?? "UNK";
          return `- ${c.player.web_name} (${pos}, ${c.team.short_name}) £${(c.player.now_cost / 10).toFixed(1)}m | Form: ${c.player.form} | Pts: ${c.player.total_points} | Own: ${c.player.selected_by_percent}% | FDR: ${c.upcomingFdr.join(",")}`;
        })
        .join("\n");

      const squadSummary = squadWithDetails
        .map(
          (p) =>
            `- ${p.name} (${p.position}, ${p.team}) | Price: £${p.price.toFixed(1)}m | Sell: £${p.sellingPrice.toFixed(1)}m | Form: ${p.form} | Pts: ${p.totalPoints} | Own: ${p.ownershipPct}% | vs ${p.opponent} | FDR: ${p.fdr} | Status: ${p.status}${p.isBench ? " [BENCH]" : ""}`,
        )
        .join("\n");

      const rulesContext = getRulesContext(currentGw);

      const gwAnalysis = analyseGameweek(currentGw, fixtures, bootstrap.teams);
      let gwAnalysisPrompt = "";
      if (gwAnalysis.promptContext) {
        gwAnalysisPrompt = gwAnalysis.promptContext;
        req.log.info(
          {
            gwType: gwAnalysis.type,
            blankCount: gwAnalysis.blankTeams.length,
            doubleCount: gwAnalysis.doubleTeams.length,
          },
          "Transfer gameweek analysis",
        );
      }

      const picksForChipCheck = await fetchCachedData<{ active_chip: string | null }>(
        cacheKey("picks-chip", managerId, String(currentGw)),
        `/entry/${managerId}/event/${currentGw}/picks/`,
        TTL.USER,
      ).catch(() => null);
      const liveActiveChip = picksForChipCheck?.active_chip ?? null;

      const activeChip = historyData.chips.find((c) => c.event === currentGw);
      const isWildcardActive = activeChip?.name === "wildcard" || liveActiveChip === "wildcard";
      const isFreeHitActive = activeChip?.name === "freehit" || liveActiveChip === "freehit";
      const isTripleCaptainActive = activeChip?.name === "3xc" || liveActiveChip === "3xc";
      const isBenchBoostActive = activeChip?.name === "bboost" || liveActiveChip === "bboost";
      const isChipMode = isWildcardActive || isFreeHitActive;

      let modeInstructions: string;
      let recommendationCount: string;

      if (isChipMode) {
        modeInstructions = `MODE: FULL SQUAD OVERHAUL (${isWildcardActive ? "Wildcard" : "Free Hit"} available)
The manager has a ${isWildcardActive ? "Wildcard" : "Free Hit"} chip available. Recommend comprehensive squad restructure packages.
Each recommendation should be a PACKAGE of 3-6 coordinated transfers that work together as a strategy.
Every package needs a creative package_name (e.g. "The Premium Triple-Up", "Fixture Swing", "Template Reset").
Show how the transfers combine for maximum impact. Budget constraint applies across ALL transfers in the package.
Each package MUST have a DIFFERENT strategic focus — e.g. one premium-heavy, one differential, one fixture-based rotation.`;
        recommendationCount =
          "Return exactly 3 to 4 restructure packages, each with a distinctly different strategy";
      } else if (freeTransfers >= 4) {
        modeInstructions = `MODE: RESTRUCTURE (${freeTransfers} free transfers banked)
The manager has ${freeTransfers} free transfers — this is a major restructure opportunity.

You MUST return ALL of the following (this is non-negotiable):
1. PACKAGE A: A restructure package using 2-${Math.min(freeTransfers, 4)} free transfers with one strategic theme.
2. PACKAGE B: A DIFFERENT restructure package using 2-${Math.min(freeTransfers, 4)} free transfers with a contrasting strategic theme.
3. OPTIONAL PACKAGE C: If there's a third viable strategy, include it.
4. ONE best individual swap — the single most impactful one-for-one transfer.
5. ONE hold option — explaining why banking transfers could be the smart play.

Example strategic themes for packages (pick different ones for each):
   - Defensive overhaul (upgrade/rotate defenders for upcoming fixtures)
   - Attacking upgrade (bring in premium or in-form attackers/midfielders)
   - Fixture swing (target teams with easy upcoming runs across multiple positions)
   - Budget rebalance (sideways moves to free funds for a future premium upgrade)
   - Differential play (low-ownership picks for mini-league gains)

Even with a tight budget, lateral moves (same-price swaps) and downgrades-to-fund-upgrades are valid package strategies. Do NOT skip packages just because the budget is low.
Do NOT return only 1 package + 1 hold. The user MUST have at least 2 distinct packages to compare.
Each package needs a creative package_name.`;
        recommendationCount =
          "Return exactly 4 to 5 recommendations: 2-3 packages + 1 individual swap + 1 hold option";
      } else if (freeTransfers >= 2) {
        modeInstructions = `MODE: MIXED (${freeTransfers} free transfers available)
The manager has ${freeTransfers} free transfers. You MUST return ALL of the following:
1. ONE OR TWO multi-transfer packages (using 2+ free transfers). Each package needs a creative package_name (e.g. "The Double Switch", "Attack Refresh") and a different strategic angle.
2. ONE OR TWO individual swap options — single player-for-player trades.
3. ONE hold option if holding transfers makes strategic sense.

Packages should show how the moves work together. Individual swaps should each target a different problem in the squad.`;
        recommendationCount =
          "Return exactly 4 to 5 recommendations: 1-2 packages + 1-2 individual swaps + 1 hold option";
      } else {
        modeInstructions = `MODE: INDIVIDUAL SWAPS (${freeTransfers} free transfer${freeTransfers === 1 ? "" : "s"})
The manager has ${freeTransfers} free transfer${freeTransfers === 1 ? "" : "s"}. Recommend individual player swaps only.
Each recommendation is a single player OUT / player IN swap.
If the user has 0 free transfers, every suggestion costs a 4-point hit.
Include 1 hold option if holding transfers makes strategic sense.`;
        recommendationCount = "Return 3 to 4 transfer options + 1 hold option";
      }

      const transferInstructions = `You are generating transfer recommendations for this FPL manager. Analyse their squad, upcoming fixtures, budget, and available free transfers.

${modeInstructions}

${recommendationCount}.

VALIDATION RULES:
- The buy player's price must not exceed the user's budget (£${bank.toFixed(1)}m) plus the sell player's selling price
- The transfer must not result in 4+ players from the same club (R1.03)
- Maintain position counts: 2 GK, 5 DEF, 5 MID, 3 FWD (R1.04)
- Do not recommend buying injured players (chance_of_playing = 0)
- Factor in sell price formula: user keeps 50% of price rises, rounded down (R3.06)
- For packages: validate the ENTIRE package together — budget, club limits, and position counts must be valid after ALL transfers in the package are applied
- POINT HIT RULE: The manager has exactly ${freeTransfers} free transfer${freeTransfers === 1 ? "" : "s"}. Any recommendation that uses MORE transfers than this costs -4 points PER EXTRA transfer. You MUST set total_hit_cost accurately. For example, if the manager has 1 free transfer and you recommend a 2-player package, total_hit_cost = 4. If you recommend a 3-player package, total_hit_cost = 8. Factor this cost into your expected_points_gain calculations and commentary.
- If holding transfers makes sense, include a "hold" option

ALWAYS include a hold option as the LAST recommendation with is_hold_recommendation: true — 'Do nothing' is valid advice.

CRITICAL COUNT REQUIREMENT: ${recommendationCount}. Do NOT return fewer recommendations than specified. The user needs multiple genuine choices.

COMMENTARY RULES:
- upside/risk/case must focus on player_in only. Do NOT discuss player_out.
- Each card is shown in isolation. Never reference other recommendations.
- Every recommendation must have a different player_in. No duplicates.
- Use exact web_name from squad/candidate data (e.g. "Cunha", "B.Fernandes").
- Exactly one recommendation: is_superscout_pick: true.
- Last recommendation: is_hold_recommendation: true.

For PACKAGES: is_package: true, package_name, transfers array, total_net_cost, total_hit_cost, uses_free_transfers, total_expected_points_gain_3gw.
For INDIVIDUAL swaps: player_out, player_in, player_out_team, player_in_team, player_out_selling_price, player_in_price, net_cost, uses_free_transfer, hit_cost, expected_points_gain_3gw.
Both types: confidence (BANKER|CALCULATED_RISK|BOLD_PUNT), upside, risk, case, is_superscout_pick, is_hold_recommendation.

Respond with valid JSON only — no markdown, no backticks.

JSON structure:
{"gameweek":${currentGw},"free_transfers":${freeTransfers},"budget_remaining":${bank.toFixed(1)},"recommendations":[...]}
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

${transferInstructions}

FINAL REMINDER — THIS IS MANDATORY: You MUST return ${recommendationCount}. Returning fewer is a failure. Each recommendation must be a distinct strategic option.`;

      let chipPrompt = "";
      if (isTripleCaptainActive) {
        chipPrompt =
          "TRIPLE CAPTAIN ACTIVE: The manager has activated Triple Captain this gameweek. Captain choice is paramount — focus transfer recommendations on enabling the best possible captain option. If the squad already has a strong TC target, the hold option may be optimal.";
      } else if (isBenchBoostActive) {
        chipPrompt =
          "BENCH BOOST ACTIVE: The manager has activated Bench Boost. ALL 15 players score this gameweek, including bench players. Prioritise transfers that upgrade weak bench options — every player matters. Flag bench players with blanks or tough fixtures as priority sells.";
      }

      let captainContextPrompt = "";
      const supabaseCross = getSupabaseForRequest(req);
      if (supabaseCross) {
        try {
          const { data: userRow } = await supabaseCross
            .from("users")
            .select("id")
            .eq("fpl_manager_id", parseInt(managerId, 10))
            .limit(1)
            .single();

          if (userRow) {
            const { data: captainRows } = await supabaseCross
              .from("pre_generated_recommendations")
              .select("response_json")
              .eq("user_id", userRow.id)
              .eq("gameweek", currentGw)
              .eq("decision_type", "captain")
              .eq("vibe", vibe)
              .gt("expires_at", new Date().toISOString())
              .order("generated_at", { ascending: false })
              .limit(1);

            if (captainRows?.[0]) {
              const picks = extractCaptainPicks(
                captainRows[0].response_json as Record<string, unknown>,
              );
              if (picks.length > 0) {
                captainContextPrompt = buildCaptainContextPrompt(picks);
                req.log.info(
                  { captainPicks: picks.map((p) => p.name) },
                  "Captain cross-check: informing transfer advice",
                );
              }
            }
          }
        } catch (err) {
          req.log.warn(
            { err },
            "Captain cross-check lookup failed — generating without captain context",
          );
        }
      }

      const systemPrompt = [
        vibePrompt,
        gwAnalysisPrompt,
        chipPrompt,
        captainContextPrompt,
        `IMPORTANT: You MUST respond with valid JSON only. No markdown, no backticks, no preamble.`,
        `CRITICAL PERSONA REQUIREMENT: Write the "case" field in your assigned persona voice.`,
      ]
        .filter(Boolean)
        .join("\n\n");

      sendStage("ai");
      req.log.info("AI generation started");

      const client = getClient(45000);
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: "user", content: context }],
      });

      sendStage("validating");
      req.log.info(
        { stopReason: message.stop_reason, usage: message.usage },
        "AI response received",
      );

      const block = message.content[0];
      if (block.type !== "text") {
        sendError(500, { error: "Unexpected AI response format" });
        return;
      }

      const parsed = extractJSON(block.text) as {
        gameweek?: number;
        free_transfers?: number;
        budget_remaining?: number;
        recommendations?: Array<Record<string, unknown>>;
      } | null;

      if (!parsed || !parsed.recommendations) {
        req.log.error(
          { rawText: block.text.substring(0, 1500), stopReason: message.stop_reason },
          "Failed to parse transfer AI JSON",
        );
        sendError(500, { error: "Could not parse AI response" });
        return;
      }

      function validateSingleSwap(
        playerOutName: string,
        playerInName: string,
        currentSquad: typeof squadWithDetails,
        availableBudget: number,
      ): boolean {
        const playerOut = currentSquad.find(
          (p) => p.name.toLowerCase() === playerOutName.toLowerCase(),
        );
        if (!playerOut && playerOutName) {
          req.log.warn({ playerOutName }, "Transfer validation: player_out not in squad");
          return false;
        }

        const playerIn = bootstrap.elements.find(
          (p) =>
            p.web_name?.toLowerCase() === playerInName.toLowerCase() ||
            p.second_name.toLowerCase() === playerInName.toLowerCase() ||
            `${p.first_name} ${p.second_name}`.toLowerCase() === playerInName.toLowerCase(),
        );
        if (!playerIn && playerInName) {
          req.log.warn({ playerInName }, "Transfer validation: player_in not found");
          return false;
        }

        if (
          playerIn &&
          (playerIn.status === "u" ||
            playerIn.status === "i" ||
            playerIn.status === "s" ||
            playerIn.chance_of_playing_next_round === 0)
        ) {
          req.log.warn({ playerInName }, "Transfer validation: player_in unavailable");
          return false;
        }

        if (playerOut && playerIn) {
          const outPos =
            POSITION_MAP[
              bootstrap.elements.find((e) => e.id === playerOut.id)?.element_type ?? 0
            ] ?? playerOut.position;
          const inPos = POSITION_MAP[playerIn.element_type] ?? "UNK";
          if (outPos !== inPos) {
            req.log.warn(
              { playerOutName, outPos, playerInName, inPos },
              "Transfer validation: position mismatch",
            );
            return false;
          }

          const cost = playerIn.now_cost / 10 - playerOut.sellingPrice;
          if (cost > availableBudget + 0.1) {
            req.log.warn(
              { playerInName, cost, availableBudget },
              "Transfer validation: cannot afford",
            );
            return false;
          }

          const playerInTeamId = playerIn.team;
          const currentClubCount = currentSquad.filter(
            (p) => p.teamId === playerInTeamId && p.id !== playerOut.id,
          ).length;
          if (currentClubCount >= 3) {
            req.log.warn(
              { playerInName, playerInTeamId, currentClubCount },
              "Transfer validation: club limit",
            );
            return false;
          }
        }

        return true;
      }

      function validatePackage(
        transfers: Array<{
          player_out?: string;
          player_in?: string;
          player_out_selling_price?: number;
          player_in_price?: number;
        }>,
      ): boolean {
        if (!transfers || transfers.length === 0) {
          req.log.warn("Package validation: empty transfers array");
          return false;
        }

        let runningBudget = bank;
        const simSquad = [...squadWithDetails];

        for (const swap of transfers) {
          const outName = String(swap.player_out ?? "");
          const inName = String(swap.player_in ?? "");

          if (!validateSingleSwap(outName, inName, simSquad, runningBudget)) {
            return false;
          }

          const playerOut = simSquad.find((p) => p.name.toLowerCase() === outName.toLowerCase());
          const playerIn = bootstrap.elements.find(
            (p) =>
              p.web_name?.toLowerCase() === inName.toLowerCase() ||
              p.second_name.toLowerCase() === inName.toLowerCase() ||
              `${p.first_name} ${p.second_name}`.toLowerCase() === inName.toLowerCase(),
          );

          if (playerOut && playerIn) {
            runningBudget += playerOut.sellingPrice - playerIn.now_cost / 10;
            const idx = simSquad.findIndex((p) => p.id === playerOut.id);
            if (idx >= 0) {
              simSquad[idx] = {
                ...simSquad[idx],
                id: playerIn.id,
                name: playerIn.web_name,
                teamId: playerIn.team,
                position: POSITION_MAP[playerIn.element_type] ?? "UNK",
                price: playerIn.now_cost / 10,
                sellingPrice: playerIn.now_cost / 10,
              };
            }
          }
        }

        const posCounts: Record<string, number> = {};
        for (const p of simSquad) {
          posCounts[p.position] = (posCounts[p.position] ?? 0) + 1;
        }
        const validCounts =
          (posCounts["GKP"] ?? 0) === 2 &&
          (posCounts["DEF"] ?? 0) === 5 &&
          (posCounts["MID"] ?? 0) === 5 &&
          (posCounts["FWD"] ?? 0) === 3;
        if (!validCounts) {
          req.log.warn({ posCounts }, "Package validation: invalid position counts");
          return false;
        }

        if (runningBudget < -0.1) {
          req.log.warn({ runningBudget }, "Package validation: over budget");
          return false;
        }

        return true;
      }

      req.log.info(
        { rawCount: parsed.recommendations.length, stopReason: message.stop_reason },
        "AI response received for transfers",
      );

      const validated = parsed.recommendations.filter((rec) => {
        if (rec.is_hold_recommendation) return true;

        if (rec.is_package && Array.isArray(rec.transfers)) {
          const valid = validatePackage(
            rec.transfers as Array<{
              player_out?: string;
              player_in?: string;
              player_out_selling_price?: number;
              player_in_price?: number;
            }>,
          );
          if (!valid)
            req.log.warn({ packageName: rec.package_name }, "Package dropped by validation");
          return valid;
        }

        const valid = validateSingleSwap(
          String(rec.player_out ?? ""),
          String(rec.player_in ?? ""),
          squadWithDetails,
          bank,
        );
        if (!valid)
          req.log.warn(
            { playerOut: rec.player_out, playerIn: rec.player_in },
            "Swap dropped by validation",
          );
        return valid;
      });

      req.log.info({ validatedCount: validated.length }, "Recommendations after validation");

      const hallucinationCtx = {
        players: bootstrap.elements,
        teams: bootstrap.teams,
        fixtures,
        gameweek: currentGw,
        logger: req.log,
      };

      // eslint-disable-next-line prefer-const
      let { filtered: halChecked, result: halResult } = checkTransferHallucinations(
        validated,
        hallucinationCtx,
      );

      if (halResult.removedCount > 0 || halResult.correctedCount > 0) {
        req.log.info(
          {
            removed: halResult.removedCount,
            corrected: halResult.correctedCount,
            warnings: halResult.warnings,
          },
          "Transfer hallucination check completed",
        );
      }

      if (halResult.flaggedStats.length > 0) {
        req.log.info(
          { flaggedStats: halResult.flaggedStats },
          "Transfer stat claims flagged for review",
        );
      }

      const nonHoldCount = halChecked.filter((r) => !r.is_hold_recommendation).length;
      if (nonHoldCount < 2) {
        req.log.warn(
          { remaining: nonHoldCount },
          "Too few transfer recs after hallucination check — retrying",
        );

        const retrySystemPrompt = [
          vibePrompt,
          rulesContext,
          `IMPORTANT: You MUST respond with valid JSON only. No markdown, no backticks, no preamble.`,
          `CRITICAL PERSONA REQUIREMENT: Write the "case" field in your assigned persona voice.`,
          ANTI_HALLUCINATION_PROMPT_SUFFIX,
        ]
          .filter(Boolean)
          .join("\n\n");

        const retryMessage = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4000,
          temperature: 0.3,
          system: retrySystemPrompt,
          messages: [{ role: "user", content: context }],
        });

        const retryBlock = retryMessage.content[0];
        if (retryBlock.type === "text") {
          const retryParsed = extractJSON(retryBlock.text) as typeof parsed;
          if (retryParsed?.recommendations) {
            const retryValidated = retryParsed.recommendations.filter((rec) => {
              if (rec.is_hold_recommendation) return true;
              if (rec.is_package && Array.isArray(rec.transfers)) {
                return validatePackage(
                  rec.transfers as Array<{
                    player_out?: string;
                    player_in?: string;
                    player_out_selling_price?: number;
                    player_in_price?: number;
                  }>,
                );
              }
              return validateSingleSwap(
                String(rec.player_out ?? ""),
                String(rec.player_in ?? ""),
                squadWithDetails,
                bank,
              );
            });
            const retryHal = checkTransferHallucinations(retryValidated, hallucinationCtx);
            req.log.info(
              { removed: retryHal.result.removedCount, remaining: retryHal.filtered.length },
              "Retry hallucination check completed",
            );
            halChecked = retryHal.filtered;
          }
        }
      }

      req.log.info({ finalCount: halChecked.length }, "Hallucination check done");

      const seenSwaps = new Set<string>();
      const seenInPlayers = new Set<string>();
      const deduped = halChecked.filter((rec) => {
        if (rec.is_hold_recommendation) return true;
        if (rec.is_package && Array.isArray(rec.transfers)) {
          const transfers = rec.transfers as Array<{ player_out?: string; player_in?: string }>;
          const packageKey = transfers
            .map(
              (t) =>
                `${String(t.player_out ?? "").toLowerCase()}>${String(t.player_in ?? "").toLowerCase()}`,
            )
            .sort()
            .join("|");
          if (seenSwaps.has(packageKey)) {
            req.log.info({ packageName: rec.package_name }, "Duplicate package removed");
            return false;
          }
          const inNames = transfers.map((t) => String(t.player_in ?? "").toLowerCase());
          const hasOverlap = inNames.some((n) => n && seenInPlayers.has(n));
          if (hasOverlap) {
            req.log.info(
              { packageName: rec.package_name, inNames },
              "Package removed — overlapping player_in with earlier card",
            );
            return false;
          }
          seenSwaps.add(packageKey);
          inNames.forEach((n) => {
            if (n) seenInPlayers.add(n);
          });
          return true;
        }
        const outKey = String(rec.player_out ?? "").toLowerCase();
        const inKey = String(rec.player_in ?? "").toLowerCase();
        const swapKey = `${outKey}>${inKey}`;
        if (seenSwaps.has(swapKey)) {
          req.log.info(
            { playerOut: rec.player_out, playerIn: rec.player_in },
            "Duplicate swap removed",
          );
          return false;
        }
        if (inKey && seenInPlayers.has(inKey)) {
          req.log.info(
            { playerOut: rec.player_out, playerIn: rec.player_in },
            "Duplicate player_in removed — already recommended",
          );
          return false;
        }
        seenSwaps.add(swapKey);
        if (inKey) seenInPlayers.add(inKey);
        return true;
      });

      if (deduped.length < halChecked.length) {
        req.log.info(
          { before: halChecked.length, after: deduped.length },
          "Duplicates removed from recommendations",
        );
      }

      const playerNameSet = new Set<string>(
        (bootstrap.elements as FPLPlayer[]).map((p) => p.web_name),
      );
      const sanitised = sanitiseCommentary(deduped, req.log, playerNameSet);

      const chipName = isWildcardActive
        ? "wildcard"
        : isFreeHitActive
          ? "freehit"
          : isTripleCaptainActive
            ? "3xc"
            : isBenchBoostActive
              ? "bboost"
              : null;

      const result: Record<string, unknown> = {
        gameweek: parsed.gameweek ?? currentGw,
        free_transfers: parsed.free_transfers ?? freeTransfers,
        budget_remaining: parsed.budget_remaining ?? bank,
        recommendations: sanitised,
        source: "live",
        generated_at: new Date().toISOString(),
        ...(gwAnalysis.type !== "normal" && {
          gw_type: gwAnalysis.type,
          blank_teams: gwAnalysis.blankTeams.map((t) => t.short_name),
          double_teams: gwAnalysis.doubleTeams.map((t) => t.short_name),
        }),
        ...(chipName && { active_chip: chipName }),
      };

      req.log.info({ recCount: halChecked.length, isSSE }, "Response sent");

      if (isSSE) {
        sendStage("done");
        res.write(`data: ${JSON.stringify({ stage: "result", ...result })}\n\n`);
        res.end();
      } else {
        res.json(result);
      }

      if (supabase && currentGw) {
        (async () => {
          try {
            const { data: userRow } = await supabase
              .from("users")
              .select("id")
              .eq("fpl_manager_id", parseInt(managerId, 10))
              .limit(1)
              .single();
            if (!userRow) return;
            const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
            const now = new Date().toISOString();

            const { data: existing } = await supabase
              .from("pre_generated_recommendations")
              .select("id")
              .eq("user_id", userRow.id)
              .eq("gameweek", currentGw)
              .eq("decision_type", "transfer")
              .eq("vibe", vibe ?? "expert")
              .limit(1);

            if (existing && existing.length > 0) {
              await supabase
                .from("pre_generated_recommendations")
                .update({ response_json: result, generated_at: now, expires_at: expiresAt })
                .eq("id", existing[0].id);
            } else {
              await supabase.from("pre_generated_recommendations").insert({
                user_id: userRow.id,
                gameweek: currentGw,
                decision_type: "transfer",
                vibe: vibe ?? "expert",
                response_json: result,
                generated_at: now,
                expires_at: expiresAt,
              });
            }
            req.log.info(
              { gameweek: currentGw, vibe },
              "Cached transfer advice for future requests",
            );
          } catch (cacheErr) {
            req.log.warn({ err: cacheErr }, "Failed to cache transfer advice");
          }
        })();
      }
    } catch (error: any) {
      const isTimeout =
        error?.status === 408 ||
        error?.code === "ETIMEDOUT" ||
        error?.message?.includes("timed out") ||
        error?.message?.includes("timeout");
      const msg = isTimeout
        ? "SuperScout is taking longer than usual — please try again in a moment."
        : "Failed to generate transfer advice";
      if (isTimeout) {
        req.log.warn({ err: error }, "Claude API timeout during transfer advice");
      } else {
        req.log.error({ err: error }, "Transfer advice generation failed");
      }
      if (isSSE) {
        res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
        res.end();
      } else {
        res.status(isTimeout ? 504 : 500).json({ error: msg });
      }
    }
  },
);

export default router;
