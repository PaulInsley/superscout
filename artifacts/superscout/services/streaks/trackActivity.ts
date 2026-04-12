import { supabase } from "@/services/supabase";
import { markActive, type MarkActiveResult } from "./streakService";

export async function trackStreakActivity(
  sport: string = "fpl",
): Promise<MarkActiveResult | null> {
  try {
    let userId = "00000000-0000-0000-0000-000000000000";
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) userId = user.id;
    } catch {}

    return await markActive(userId, sport);
  } catch {
    return null;
  }
}
