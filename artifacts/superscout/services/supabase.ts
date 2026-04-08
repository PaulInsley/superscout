import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = Platform.select({
  web: process.env.EXPO_PUBLIC_SUPABASE_URL,
  default: process.env.EXPO_PUBLIC_SUPABASE_URL,
}) as string;

const supabaseAnonKey = Platform.select({
  web: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  default: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
}) as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[SuperScout] Missing Supabase credentials — check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
