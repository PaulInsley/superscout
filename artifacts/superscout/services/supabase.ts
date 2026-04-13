import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const supabaseUrl = Platform.select({
    web: process.env.EXPO_PUBLIC_SUPABASE_URL,
    default: process.env.EXPO_PUBLIC_SUPABASE_URL,
  });

  const supabaseAnonKey = Platform.select({
    web: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    default: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      "[SuperScout] Missing Supabase credentials — check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY",
    );
    return null;
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      if (prop === "from") {
        return () => ({
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
            }),
          }),
          update: () => ({
            eq: () =>
              Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
          }),
          select: () => ({
            single: () =>
              Promise.resolve({ data: null, error: { message: "Supabase not configured" } }),
          }),
        });
      }
      if (prop === "auth") {
        return {
          getUser: () => Promise.resolve({ data: { user: null }, error: null }),
          signUp: () =>
            Promise.resolve({
              data: { user: null },
              error: { message: "Supabase not configured" },
            }),
          signInWithPassword: () =>
            Promise.resolve({
              data: { user: null },
              error: { message: "Supabase not configured" },
            }),
          signOut: () => Promise.resolve({ error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        };
      }
      return undefined;
    }
    const value = (client as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
