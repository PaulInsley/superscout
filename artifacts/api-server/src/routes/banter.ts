import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getCached, cacheKey, TTL, setCache } from "../lib/fplCache";
import { fetchFromFpl } from "../lib/fplRateLimiter";
import { VIBE_PROMPTS } from "../lib/vibes";
import { getSupabase } from "../lib/supabase";
import { getSupabaseForRequest } from "../lib/supabaseUser";
import { requireAuth } from "../lib/authMiddleware";
import { validateBody } from "../lib/validateRequest";
import { banterLeaguesSchema } from "../schemas/banter";

const router = Router();

interface BootstrapData {
  elements: Array<{
    id: number;
    web_name: string;
    team: number;
    element_type: number;
    selected_by_percent: string;
    total_points: number;
    form: string;
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

const POSITION_MAP: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };

function getClient(): Anthropic {
  return new Anthropic({
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    timeout: 30000,
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
    if (cleaned[i] === "{" || cleaned[i] === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === "}" || cleaned[i] === "]") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch (_) {
          /* keep scanning */
        }
      }
    }
  }
  return null;
}

async function fetchCachedData<T>(key: string, fplPath: string, ttl: number): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) return cached.data;
  const data = await fetchFromFpl<T>(fplPath);
  setCache(key, data, ttl);
  return data;
}

interface RivalInfo {
  manager_id: number;
  team_name: string;
  rank: number;
  total_points: number;
  gameweek_points: number;
  captain_name: string | null;
  squad_names: string[];
  relationship: string;
}

interface BanterCard {
  rival_team_name: string;
  rival_rank: number;
  points_gap: number;
  points_gap_text: string;
  headline: string;
  key_battle: string;
  captain_clash: string;
  verdict: string;
  share_line: string;
  league_name: string;
  league_type: string;
}

router.get("/banter/:gameweek", requireAuth, async (req: Request, res: Response) => {
  try {
    const supabase = (req as any).userSupabase;
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const verifiedUserId = (req as any).verifiedUserId;
    const gwParam = String(req.params.gameweek);
    const { vibe = "expert", manager_id: qManagerId } = req.query;

    const bootstrap = await fetchCachedData<BootstrapData>(
      cacheKey("bootstrap-static"),
      "/bootstrap-static/",
      TTL.STATIC,
    );

    let gw: number;
    if (gwParam === "current") {
      const nextEvent = bootstrap.events.find((e) => e.is_next);
      const currentEvent = bootstrap.events.find((e) => e.is_current);
      gw = nextEvent?.id ?? currentEvent?.id ?? 1;
    } else {
      gw = parseInt(gwParam, 10);
    }

    if (isNaN(gw) || gw < 1 || gw > 50) {
      res.status(400).json({ error: "Invalid gameweek" });
      return;
    }

    const { data: cachedBanter } = await supabase
      .from("pre_generated_recommendations")
      .select("response_json")
      .eq("user_id", verifiedUserId)
      .eq("gameweek", gw)
      .eq("decision_type", "banter")
      .eq("vibe", String(vibe))
      .gt("expires_at", new Date().toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    if (cachedBanter?.response_json) {
      req.log.info("Serving cached banter");
      res.json({ ...(cachedBanter.response_json as object), source: "cached" });
      return;
    }

    const { data: leagues, error: leagueErr } = await supabase
      .from("mini_league_context")
      .select("*")
      .eq("user_id", verifiedUserId)
      .eq("season", "2026-27");

    if (leagueErr || !leagues || leagues.length === 0) {
      if (process.env.NODE_ENV !== "development") {
        res.json({ banter_cards: [], no_leagues: true });
        return;
      }
    }

    const { data: userData } = await supabase
      .from("users")
      .select("fpl_manager_id")
      .eq("id", verifiedUserId)
      .single();

    let managerId: number;
    if (userData?.fpl_manager_id) {
      managerId = Number(userData.fpl_manager_id);
    } else if (qManagerId) {
      managerId = Number(qManagerId);
    } else {
      res.status(400).json({ error: "No FPL manager linked" });
      return;
    }
    const playerMap = new Map(bootstrap.elements.map((p) => [p.id, p]));
    const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));

    let userPicks: any = null;
    try {
      userPicks = await fetchCachedData<any>(
        cacheKey("picks", String(managerId), String(gw)),
        `/entry/${managerId}/event/${gw}/picks/`,
        TTL.USER,
      );
    } catch (err) {
      req.log.warn(
        { err, managerId, gw },
        "[Banter] current GW picks fetch failed, trying previous",
      );
      try {
        userPicks = await fetchCachedData<any>(
          cacheKey("picks", String(managerId), String(gw - 1)),
          `/entry/${managerId}/event/${gw - 1}/picks/`,
          TTL.USER,
        );
      } catch (err2) {
        req.log.warn({ err: err2, managerId }, "[Banter] previous GW picks fetch also failed");
      }
    }

    const userSquadNames: string[] = [];
    let userCaptainName: string | null = null;
    if (userPicks?.picks) {
      for (const pick of userPicks.picks) {
        const player = playerMap.get(pick.element);
        if (player) {
          userSquadNames.push(player.web_name);
          if (pick.is_captain) userCaptainName = player.web_name;
        }
      }
    }

    const MAX_RIVALS = 3;
    const isDev = process.env.NODE_ENV === "development";

    interface RivalTask {
      rival: {
        entry: number;
        rank: number;
        total: number;
        entry_name: string;
        relationship: string;
      };
      userRank: number;
      userPoints: number;
      leagueName: string;
      leagueType: string;
    }

    const rivalTasks: RivalTask[] = [];

    for (const league of leagues ?? []) {
      if (rivalTasks.length >= MAX_RIVALS) break;

      const leagueType = league.league_type ?? "classic";
      const leagueId = league.mini_league_id;

      let standings: any = null;
      try {
        if (leagueType === "h2h") {
          standings = await fetchCachedData<any>(
            cacheKey("league-h2h", String(leagueId)),
            `/leagues-h2h/${leagueId}/standings/`,
            TTL.USER,
          );
        } else {
          standings = await fetchCachedData<any>(
            cacheKey("league-classic", String(leagueId)),
            `/leagues-classic/${leagueId}/standings/`,
            TTL.USER,
          );
        }
      } catch (err) {
        req.log.warn({ leagueId, err }, "Failed to fetch league standings");
        continue;
      }

      const results = standings?.standings?.results ?? standings?.standings?.entries ?? [];
      if (results.length === 0) continue;

      const userEntry = results.find((r: any) => Number(r.entry) === managerId);
      if (!userEntry) continue;

      const userRank = userEntry.rank ?? 0;
      const userPoints = userEntry.total ?? userEntry.points_for ?? 0;

      const sorted = [...results].sort((a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0));
      const userIndex = sorted.findIndex((r: any) => Number(r.entry) === managerId);

      if (userIndex > 0) {
        const above = sorted[userIndex - 1];
        rivalTasks.push({
          rival: {
            entry: above.entry,
            rank: above.rank,
            total: above.total ?? above.points_for ?? 0,
            entry_name: above.entry_name,
            relationship: "directly above you",
          },
          userRank,
          userPoints,
          leagueName: league.mini_league_name ?? "Mini-League",
          leagueType,
        });
      }
      if (userIndex < sorted.length - 1) {
        const below = sorted[userIndex + 1];
        rivalTasks.push({
          rival: {
            entry: below.entry,
            rank: below.rank,
            total: below.total ?? below.points_for ?? 0,
            entry_name: below.entry_name,
            relationship: "directly below you",
          },
          userRank,
          userPoints,
          leagueName: league.mini_league_name ?? "Mini-League",
          leagueType,
        });
      }
      if (userRank > 3 && sorted.length > 0) {
        const leader = sorted[0];
        if (leader.entry !== managerId && !rivalTasks.some((t) => t.rival.entry === leader.entry)) {
          rivalTasks.push({
            rival: {
              entry: leader.entry,
              rank: leader.rank,
              total: leader.total ?? leader.points_for ?? 0,
              entry_name: leader.entry_name,
              relationship: "league leader",
            },
            userRank,
            userPoints,
            leagueName: league.mini_league_name ?? "Mini-League",
            leagueType,
          });
        }
      }
    }

    if (isDev && rivalTasks.length === 0) {
      req.log.info("DEV MODE fallback: Real leagues produced 0 rivals, using dummy rivals");
      const dummyRivals = [
        {
          entry: 4,
          rank: 1,
          total: 2100,
          entry_name: "Who Got Erling?",
          relationship: "league leader" as const,
        },
        {
          entry: 167,
          rank: 2,
          total: 2050,
          entry_name: "The Salah Soldiers",
          relationship: "directly above you" as const,
        },
        {
          entry: 372,
          rank: 4,
          total: 1950,
          entry_name: "Pep's Fraudulence",
          relationship: "directly below you" as const,
        },
      ];
      for (const r of dummyRivals) {
        rivalTasks.push({
          rival: r,
          userRank: 3,
          userPoints: 2000,
          leagueName: "Dev Banter League",
          leagueType: "classic",
        });
      }
    }

    const tasks = rivalTasks.slice(0, MAX_RIVALS);

    async function generateBanterCard(task: RivalTask): Promise<BanterCard | null> {
      const { rival, userRank, userPoints, leagueName, leagueType } = task;
      const rivalSquadNames: string[] = [];
      let rivalCaptainName: string | null = null;
      let rivalNotSet = false;

      try {
        const rivalPicks = await fetchCachedData<any>(
          cacheKey("picks", String(rival.entry), String(gw)),
          `/entry/${rival.entry}/event/${gw}/picks/`,
          TTL.USER,
        );
        if (rivalPicks?.picks) {
          for (const pick of rivalPicks.picks) {
            const player = playerMap.get(pick.element);
            if (player) {
              rivalSquadNames.push(player.web_name);
              if (pick.is_captain) rivalCaptainName = player.web_name;
            }
          }
        }
      } catch (err) {
        req.log.warn(
          { err, rivalEntry: rival.entry, gw },
          "[Banter] rival current picks failed, trying previous",
        );
        try {
          const rivalPicks = await fetchCachedData<any>(
            cacheKey("picks", String(rival.entry), String(gw - 1)),
            `/entry/${rival.entry}/event/${gw - 1}/picks/`,
            TTL.USER,
          );
          if (rivalPicks?.picks) {
            for (const pick of rivalPicks.picks) {
              const player = playerMap.get(pick.element);
              if (player) {
                rivalSquadNames.push(player.web_name);
                if (pick.is_captain) rivalCaptainName = player.web_name;
              }
            }
          }
        } catch (err2) {
          req.log.warn({ err: err2 }, "[Banter] rival previous picks also failed");
          rivalNotSet = true;
        }
      }

      const sharedPlayers = userSquadNames.filter((p) => rivalSquadNames.includes(p));
      const userDifferentials = userSquadNames.filter((p) => !rivalSquadNames.includes(p));
      const rivalDifferentials = rivalSquadNames.filter((p) => !userSquadNames.includes(p));
      const pointsGap = userPoints - rival.total;
      const pointsGapText =
        pointsGap > 0
          ? `${pointsGap} points ahead of ${rival.entry_name}`
          : pointsGap < 0
            ? `${Math.abs(pointsGap)} points behind ${rival.entry_name}`
            : `Level on points with ${rival.entry_name}`;

      const banterPrompt = buildBanterPrompt({
        vibe: String(vibe),
        userCaptain: userCaptainName,
        rivalCaptain: rivalCaptainName,
        rivalTeamName: rival.entry_name,
        rivalRank: rival.rank,
        userRank,
        pointsGap,
        sharedPlayers,
        userDifferentials,
        rivalDifferentials,
        relationship: rival.relationship,
        leagueType,
        leagueName,
        rivalNotSet,
      });

      const client = getClient();
      const vibeSystemPrompt =
        VIBE_PROMPTS[String(vibe) as keyof typeof VIBE_PROMPTS] ?? VIBE_PROMPTS.expert;
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        temperature: 0.7,
        system: `${vibeSystemPrompt}\n\nYou generate mini-league banter between FPL managers. Respond ONLY with valid JSON.`,
        messages: [{ role: "user", content: banterPrompt }],
      });
      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      const parsed = extractJSON(text) as BanterCard | null;
      if (!parsed) return null;
      return {
        ...parsed,
        rival_team_name: rival.entry_name,
        rival_rank: rival.rank,
        points_gap: pointsGap,
        points_gap_text: pointsGapText,
        league_name: leagueName,
        league_type: leagueType,
      };
    }

    const cardResults = await Promise.allSettled(tasks.map((t) => generateBanterCard(t)));
    const allBanterCards: BanterCard[] = [];
    for (const r of cardResults) {
      if (r.status === "fulfilled" && r.value) allBanterCards.push(r.value);
    }

    const result = {
      gameweek: gw,
      banter_cards: allBanterCards,
      no_leagues: false,
      ...(isDev && rivalTasks.length > 0 && !leagues?.length && { dev_mode: true }),
    };

    res.json(result);

    if (allBanterCards.length > 0) {
      (async () => {
        try {
          const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
          const now = new Date().toISOString();
          const { data: existing } = await supabase
            .from("pre_generated_recommendations")
            .select("id")
            .eq("user_id", verifiedUserId)
            .eq("gameweek", gw)
            .eq("decision_type", "banter")
            .eq("vibe", String(vibe))
            .limit(1);

          if (existing && existing.length > 0) {
            await supabase
              .from("pre_generated_recommendations")
              .update({ response_json: result, generated_at: now, expires_at: expiresAt })
              .eq("id", existing[0].id);
          } else {
            await supabase.from("pre_generated_recommendations").insert({
              user_id: verifiedUserId,
              gameweek: gw,
              decision_type: "banter",
              vibe: String(vibe),
              response_json: result,
              generated_at: now,
              expires_at: expiresAt,
            });
          }
          req.log.info(
            { gameweek: gw, cards: allBanterCards.length },
            "Cached banter for future requests",
          );
        } catch (cacheErr) {
          req.log.warn({ err: cacheErr }, "Failed to cache banter");
        }
      })();
    }
  } catch (error) {
    req.log.error({ err: error }, "Banter route failed");
    res.status(500).json({ error: "Banter generation failed" });
  }
});

router.post(
  "/banter/leagues",
  requireAuth,
  validateBody(banterLeaguesSchema),
  async (req: Request, res: Response) => {
    try {
      const supabase = (req as any).userSupabase;
      if (!supabase) {
        res.status(503).json({ error: "Database not configured" });
        return;
      }

      const verifiedUserId = (req as any).verifiedUserId;
      const { leagues } = req.body;

      const { error: deleteErr } = await supabase
        .from("mini_league_context")
        .delete()
        .eq("user_id", verifiedUserId)
        .eq("season", "2026-27");

      if (deleteErr) {
        req.log.error({ err: deleteErr }, "Failed to clear existing leagues");
        res.status(500).json({ error: "Failed to update leagues" });
        return;
      }

      for (const league of leagues) {
        const { error: insertErr } = await supabase.from("mini_league_context").insert({
          user_id: verifiedUserId,
          mini_league_id: String(league.id),
          mini_league_name: league.name,
          current_rank: league.rank ?? null,
          rival_manager_ids: league.rival_ids ?? [],
          season: "2026-27",
        });
        if (insertErr) {
          req.log.error({ err: insertErr, leagueId: league.id }, "Failed to insert league");
          res
            .status(500)
            .json({ error: `Failed to save league ${league.name}: ${insertErr.message}` });
          return;
        }
      }

      res.json({ success: true, leagues_saved: leagues.length });
    } catch (error) {
      req.log.error({ err: error }, "Save leagues failed");
      res.status(500).json({ error: "Failed to save leagues" });
    }
  },
);

router.get("/banter/leagues/:userId", requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.params.userId !== (req as any).verifiedUserId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const supabase = (req as any).userSupabase;
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { data, error } = await supabase
      .from("mini_league_context")
      .select("*")
      .eq("user_id", req.params.userId)
      .eq("season", "2026-27");

    if (error) {
      res.status(500).json({ error: "Failed to fetch leagues" });
      return;
    }

    res.json({ leagues: data ?? [] });
  } catch (error) {
    req.log.error({ err: error }, "Fetch leagues failed");
    res.status(500).json({ error: "Failed to fetch leagues" });
  }
});

function buildBanterPrompt(ctx: {
  vibe: string;
  userCaptain: string | null;
  rivalCaptain: string | null;
  rivalTeamName: string;
  rivalRank: number;
  userRank: number;
  pointsGap: number;
  sharedPlayers: string[];
  userDifferentials: string[];
  rivalDifferentials: string[];
  relationship: string;
  leagueType: string;
  leagueName: string;
  rivalNotSet: boolean;
}): string {
  const squadSection = ctx.rivalNotSet
    ? `The rival hasn't set their team yet. Note this in the banter: "Your opponent hasn't even set their team yet. Either confidence or apathy."`
    : `
SHARED PLAYERS (both have): ${ctx.sharedPlayers.join(", ") || "None"}
YOUR DIFFERENTIALS: ${ctx.userDifferentials.join(", ") || "None"}
RIVAL'S DIFFERENTIALS: ${ctx.rivalDifferentials.join(", ") || "None"}
YOUR CAPTAIN: ${ctx.userCaptain ?? "Unknown"}
RIVAL'S CAPTAIN: ${ctx.rivalCaptain ?? "Unknown"}`;

  return `MINI-LEAGUE BANTER GENERATION

Generate a banter card for this matchup:

RIVAL TEAM NAME: "${ctx.rivalTeamName}"
LEAGUE: ${ctx.leagueName} (${ctx.leagueType})
RIVAL'S LEAGUE RANK: ${ctx.rivalRank}
YOUR LEAGUE RANK: ${ctx.userRank}
POINTS GAP: ${ctx.pointsGap > 0 ? `You're ${ctx.pointsGap} points ahead` : ctx.pointsGap < 0 ? `You're ${Math.abs(ctx.pointsGap)} points behind` : "Level on points"}
RELATIONSHIP: ${ctx.relationship}
${squadSection}

RULES:
- Use the rival's team name "${ctx.rivalTeamName}", not their real name
- Reference specific players, not generic statements
- Be funny but never cruel or personal
- ${ctx.leagueType === "h2h" ? "Frame as a head-to-head matchup" : "Frame as a standings battle"}
- HEADLINE: Max 10 words, punchy one-liner
- KEY_BATTLE: 2-3 sentences about the most interesting squad difference
- CAPTAIN_CLASH: 1-2 sentences comparing captain choices
- VERDICT: 1-2 sentences, pick a side boldly
- SHARE_LINE: Single sentence, max 15 words, funny & slightly provocative, designed for screenshotting

Respond with this exact JSON structure:
{
  "headline": "...",
  "key_battle": "...",
  "captain_clash": "...",
  "verdict": "...",
  "share_line": "..."
}`;
}

export default router;

export { buildBanterPrompt, extractJSON, fetchCachedData };
