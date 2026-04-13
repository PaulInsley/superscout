import { z } from "zod";

export const userProfileSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email().optional(),
  fpl_manager_id: z.union([z.number({ coerce: true }), z.null()]).optional(),
  default_persona: z.enum(["expert", "critic", "fanboy"]).optional(),
  onboarding_completed: z.boolean().optional(),
  is_beginner: z.boolean().optional(),
  beginner_rounds_completed: z.number().optional(),
  beginner_lessons_seen: z.array(z.string()).optional(),
});
