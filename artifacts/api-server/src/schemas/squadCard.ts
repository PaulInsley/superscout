import { z } from "zod";

export const squadCardGenerateSchema = z.object({
  manager_id: z.number({ coerce: true }).int().positive(),
  gameweek: z.number({ coerce: true }).int().min(1).max(50).optional(),
  vibe: z.enum(["expert", "critic", "fanboy"]).optional().default("expert"),
});

export const squadCardShareSchema = z.object({
  card_id: z.string().uuid().optional(),
  gameweek: z.number({ coerce: true }).int().min(1).max(50).optional(),
  platform: z.string().optional(),
  user_id: z.string().uuid(),
});
