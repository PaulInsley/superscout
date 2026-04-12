export type NotificationType =
  | "deadline_reminder"
  | "post_gw_results"
  | "price_change"
  | "streak_at_risk";

export type Vibe = "expert" | "critic" | "fanboy";

export interface NotificationTemplate {
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
      body: "Deadline in 2 hours. Your options are ready — the data supports a clear top pick this week.",
    }),
    critic: () => ({
      title: "Deadline approaching",
      body: "2 hours left. Still haven't made your moves? Bold strategy.",
    }),
    fanboy: () => ({
      title: "DEADLINE ALERT!",
      body: "DEADLINE ALERT! Let's lock in those picks — this could be YOUR week!",
    }),
  },

  post_gw_results: {
    expert: (vars) => ({
      title: `GW${vars.gameweek} Results`,
      body: `GW${vars.gameweek} results are in. ${vars.points} points. Open SuperScout for the full breakdown.`,
    }),
    critic: (vars) => ({
      title: `GW${vars.gameweek} Results`,
      body: `GW${vars.gameweek} done. ${vars.points} points. Could've been better. Want to know how?`,
    }),
    fanboy: (vars) => ({
      title: `GW${vars.gameweek} Results`,
      body: `${vars.points} POINTS! GW${vars.gameweek} is done — let's see how you did!`,
    }),
  },

  price_change: {
    expert: (vars) => ({
      title: "Price Alert",
      body: `Price alert: ${vars.player} is expected to fall tonight. Your sell price drops £0.1m if you hold.`,
    }),
    critic: (vars) => ({
      title: "Price Alert",
      body: `${vars.player} is losing value tonight. Don't say I didn't warn you.`,
    }),
    fanboy: (vars) => ({
      title: "Price Alert",
      body: `Heads up — ${vars.player} might drop in price tonight. Quick transfer time?`,
    }),
  },

  streak_at_risk: {
    expert: (vars) => ({
      title: "Streak at Risk",
      body: `Your ${vars.streak}-gameweek streak is at risk. Open SuperScout to keep it alive.`,
    }),
    critic: (vars) => ({
      title: "Streak at Risk",
      body: `About to lose your ${vars.streak}-week streak. Typical.`,
    }),
    fanboy: (vars) => ({
      title: "Streak at Risk",
      body: `Don't break the streak! ${vars.streak} weeks strong — keep it going!`,
    }),
  },
};

export const NOTIFICATION_PRIORITY: NotificationType[] = [
  "deadline_reminder",
  "price_change",
  "streak_at_risk",
  "post_gw_results",
];

export const MAX_NOTIFICATIONS_PER_GW = 3;

export function getNotificationTemplate(
  type: NotificationType,
  vibe: Vibe,
  vars: Record<string, string | number> = {},
): NotificationTemplate {
  return TEMPLATES[type][vibe](vars);
}

export interface SkipCheckContext {
  userHasActedThisGw: boolean;
  userHasStreak: boolean;
  streakCount: number;
  alreadyTransferredPlayer?: boolean;
}

export function shouldSkipNotification(
  type: NotificationType,
  ctx: SkipCheckContext,
): boolean {
  switch (type) {
    case "deadline_reminder":
      return ctx.userHasActedThisGw;
    case "post_gw_results":
      return false;
    case "price_change":
      return ctx.alreadyTransferredPlayer ?? false;
    case "streak_at_risk":
      return ctx.userHasActedThisGw;
    default:
      return false;
  }
}
