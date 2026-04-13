import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { getSupabase } from "./supabase";

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
    const userClient = getUserSupabase(token);
    if (userClient) return userClient;
  }
  if (req.log) {
    req.log.warn(
      { path: req.path },
      "[supabaseUser] No auth token — falling back to service-role client. Add Authorization header for RLS enforcement.",
    );
  }
  return getSupabase();
}
