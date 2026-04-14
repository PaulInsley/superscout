import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";

export function getUserSupabase(accessToken: string): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

export function getSupabaseForRequest(req: Request): SupabaseClient | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return getUserSupabase(token);
  }
  return null;
}
