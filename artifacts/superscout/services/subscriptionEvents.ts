import { supabase } from "./supabase";
import { Platform } from "react-native";

export type SubscriptionEventType =
  | "initial_purchase"
  | "renewal"
  | "cancellation"
  | "expiration"
  | "resubscribe"
  | "upgrade"
  | "downgrade";

export type SubscriptionTier = "free" | "pro_monthly" | "season_pass";

interface LogSubscriptionEventParams {
  eventType: SubscriptionEventType;
  fromTier: SubscriptionTier;
  toTier: SubscriptionTier;
  gameweek?: number | null;
}

export async function logSubscriptionEvent({
  eventType,
  fromTier,
  toTier,
  gameweek,
}: LogSubscriptionEventParams) {
  try {
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";

    const { error } = await supabase.from("subscription_events").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      event_type: eventType,
      from_tier: fromTier,
      to_tier: toTier,
      platform,
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
    const { error } = await supabase
      .from("users")
      .update({ subscription_tier: tier === "free" ? "free" : tier === "season_pass" ? "season_pass" : "pro" })
      .eq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      console.error("[SuperScout] Failed to update user subscription tier:", error);
    }
  } catch (err) {
    console.error("[SuperScout] User tier update error:", err);
  }
}
