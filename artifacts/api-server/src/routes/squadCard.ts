import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getCached, setCache, cacheKey, TTL } from "../lib/fplCache";
import { fetchFromFpl } from "../lib/fplRateLimiter";
import { VIBE_PROMPTS } from "../lib/vibes";
import { getSupabase } from "../lib/supabase";

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
}

interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
}

interface FPLEvent {
  id: number;
  name: string;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
  deadline_time: string;
  average_entry_score: number | null;
}

interface FPLPick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

interface FPLLiveElement {
  id: number;
  stats: {
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    bonus: number;
    total_points: number;
  };
}

interface AutoSub {
  element_in: number;
  element_out: number;
}

interface SquadCardPlayer {
  id: number;
  name: string;
  webName: string;
  position: string;
  points: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isBench: boolean;
  isAutoSubIn: boolean;
  isAutoSubOut: boolean;
  pickPosition: number;
  multiplier: number;
}

function getClient(): Anthropic {
  return new Anthropic({
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  });
}

async function getBootstrapData(): Promise<{ players: FPLPlayer[]; teams: FPLTeam[]; events: FPLEvent[] }> {
  const key = cacheKey("bootstrap-static");
  const cached = getCached<{ elements: FPLPlayer[]; teams: FPLTeam[]; events: FPLEvent[] }>(key);
  if (cached) {
    return { players: cached.data.elements, teams: cached.data.teams, events: cached.data.events };
  }

  const data = await fetchFromFpl("/bootstrap-static/") as { elements: FPLPlayer[]; teams: FPLTeam[]; events: FPLEvent[] };
  setCache(key, data, TTL.STATIC);
  return { players: data.elements, teams: data.teams, events: data.events };
}

function inferFormation(starters: SquadCardPlayer[]): string {
  const outfield = starters.filter(p => p.position !== "GKP");
  const def = outfield.filter(p => p.position === "DEF").length;
  const mid = outfield.filter(p => p.position === "MID").length;
  const fwd = outfield.filter(p => p.position === "FWD").length;
  return `${def}-${mid}-${fwd}`;
}

router.post("/squad-card", async (req: Request, res: Response) => {
  try {
    const { manager_id, vibe, gameweek: requestedGw } = req.body;

    if (!manager_id) {
      res.status(400).json({ error: "Missing manager_id" });
      return;
    }

    const vibeKey = vibe || "expert";
    const vibePrompt = VIBE_PROMPTS[vibeKey];
    if (!vibePrompt) {
      res.status(400).json({ error: "Invalid vibe" });
      return;
    }

    const { players, teams, events } = await getBootstrapData();
    const playerMap = new Map(players.map(p => [p.id, p]));
    const teamMap = new Map(teams.map(t => [t.id, t]));

    const lastFinished = [...events].reverse().find(e => e.finished);
    const targetGw = requestedGw || lastFinished?.id;

    if (!targetGw) {
      res.status(400).json({ error: "no_finished_gameweek", message: "No finished gameweeks found yet." });
      return;
    }

    const targetEvent = events.find(e => e.id === targetGw);
    if (targetEvent && !targetEvent.finished) {
      res.status(400).json({
        error: "gameweek_not_finished",
        message: "This gameweek isn't finished yet. Come back after the last match to see your full results.",
      });
      return;
    }

    const gwAverage = targetEvent?.average_entry_score ?? null;

    let managerInfo: { name: string; summary_overall_points: number | null; summary_overall_rank: number | null };
    try {
      managerInfo = await fetchFromFpl(`/entry/${manager_id}/`) as typeof managerInfo;
    } catch {
      res.status(404).json({ error: "manager_not_found", message: "Could not find that FPL manager." });
      return;
    }

    let picksData: {
      picks: FPLPick[];
      entry_history: { points: number; total_points: number; overall_rank: number; points_on_bench: number };
      automatic_subs: AutoSub[];
    };
    try {
      picksData = await fetchFromFpl(`/entry/${manager_id}/event/${targetGw}/picks/`) as typeof picksData;
    } catch {
      res.status(404).json({ error: "no_picks", message: "No squad data found for this gameweek." });
      return;
    }

    let liveData: { elements: FPLLiveElement[] };
    try {
      const liveKey = cacheKey("live", targetGw);
      const cachedLive = getCached<{ elements: FPLLiveElement[] }>(liveKey);
      if (cachedLive) {
        liveData = cachedLive.data;
      } else {
        liveData = await fetchFromFpl(`/event/${targetGw}/live/`) as typeof liveData;
        setCache(liveKey, liveData, TTL.SEMI_LIVE);
      }
    } catch {
      res.status(500).json({ error: "live_data_error", message: "Could not load live points data." });
      return;
    }

    const liveMap = new Map(liveData.elements.map(e => [e.id, e.stats.total_points]));
    const autoSubInSet = new Set(picksData.automatic_subs?.map(s => s.element_in) || []);
    const autoSubOutSet = new Set(picksData.automatic_subs?.map(s => s.element_out) || []);

    const squadPlayers: SquadCardPlayer[] = picksData.picks.map(pick => {
      const player = playerMap.get(pick.element);
      const points = liveMap.get(pick.element) ?? 0;
      return {
        id: pick.element,
        name: player ? `${player.first_name} ${player.second_name}` : `Player ${pick.element}`,
        webName: player?.web_name ?? `P${pick.element}`,
        position: player ? POSITION_MAP[player.element_type] ?? "MID" : "MID",
        points: points * pick.multiplier,
        isCaptain: pick.is_captain,
        isViceCaptain: pick.is_vice_captain,
        isBench: pick.position >= 12,
        isAutoSubIn: autoSubInSet.has(pick.element),
        isAutoSubOut: autoSubOutSet.has(pick.element),
        pickPosition: pick.position,
        multiplier: pick.multiplier,
      };
    });

    const starters = squadPlayers.filter(p => !p.isBench);
    const bench = squadPlayers.filter(p => p.isBench).sort((a, b) => a.pickPosition - b.pickPosition);
    const formation = inferFormation(starters);
    const totalPoints = picksData.entry_history.points;
    const benchPoints = picksData.entry_history.points_on_bench;
    const overallRank = picksData.entry_history.overall_rank;

    let previousRank: number | null = null;
    try {
      const history = await fetchFromFpl(`/entry/${manager_id}/history/`) as { current: { event: number; overall_rank: number }[] };
      const prevGw = history.current.find(h => h.event === targetGw - 1);
      if (prevGw) {
        previousRank = prevGw.overall_rank;
      }
    } catch {}

    let rankChange: number | null = null;
    let rankDirection: "up" | "down" | "same" | "new" = "new";
    if (previousRank !== null) {
      rankChange = previousRank - overallRank;
      if (rankChange > 0) rankDirection = "up";
      else if (rankChange < 0) { rankDirection = "down"; rankChange = Math.abs(rankChange); }
      else rankDirection = "same";
    }

    const captain = squadPlayers.find(p => p.isCaptain);
    const viceCaptain = squadPlayers.find(p => p.isViceCaptain);
    const topScorer = [...starters].sort((a, b) => b.points - a.points)[0];
    const highestBench = bench.length > 0 ? [...bench].sort((a, b) => b.points - a.points)[0] : null;
    const captainPlayer = captain ? playerMap.get(captain.id) : null;

    let quipText = `Gameweek ${targetGw} — ${totalPoints} points. The numbers speak for themselves.`;
    try {
      const quipContext = `Generate a Squad Card quip for this gameweek. ONE sentence only, maximum 280 characters. Be specific to the actual results — reference the captain pick, standout performers, or bench disasters. Make it feel personal and shareable.

Gameweek: ${targetGw}
Total points: ${totalPoints}
Captain: ${captain?.webName ?? "Unknown"} (${captain?.points ?? 0} pts, ${captainPlayer?.selected_by_percent ?? "?"}% owned)
Vice captain: ${viceCaptain?.webName ?? "Unknown"} (${viceCaptain?.points ?? 0} pts)
Top scorer in squad: ${topScorer?.webName ?? "Unknown"} (${topScorer?.points ?? 0} pts)
Highest bench scorer: ${highestBench?.webName ?? "None"} (${highestBench?.points ?? 0} pts)
Bench points wasted: ${benchPoints} pts
Gameweek average: ${gwAverage ?? "unknown"} pts
Rank movement: ${rankDirection === "new" ? "New entry" : rankDirection === "same" ? "No change" : `${rankDirection} ${rankChange} places`}
New overall rank: ${overallRank.toLocaleString()}

IMPORTANT: Return ONLY the quip text. No quotes, no preamble, no explanation. Just the single line.`;

      const client = getClient();
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        system: vibePrompt,
        messages: [{ role: "user", content: quipContext }],
      });

      const block = message.content[0];
      if (block.type === "text") {
        const raw = block.text.trim().replace(/^["']|["']$/g, "");
        if (raw.length > 0 && raw.length <= 350) {
          quipText = raw;
        }
      }
    } catch (err) {
      req.log.error({ err }, "Quip generation failed, using fallback");
    }

    try {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from("squad_cards").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          season: "2026-27",
          gameweek: targetGw,
          skin_name: "default",
          was_shared: false,
          quip_text: quipText,
        });
      }
    } catch (err) {
      req.log.warn({ err }, "Failed to log squad card to DB");
    }

    res.json({
      teamName: managerInfo.name,
      gameweek: targetGw,
      formation,
      starters: starters.map(p => ({
        id: p.id,
        webName: p.webName,
        position: p.position,
        points: p.points,
        isCaptain: p.isCaptain,
        isViceCaptain: p.isViceCaptain,
        isAutoSubOut: p.isAutoSubOut,
      })),
      bench: bench.map(p => ({
        id: p.id,
        webName: p.webName,
        position: p.position,
        points: p.points,
        isAutoSubIn: p.isAutoSubIn,
      })),
      totalPoints,
      benchPoints,
      overallRank,
      rankChange,
      rankDirection,
      gwAverage,
      quipText,
      vibe: vibeKey,
    });
  } catch (err) {
    req.log.error({ err }, "Squad card generation failed");
    res.status(500).json({ error: "internal", message: "Something went wrong generating your squad card." });
  }
});

router.post("/squad-card/share", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { gameweek, platform } = req.body;
    if (!gameweek) {
      res.status(400).json({ error: "Missing gameweek" });
      return;
    }

    const dbPlatforms = ["twitter", "whatsapp", "imessage", "instagram", "clipboard"];
    const sharePlatform = dbPlatforms.includes(platform) ? platform : null;

    await supabase
      .from("squad_cards")
      .update({ was_shared: true, share_platform: sharePlatform })
      .eq("user_id", "00000000-0000-0000-0000-000000000000")
      .eq("gameweek", gameweek)
      .order("created_at", { ascending: false })
      .limit(1);

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update share status");
    res.status(500).json({ error: "internal" });
  }
});

export default router;
