import { z } from "zod";

export const captainPicksSchema = z.object({
  vibe: z.enum(["expert", "critic", "fanboy"]),
  user_id: z.string().uuid().optional(),
  skip_cache: z.boolean().optional().default(false),
  context: z.string().min(1, "Context is required").max(50000),
});
