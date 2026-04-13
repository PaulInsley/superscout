import { z } from "zod";

export const reportCardGenerateSchema = z.object({
  manager_id: z.number({ coerce: true }).int().positive(),
  vibe: z.enum(["expert", "critic", "fanboy"]).optional().default("expert"),
});
