import { getAuthenticatedUserId } from "@/services/auth";
import { markActive, type MarkActiveResult } from "./streakService";

export async function trackStreakActivity(sport: string = "fpl"): Promise<MarkActiveResult | null> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) return null;

    return await markActive(userId, sport);
  } catch (err) {
    console.warn("[trackActivity] failed:", err);
    return null;
  }
}
