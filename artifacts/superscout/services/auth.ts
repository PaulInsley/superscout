import * as Sentry from "@sentry/react-native";
import { supabase } from "./supabase";

export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      Sentry.setUser({ id: session.user.id, email: session.user.email });
      return session.user.id;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      Sentry.setUser({ id: user.id, email: user.email });
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
    await supabase.auth.signOut();
    Sentry.setUser(null);
  } catch (err) {
    console.warn("[Auth] signOut failed:", err);
  }
}
