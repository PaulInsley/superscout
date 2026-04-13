import { Router, type Request, type Response } from "express";
import { getSupabase } from "../lib/supabase";

const router = Router();

router.post("/users/profile", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { user_id, email, fpl_manager_id, default_persona, onboarding_completed, is_beginner, beginner_rounds_completed, beginner_lessons_seen } = req.body;

    if (!user_id) {
      res.status(400).json({ error: "Missing user_id" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (email) updates.email = email;
    if (fpl_manager_id !== undefined) updates.fpl_manager_id = fpl_manager_id === null ? null : String(fpl_manager_id);
    if (default_persona) updates.default_persona = default_persona;
    if (onboarding_completed !== undefined) updates.onboarding_completed = onboarding_completed;
    if (is_beginner !== undefined) updates.is_beginner = is_beginner;
    if (beginner_rounds_completed !== undefined) updates.beginner_rounds_completed = beginner_rounds_completed;
    if (beginner_lessons_seen !== undefined) updates.beginner_lessons_seen = beginner_lessons_seen;

    const { error } = await supabase.from("users").upsert(
      { id: user_id, ...updates },
      { onConflict: "id" },
    );

    if (error) {
      req.log.error({ err: error, user_id }, "User profile upsert failed");
      res.status(500).json({ error: "Failed to create user profile" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "User profile creation failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
