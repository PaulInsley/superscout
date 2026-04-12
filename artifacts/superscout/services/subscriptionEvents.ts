import { supabase } from "./supabase";
import { getAuthenticatedUserId } from "./auth";
import { Platform } from "react-native";

export type SubscriptionEventType =
  | "signup"
  | "upgrade"
  | "downgrade"
  | "cancel"
  | "expired"
  | "resubscribe";

export type SubscriptionTier = "free" | "pro_monthly" | "season_pass";

interface LogSubscriptionEventParams {
  eventType: SubscriptionEventType;
  fromTier: SubscriptionTier;
  toTier: SubscriptionTier;
  gameweek?: number | null;
}

function getPlatformSource(): "app_store" | "google_play" | "web_stripe" {
  if (Platform.OS === "ios") return "app_store";
  if (Platform.OS === "android") return "google_play";
  return "web_stripe";
}

export async function logSubscriptionEvent({
  eventType,
  fromTier,
  toTier,
  gameweek,
}: LogSubscriptionEventParams) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return;
    }
    const { error } = await supabase.from("subscription_events").insert({
      user_id: userId,
      event_type: eventType,
      tier_from: fromTier,
      tier_to: toTier,
      source: getPlatformSource(),
      gameweek: gameweek ?? null,
    });

    if (error) {
      console.error("[SuperScout] Failed to log subscription event:", error);
    }
  } catch (err) {
    console.error("[SuperScout] Subscription event logging error:", err);
  }
}

export async function updateUserSubscriptionTier(tier: string) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return;
    }
    const { error } = await supabase
      .from("users")
      .update({ subscription_tier: tier === "free" ? "free" : tier === "season_pass" ? "season_pass" : "pro" })
      .eq("id", userId);

    if (error) {
      console.error("[SuperScout] Failed to update user subscription tier:", error);
    }
  } catch (err) {
    console.error("[SuperScout] User tier update error:", err);
  }
}
