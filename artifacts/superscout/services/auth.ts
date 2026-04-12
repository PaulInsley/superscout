import { supabase } from "./supabase";

export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function signUp(
  email: string,
  password: string,
): Promise<{ userId: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { userId: null, error: error.message };
    return { userId: data.user?.id ?? null, error: null };
  } catch (e: any) {
    return { userId: null, error: e?.message ?? "Sign up failed" };
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

export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {}
}
