import { z } from "zod";

export const banterLeaguesSchema = z.object({
  user_id: z.string().uuid(),
  leagues: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string(),
    rank: z.number().optional(),
    rival_ids: z.array(z.number()).optional(),
  })).max(3, "Maximum 3 leagues allowed"),
});
