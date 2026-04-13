import { z } from "zod";

export const transferAdviceSchema = z.object({
  manager_id: z.number({ coerce: true }).int().positive(),
  vibe: z.enum(["expert", "critic", "fanboy"]),
  skip_cache: z.boolean().optional().default(false),
});
