import { Router, type Request, type Response } from "express";
import { getSupabase } from "../lib/supabase";
import { getCached, cacheKey, TTL } from "../lib/fplCache";
import { fetchFromFpl } from "../lib/fplRateLimiter";

const router = Router();

type NotificationType =
  | "deadline_reminder"
  | "post_gw_results"
  | "price_change"
  | "streak_at_risk";
type Vibe = "expert" | "critic" | "fanboy";

const MAX_PER_GW = 3;

const PRIORITY_ORDER: NotificationType[] = [
  "deadline_reminder",
  "price_change",
  "streak_at_risk",
  "post_gw_results",
];

interface NotificationTemplate {
  title: string;
  body: string;
}

const TEMPLATES: Record<
  NotificationType,
  Record<Vibe, (vars: Record<string, string | number>) => NotificationTemplate>
> = {
  deadline_reminder: {
    expert: () => ({
      title: "Deadline approaching",
      body: "Deadline in 2 hours. Your options are ready \u2014 the data supports a clear top pick this week.",
    }),
    critic: () => ({
      title: "Deadline approaching",
      body: "2 hours left. Still haven\u2019t made your moves? Bold strategy.",
    }),
    fanboy: () => ({
      title: "DEADLINE ALERT!",
      body: "DEADLINE ALERT! Let\u2019s lock in those picks \u2014 this could be YOUR week!",
    }),
  },
  post_gw_results: {
    expert: (v) => ({
      title: `GW${v.gameweek} Results`,
      body: `GW${v.gameweek} results are in. ${v.points} points. Open SuperScout for the full breakdown.`,
    }),
    critic: (v) => ({
      title: `GW${v.gameweek} Results`,
      body: `GW${v.gameweek} done. ${v.points} points. Could\u2019ve been better. Want to know how?`,
    }),
    fanboy: (v) => ({
      title: `GW${v.gameweek} Results`,
      body: `${v.points} POINTS! GW${v.gameweek} is done \u2014 let\u2019s see how you did!`,
    }),
  },
  price_change: {
    expert: (v) => ({
      title: "Price Alert",
      body: `Price alert: ${v.player} is expected to fall tonight. Your sell price drops \u00A30.1m if you hold.`,
    }),
    critic: (v) => ({
      title: "Price Alert",
      body: `${v.player} is losing value tonight. Don\u2019t say I didn\u2019t warn you.`,
    }),
    fanboy: (v) => ({
      title: "Price Alert",
      body: `Heads up \u2014 ${v.player} might drop in price tonight. Quick transfer time?`,
    }),
  },
  streak_at_risk: {
    expert: (v) => ({
      title: "Streak at Risk",
      body: `Your ${v.streak}-gameweek streak is at risk. Open SuperScout to keep it alive.`,
    }),
    critic: (v) => ({
      title: "Streak at Risk",
      body: `About to lose your ${v.streak}-week streak. Typical.`,
    }),
    fanboy: (v) => ({
      title: "Streak at Risk",
      body: `Don\u2019t break the streak! ${v.streak} weeks strong \u2014 keep it going!`,
    }),
  },
};

interface BootstrapData {
  events: Array<{
    id: number;
    is_current: boolean;
    is_next: boolean;
    finished: boolean;
    deadline_time: string;
  }>;
}

async function fetchCachedData<T>(key: string, path: string, ttl: number): Promise<T> {
  const cached = getCached(key);
  if (cached) return cached as T;
  return (await fetchFromFpl(path, key, ttl)) as T;
}

async function getNotificationCount(
  userId: string,
  gameweek: number,
): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;

  const { count } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("gameweek", gameweek);

  return count ?? 0;
}

async function hasUserActedThisGw(
  userId: string,
  gameweek: number,
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { count } = await supabase
    .from("recommendations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("gameweek", gameweek);

  return (count ?? 0) > 0;
}

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: "default",
        data: data ?? {},
      }),
    });
    const result = await res.json();
    return result?.data?.status === "ok";
  } catch {
    return false;
  }
}

router.post("/notifications/register-token", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { user_id, token } = req.body;
    if (!user_id || !token) {
      res.status(400).json({ error: "Missing user_id or token" });
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({ push_notification_token: token })
      .eq("id", user_id);

    if (error) {
      req.log.error({ err: error }, "Failed to save push token");
      res.status(500).json({ error: "Failed to save token" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Register token failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/notifications/send", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const {
      user_id,
      notification_type,
      gameweek,
      vars = {},
    } = req.body as {
      user_id: string;
      notification_type: NotificationType;
      gameweek: number;
      vars?: Record<string, string | number>;
    };

    if (!user_id || !notification_type || !gameweek) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (!TEMPLATES[notification_type]) {
      res.status(400).json({ error: "Invalid notification type" });
      return;
    }

    const sentCount = await getNotificationCount(user_id, gameweek);
    if (sentCount >= MAX_PER_GW) {
      res.json({
        sent: false,
        reason: "max_per_gw_reached",
        count: sentCount,
      });
      return;
    }

    const { data: user } = await supabase
      .from("users")
      .select("push_notification_token, default_persona, notification_preferences")
      .eq("id", user_id)
      .single();

    if (!user?.push_notification_token) {
      res.json({ sent: false, reason: "no_push_token" });
      return;
    }

    const prefs = (user.notification_preferences ?? {}) as Record<string, boolean>;
    if (prefs[notification_type] === false) {
      res.json({ sent: false, reason: "disabled_by_user" });
      return;
    }

    if (notification_type === "deadline_reminder" || notification_type === "streak_at_risk") {
      const acted = await hasUserActedThisGw(user_id, gameweek);
      if (acted) {
        res.json({ sent: false, reason: "user_already_acted" });
        return;
      }
    }

    const vibe: Vibe = (user.default_persona as Vibe) ?? "expert";
    const template = TEMPLATES[notification_type][vibe](vars);

    const pushSent = await sendExpoPush(
      user.push_notification_token,
      template.title,
      template.body,
      { type: notification_type, gameweek },
    );

    const { error: logErr } = await supabase.from("notification_log").insert({
      user_id,
      notification_type,
      gameweek,
      title: template.title,
      body: template.body,
    });

    if (logErr) {
      req.log.error({ err: logErr }, "Failed to log notification");
    }

    res.json({
      sent: pushSent,
      title: template.title,
      body: template.body,
      vibe,
      notifications_this_gw: sentCount + 1,
    });
  } catch (err) {
    req.log.error({ err }, "Send notification failed");
    res.status(500).json({ error: "Failed to send notification" });
  }
});

router.post("/notifications/send-batch", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { notification_type, gameweek, vars = {} } = req.body as {
      notification_type: NotificationType;
      gameweek: number;
      vars?: Record<string, string | number>;
    };

    if (!notification_type || !gameweek) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const { data: users } = await supabase
      .from("users")
      .select("id, push_notification_token, default_persona, notification_preferences")
      .not("push_notification_token", "is", null);

    if (!users || users.length === 0) {
      res.json({ sent: 0, skipped: 0 });
      return;
    }

    let sent = 0;
    let skipped = 0;

    for (const user of users) {
      const prefs = (user.notification_preferences ?? {}) as Record<string, boolean>;
      if (prefs[notification_type] === false) {
        skipped++;
        continue;
      }

      const count = await getNotificationCount(user.id, gameweek);
      if (count >= MAX_PER_GW) {
        skipped++;
        continue;
      }

      if (notification_type === "deadline_reminder" || notification_type === "streak_at_risk") {
        const acted = await hasUserActedThisGw(user.id, gameweek);
        if (acted) {
          skipped++;
          continue;
        }
      }

      const vibe: Vibe = (user.default_persona as Vibe) ?? "expert";
      const template = TEMPLATES[notification_type][vibe](vars);

      const ok = await sendExpoPush(
        user.push_notification_token,
        template.title,
        template.body,
        { type: notification_type, gameweek },
      );

      if (ok) {
        sent++;
        await supabase.from("notification_log").insert({
          user_id: user.id,
          notification_type,
          gameweek,
          title: template.title,
          body: template.body,
        });
      } else {
        skipped++;
      }
    }

    res.json({ sent, skipped, total: users.length });
  } catch (err) {
    req.log.error({ err }, "Batch send failed");
    res.status(500).json({ error: "Batch send failed" });
  }
});

router.get("/notifications/preferences/:user_id", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { user_id } = req.params;

    const { data, error } = await supabase
      .from("users")
      .select("notification_preferences")
      .eq("id", user_id)
      .single();

    if (error || !data) {
      res.json({
        preferences: {
          deadline_reminder: true,
          post_gw_results: true,
          price_change: true,
          streak_at_risk: true,
        },
      });
      return;
    }

    res.json({ preferences: data.notification_preferences ?? {
      deadline_reminder: true,
      post_gw_results: true,
      price_change: true,
      streak_at_risk: true,
    }});
  } catch (err) {
    req.log.error({ err }, "Get preferences failed");
    res.status(500).json({ error: "Failed to get preferences" });
  }
});

router.put("/notifications/preferences", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { user_id, preferences } = req.body;
    if (!user_id || !preferences) {
      res.status(400).json({ error: "Missing user_id or preferences" });
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({ notification_preferences: preferences })
      .eq("id", user_id);

    if (error) {
      req.log.error({ err: error }, "Failed to update preferences");
      res.status(500).json({ error: "Failed to update preferences" });
      return;
    }

    res.json({ success: true, preferences });
  } catch (err) {
    req.log.error({ err }, "Update preferences failed");
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

router.get("/notifications/schedule-info", async (req: Request, res: Response) => {
  try {
    const bootstrap = await fetchCachedData<BootstrapData>(
      cacheKey("bootstrap-static"),
      "/bootstrap-static/",
      TTL.STATIC,
    );

    const nextEvent = bootstrap.events.find((e) => e.is_next);
    const currentEvent = bootstrap.events.find((e) => e.is_current);

    const deadlineEvent = nextEvent ?? currentEvent;
    const deadlineTime = deadlineEvent?.deadline_time
      ? new Date(deadlineEvent.deadline_time)
      : null;

    const reminderTime = deadlineTime
      ? new Date(deadlineTime.getTime() - 2 * 60 * 60 * 1000)
      : null;

    res.json({
      gameweek: deadlineEvent?.id ?? null,
      deadline: deadlineTime?.toISOString() ?? null,
      deadline_reminder_trigger: reminderTime?.toISOString() ?? null,
      post_gw_results_trigger: "Monday 09:00 BST",
      price_change_trigger: "Daily 03:00 BST",
      streak_at_risk_trigger: "Thursday 18:00 BST",
    });
  } catch (err) {
    req.log.error({ err }, "Schedule info failed");
    res.status(500).json({ error: "Failed to get schedule info" });
  }
});

router.get("/notifications/log/:user_id", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { user_id } = req.params;
    const { gameweek } = req.query;

    let query = supabase
      .from("notification_log")
      .select("*")
      .eq("user_id", user_id)
      .order("sent_at", { ascending: false })
      .limit(20);

    if (gameweek) {
      query = query.eq("gameweek", Number(gameweek));
    }

    const { data, error } = await query;

    if (error) {
      req.log.error({ err: error }, "Failed to fetch notification log");
      res.status(500).json({ error: "Failed to fetch log" });
      return;
    }

    res.json({ notifications: data ?? [] });
  } catch (err) {
    req.log.error({ err }, "Notification log fetch failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
