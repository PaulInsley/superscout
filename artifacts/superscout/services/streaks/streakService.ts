const getApiBase = () => {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return `https://${domain}/api`;
};

export interface StreakData {
  current_streak: number;
  longest_streak: number;
  streak_shield_available: boolean;
  streak_shield_used_gw: number | null;
  last_active_gameweek: number | null;
  season: string;
  sport: string;
  milestone_reached: number | null;
}

export interface MarkActiveResult extends StreakData {
  streak_updated: boolean;
}

export async function fetchStreak(userId: string, sport: string = "fpl"): Promise<StreakData> {
  const resp = await fetch(`${getApiBase()}/streaks/${userId}?sport=${sport}`);
  if (!resp.ok) throw new Error("Failed to fetch streak");
  return resp.json();
}

export async function markActive(userId: string, sport: string = "fpl"): Promise<MarkActiveResult> {
  const resp = await fetch(`${getApiBase()}/streaks/mark-active`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, sport }),
  });
  if (!resp.ok) throw new Error("Failed to mark active");
  return resp.json();
}

export async function initStreak(userId: string, sport: string = "fpl"): Promise<void> {
  await fetch(`${getApiBase()}/streaks/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, sport }),
  });
}
