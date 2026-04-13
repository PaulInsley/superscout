import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthenticatedUserId } from "@/services/auth";

const MANAGER_ID_KEY = "superscout_manager_id";
const TEAM_NAME_KEY = "superscout_team_name";

interface ManagerIdState {
  managerId: number | null;
  teamName: string | null;
  loading: boolean;
  setManager: (id: number, name: string) => Promise<void>;
  clearManager: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useManagerId(): ManagerIdState {
  const [managerId, setManagerId] = useState<number | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    try {
      const [id, name] = await Promise.all([
        AsyncStorage.getItem(MANAGER_ID_KEY),
        AsyncStorage.getItem(TEAM_NAME_KEY),
      ]);
      setManagerId(id ? Number(id) : null);
      setTeamName(name);
    } catch (err) {
      console.warn("[useManagerId] hydrate failed:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const setManager = useCallback(async (id: number, name: string) => {
    setManagerId(id);
    setTeamName(name);

    await AsyncStorage.setItem(MANAGER_ID_KEY, String(id)).catch((err: unknown) => console.warn("[useManagerId] save ID failed:", err));
    await AsyncStorage.setItem(TEAM_NAME_KEY, name).catch((err: unknown) => console.warn("[useManagerId] save name failed:", err));

    try {
      const userId = await getAuthenticatedUserId();
      if (userId) {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        await fetch(`https://${domain}/api/users/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, fpl_manager_id: String(id) }),
        });
      }
    } catch (err) {
      console.warn("[useManagerId] setManager profile sync failed:", err);
    }
  }, []);

  const clearManager = useCallback(async () => {
    setManagerId(null);
    setTeamName(null);

    await AsyncStorage.removeItem(MANAGER_ID_KEY).catch((err: unknown) => console.warn("[useManagerId] remove ID failed:", err));
    await AsyncStorage.removeItem(TEAM_NAME_KEY).catch((err: unknown) => console.warn("[useManagerId] remove name failed:", err));

    try {
      const userId = await getAuthenticatedUserId();
      if (userId) {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        await fetch(`https://${domain}/api/users/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, fpl_manager_id: null }),
        });
      }
    } catch (err) {
      console.warn("[useManagerId] clearManager profile sync failed:", err);
    }
  }, []);

  return { managerId, teamName, loading, setManager, clearManager, refresh: hydrate };
}

export { MANAGER_ID_KEY, TEAM_NAME_KEY };
