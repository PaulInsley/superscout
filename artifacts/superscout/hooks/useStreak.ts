import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthenticatedUserId } from "@/services/auth";
import {
  fetchStreak,
  markActive,
  type StreakData,
  type MarkActiveResult,
} from "@/services/streaks/streakService";

const STREAK_CACHE_KEY = "superscout_streak_cache";
const MILESTONE_SHOWN_KEY = "superscout_milestone_shown";
const SHIELD_USED_SHOWN_KEY = "superscout_shield_used_shown";

export function useStreak(sport: string = "fpl") {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingMilestone, setPendingMilestone] = useState<number | null>(null);
  const [shieldJustUsed, setShieldJustUsed] = useState(false);

  const getUserId = useCallback(async (): Promise<string | null> => {
    return await getAuthenticatedUserId();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const userId = await getUserId();
      if (!userId) { setLoading(false); return; }
      const data = await fetchStreak(userId, sport);
      setStreak(data);
      await AsyncStorage.setItem(STREAK_CACHE_KEY, JSON.stringify(data));
    } catch {
      try {
        const cached = await AsyncStorage.getItem(STREAK_CACHE_KEY);
        if (cached) setStreak(JSON.parse(cached));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [getUserId, sport]);

  const recordActivity = useCallback(async (): Promise<MarkActiveResult | null> => {
    try {
      const userId = await getUserId();
      if (!userId) return null;
      const result = await markActive(userId, sport);
      setStreak({
        current_streak: result.current_streak,
        longest_streak: result.longest_streak,
        streak_shield_available: result.streak_shield_available,
        streak_shield_used_gw: streak?.streak_shield_used_gw ?? null,
        last_active_gameweek: result.last_active_gameweek,
        season: streak?.season ?? "",
        sport,
        milestone_reached: result.milestone_reached,
      });

      if (result.milestone_reached) {
        const shownKey = `${MILESTONE_SHOWN_KEY}_${result.milestone_reached}_${sport}`;
        const alreadyShown = await AsyncStorage.getItem(shownKey);
        if (!alreadyShown) {
          setPendingMilestone(result.milestone_reached);
        }
      }

      return result;
    } catch {
      return null;
    }
  }, [getUserId, sport, streak]);

  const dismissMilestone = useCallback(async () => {
    if (pendingMilestone) {
      const shownKey = `${MILESTONE_SHOWN_KEY}_${pendingMilestone}_${sport}`;
      await AsyncStorage.setItem(shownKey, "true");
    }
    setPendingMilestone(null);
  }, [pendingMilestone, sport]);

  const dismissShieldUsed = useCallback(async () => {
    const key = `${SHIELD_USED_SHOWN_KEY}_${sport}`;
    await AsyncStorage.setItem(key, "true");
    setShieldJustUsed(false);
  }, [sport]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (streak && streak.streak_shield_used_gw !== null && !streak.streak_shield_available) {
      const checkShieldNotification = async () => {
        const key = `${SHIELD_USED_SHOWN_KEY}_${sport}_gw${streak.streak_shield_used_gw}`;
        const shown = await AsyncStorage.getItem(key);
        if (!shown) {
          setShieldJustUsed(true);
        }
      };
      checkShieldNotification();
    }
  }, [streak, sport]);

  return {
    streak,
    loading,
    pendingMilestone,
    shieldJustUsed,
    refresh,
    recordActivity,
    dismissMilestone,
    dismissShieldUsed,
  };
}
