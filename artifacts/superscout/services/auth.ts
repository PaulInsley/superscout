import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import { supabase } from "./supabase";

const DEVICE_GLOBAL_KEYS = new Set([
  "supabase.auth.token",
  "supabase-auth-token",
]);

export async function clearUserStorage(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToRemove = allKeys.filter(
      (k) =>
        (k.startsWith("superscout_") ||
          k.startsWith("pulse_check") ||
          k === "notification_consent_shown") &&
        !DEVICE_GLOBAL_KEYS.has(k),
    );
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch (err) {
    console.warn("[Auth] clearUserStorage failed:", err);
  }
}

export async function loadUserProfile(userId: string): Promise<void> {
  try {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return;
    const apiBase = `https://${domain}/api`;

    const res = await fetch(`${apiBase}/users/profile/${userId}`);
    if (!res.ok) {
      console.warn("[Auth] loadUserProfile: no profile found, status", res.status);
      return;
    }

    const { profile } = await res.json();
    if (!profile) return;

    const pairs: [string, string][] = [];
    if (profile.fpl_manager_id) {
      pairs.push(["superscout_manager_id", String(profile.fpl_manager_id)]);
    }
    if (profile.default_persona) {
      pairs.push(["superscout_persona", profile.default_persona]);
    }
    if (profile.onboarding_completed) {
      pairs.push(["superscout_onboarding_complete", "true"]);
    }

    if (pairs.length > 0) {
      await AsyncStorage.multiSet(pairs);
    }

    if (profile.fpl_manager_id) {
      try {
        const entryRes = await fetch(`${apiBase}/fpl/entry/${profile.fpl_manager_id}`);
        if (entryRes.ok) {
          const entryData = await entryRes.json();
          const teamName = entryData?.name;
          if (teamName) {
            await AsyncStorage.setItem("superscout_team_name", teamName);
          }
        }
      } catch (err) {
        console.warn("[Auth] loadUserProfile: team name fetch failed:", err);
      }
    }

    console.log("[Auth] User profile loaded into AsyncStorage for", userId);
  } catch (err) {
    console.warn("[Auth] loadUserProfile failed:", err);
  }
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      Sentry.setUser({ id: session.user.id });
      return session.user.id;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      Sentry.setUser({ id: user.id });
    }
    return user?.id ?? null;
  } catch (err) {
    console.warn("[Auth] getAuthenticatedUserId failed:", err);
    return null;
  }
}

export async function signUp(
  email: string,
  password: string,
): Promise<{ userId: string | null; error: string | null; needsVerification: boolean }> {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { userId: null, error: error.message, needsVerification: false };
    const hasSession = !!data.session;
    return { userId: data.user?.id ?? null, error: null, needsVerification: !hasSession };
  } catch (e: any) {
    return { userId: null, error: e?.message ?? "Sign up failed", needsVerification: false };
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ userId: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { userId: null, error: error.message };
    return { userId: data.user?.id ?? null, error: null };
  } catch (e: any) {
    return { userId: null, error: e?.message ?? "Sign in failed" };
  }
}

export async function resetPassword(email: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e?.message ?? "Password reset failed" };
  }
}

export async function signOut(): Promise<void> {
  try {
    await clearUserStorage();
    await supabase.auth.signOut();
    Sentry.setUser(null);
  } catch (err) {
    console.warn("[Auth] signOut failed:", err);
  }
}
