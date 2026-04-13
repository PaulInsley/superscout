import { z } from "zod";

export const registerTokenSchema = z.object({
  user_id: z.string().uuid(),
  token: z.string().min(1, "Token is required"),
});

export const sendNotificationSchema = z.object({
  user_id: z.string().uuid(),
  notification_type: z.enum(["deadline_reminder", "post_gw_results", "price_change", "streak_at_risk"]),
  gameweek: z.number({ coerce: true }).int().min(1).max(50),
  vars: z.record(z.union([z.string(), z.number()])).optional().default({}),
});

export const sendBatchSchema = z.object({
  notification_type: z.enum(["deadline_reminder", "post_gw_results", "price_change", "streak_at_risk"]),
  gameweek: z.number({ coerce: true }).int().min(1).max(50),
  vars: z.record(z.union([z.string(), z.number()])).optional().default({}),
});

export const updatePreferencesSchema = z.object({
  user_id: z.string().uuid(),
  preferences: z.object({
    deadline_reminder: z.boolean().optional(),
    post_gw_results: z.boolean().optional(),
    price_change: z.boolean().optional(),
    streak_at_risk: z.boolean().optional(),
  }),
});
