import { Router, type Request, type Response } from "express";
import { getSupabase } from "../lib/supabase";
import { getCached, setCache, cacheKey, TTL } from "../lib/fplCache";

const router = Router();

const FPL_BASE = "https://fantasy.premierleague.com/api";

interface BootstrapEvent {
  id: number;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
  deadline_time: string;
}

async function getCurrentSeason(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 7) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

async function getCurrentGameweek(): Promise<number | null> {
  const key = cacheKey("bootstrap-static");
  let events: BootstrapEvent[] | null = null;

  const cached = getCached<{ events: BootstrapEvent[] }>(key);
  if (cached) {
    events = cached.data.events;
  } else {
    try {
      const resp = await fetch(`${FPL_BASE}/bootstrap-static/`);
      if (resp.ok) {
        const data = await resp.json();
        setCache(key, data, TTL.STATIC);
        events = data.events;
      }
    } catch (err) {
      console.warn("[Streaks] bootstrap fetch failed:", err);
    }
  }

  if (!events) return null;

  const current = events.find((e) => e.is_current);
  if (current) return current.id;

  const next = events.find((e) => e.is_next);
  if (next) return next.id > 1 ? next.id - 1 : null;

  return null;
}

const SAFE_COLUMNS = "id, user_id, current_streak, longest_streak, streak_shield_available, season, last_active_gameweek";

async function queryStreak(supabase: any, userId: string, season: string, sport: string) {
  const { data, error } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", userId)
    .eq("season", season)
    .single();

  if (isMissingColumnError(error)) {
    return await supabase
      .from("streaks")
      .select(SAFE_COLUMNS)
      .eq("user_id", userId)
      .eq("season", season)
      .single();
  }

  return { data, error };
}

router.get("/streaks/:user_id", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database unavailable" });
      return;
    }

    const { user_id } = req.params;
    const sport = (req.query.sport as string) || "fpl";
    const season = await getCurrentSeason();

    const { data, error } = await queryStreak(supabase, user_id, season, sport);

    if (error && error.code !== "PGRST116") {
      req.log.error({ err: error }, "Failed to fetch streak");
      res.status(500).json({ error: "Failed to fetch streak" });
      return;
    }

    if (!data) {
      res.json({
        current_streak: 0,
        longest_streak: 0,
        streak_shield_available: false,
        streak_shield_used_gw: null,
        last_active_gameweek: null,
        season,
        sport,
        milestone_reached: null,
      });
      return;
    }

    res.json({
      current_streak: data.current_streak,
      longest_streak: data.longest_streak,
      streak_shield_available: data.streak_shield_available,
      streak_shield_used_gw: data.streak_shield_used_gw ?? null,
      last_active_gameweek: data.last_active_gameweek,
      season: data.season,
      sport: data.sport ?? "fpl",
      milestone_reached: null,
    });
  } catch (err) {
    req.log.error({ err }, "Get streak failed");
    res.status(500).json({ error: "Failed to get streak" });
  }
});

async function findExistingStreak(supabase: any, userId: string, season: string) {
  const { data, error } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", userId)
    .eq("season", season)
    .single();

  if (isMissingColumnError(error)) {
    return await supabase
      .from("streaks")
      .select(SAFE_COLUMNS)
      .eq("user_id", userId)
      .eq("season", season)
      .single();
  }
  return { data, error };
}

function isMissingColumnError(error: any): boolean {
  return error && (error.code === "42703" || error.code === "PGRST204");
}

async function insertStreak(supabase: any, row: Record<string, any>) {
  const { error } = await supabase.from("streaks").insert(row);
  if (isMissingColumnError(error)) {
    const { sport, streak_shield_used_gw, ...safe } = row;
    return supabase.from("streaks").insert(safe);
  }
  return { error };
}

router.post("/streaks/mark-active", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database unavailable" });
      return;
    }

    const { user_id, sport = "fpl" } = req.body;
    if (!user_id) {
      res.status(400).json({ error: "user_id required" });
      return;
    }

    const gameweek = await getCurrentGameweek();
    if (!gameweek) {
      res.status(503).json({ error: "Could not determine current gameweek" });
      return;
    }

    const season = await getCurrentSeason();

    const { data: existing, error: findErr } = await findExistingStreak(supabase, user_id, season);

    if (findErr && findErr.code !== "PGRST116") {
      req.log.error({ err: findErr }, "Failed to find streak");
      res.status(500).json({ error: "Failed to find streak" });
      return;
    }

    if (!existing) {
      const { error } = await insertStreak(supabase, {
        user_id,
        current_streak: 1,
        longest_streak: 1,
        streak_shield_available: false,
        season,
        sport,
        last_active_gameweek: gameweek,
      });

      if (error) {
        req.log.error({ err: error }, "Failed to create streak");
        res.status(500).json({ error: "Failed to create streak" });
        return;
      }

      res.json({
        current_streak: 1,
        longest_streak: 1,
        streak_shield_available: false,
        last_active_gameweek: gameweek,
        streak_updated: true,
        milestone_reached: null,
      });
      return;
    }

    if (existing.last_active_gameweek === gameweek) {
      res.json({
        current_streak: existing.current_streak,
        longest_streak: existing.longest_streak,
        streak_shield_available: existing.streak_shield_available,
        last_active_gameweek: existing.last_active_gameweek,
        streak_updated: false,
        milestone_reached: null,
      });
      return;
    }

    let newStreak = existing.current_streak;
    const lastGw = existing.last_active_gameweek ?? 0;

    if (gameweek === lastGw + 1) {
      newStreak = existing.current_streak + 1;
    } else if (gameweek > lastGw + 1) {
      newStreak = 1;
    }

    const newLongest = Math.max(newStreak, existing.longest_streak);
    let shieldAvailable = existing.streak_shield_available;
    const shieldUsedGw = existing.streak_shield_used_gw ?? null;
    if (newStreak >= 5 && !shieldAvailable && shieldUsedGw !== null) {
      shieldAvailable = true;
    }
    if (newStreak === 5 && !existing.streak_shield_available && shieldUsedGw === null) {
      shieldAvailable = true;
    }

    const milestones = [5, 10, 20, 38];
    const milestone_reached = milestones.includes(newStreak) ? newStreak : null;

    const { error } = await supabase
      .from("streaks")
      .update({
        current_streak: newStreak,
        longest_streak: newLongest,
        streak_shield_available: shieldAvailable,
        last_active_gameweek: gameweek,
      })
      .eq("id", existing.id);

    if (error) {
      req.log.error({ err: error }, "Failed to update streak");
      res.status(500).json({ error: "Failed to update streak" });
      return;
    }

    res.json({
      current_streak: newStreak,
      longest_streak: newLongest,
      streak_shield_available: shieldAvailable,
      last_active_gameweek: gameweek,
      streak_updated: true,
      milestone_reached,
    });
  } catch (err) {
    req.log.error({ err }, "Mark active failed");
    res.status(500).json({ error: "Failed to mark active" });
  }
});

router.post("/streaks/update-all", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database unavailable" });
      return;
    }

    const authHeader = req.headers.authorization;
    const expectedToken = process.env.PROCESS_DECISIONS_SECRET;
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const gameweek = await getCurrentGameweek();
    if (!gameweek) {
      res.status(503).json({ error: "Could not determine current gameweek" });
      return;
    }

    const season = await getCurrentSeason();
    const sport = (req.body.sport as string) || "fpl";

    let allStreaks: any[] | null = null;
    let fetchError: any = null;

    const fullResult = await supabase
      .from("streaks")
      .select("*")
      .eq("season", season);

    if (fullResult.error && fullResult.error.code === "42703") {
      const safeResult = await supabase
        .from("streaks")
        .select("id, user_id, current_streak, longest_streak, streak_shield_available, season, last_active_gameweek")
        .eq("season", season);
      allStreaks = safeResult.data;
      fetchError = safeResult.error;
    } else {
      allStreaks = fullResult.data;
      fetchError = fullResult.error;
    }

    if (fetchError) {
      req.log.error({ err: fetchError }, "Failed to fetch streaks");
      res.status(500).json({ error: "Failed to fetch streaks" });
      return;
    }

    if (!allStreaks || allStreaks.length === 0) {
      res.json({ processed: 0, continued: 0, shielded: 0, broken: 0 });
      return;
    }

    let continued = 0;
    let shielded = 0;
    let broken = 0;

    for (const streak of allStreaks) {
      const lastGw = streak.last_active_gameweek;

      if (lastGw === gameweek) {
        const newStreak = streak.current_streak;
        const newLongest = Math.max(newStreak, streak.longest_streak);
        let shieldAvail = streak.streak_shield_available;

        if (newStreak >= 5 && !shieldAvail) {
          const usedBefore = streak.streak_shield_used_gw !== null;
          if (!usedBefore || newStreak >= 5) {
            shieldAvail = true;
          }
        }

        await supabase
          .from("streaks")
          .update({
            current_streak: newStreak,
            longest_streak: newLongest,
            streak_shield_available: shieldAvail,
          })
          .eq("id", streak.id);

        continued++;
        continue;
      }

      if (lastGw === gameweek - 1) {
        if (streak.streak_shield_available) {
          const shieldUpdate: Record<string, any> = {
            streak_shield_available: false,
          };
          if ("streak_shield_used_gw" in streak) {
            shieldUpdate.streak_shield_used_gw = gameweek;
          }
          await supabase
            .from("streaks")
            .update(shieldUpdate)
            .eq("id", streak.id);
          shielded++;
        } else {
          await supabase
            .from("streaks")
            .update({ current_streak: 0 })
            .eq("id", streak.id);
          broken++;
        }
        continue;
      }

      if (lastGw !== null && lastGw < gameweek - 1) {
        await supabase
          .from("streaks")
          .update({ current_streak: 0 })
          .eq("id", streak.id);
        broken++;
      }
    }

    res.json({
      processed: allStreaks.length,
      continued,
      shielded,
      broken,
      gameweek,
    });
  } catch (err) {
    req.log.error({ err }, "Update all streaks failed");
    res.status(500).json({ error: "Failed to update streaks" });
  }
});

router.post("/streaks/init", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database unavailable" });
      return;
    }

    const { user_id, sport = "fpl" } = req.body;
    if (!user_id) {
      res.status(400).json({ error: "user_id required" });
      return;
    }

    const season = await getCurrentSeason();

    const { data: existing } = await supabase
      .from("streaks")
      .select("id")
      .eq("user_id", user_id)
      .eq("season", season)
      .single();

    if (existing) {
      res.json({ already_exists: true });
      return;
    }

    const { error } = await insertStreak(supabase, {
      user_id,
      current_streak: 0,
      longest_streak: 0,
      streak_shield_available: false,
      season,
      sport,
      last_active_gameweek: null,
    });

    if (error) {
      req.log.error({ err: error }, "Failed to init streak");
      res.status(500).json({ error: "Failed to initialize streak" });
      return;
    }

    res.json({ initialized: true });
  } catch (err) {
    req.log.error({ err }, "Init streak failed");
    res.status(500).json({ error: "Failed to initialize streak" });
  }
});

export default router;
