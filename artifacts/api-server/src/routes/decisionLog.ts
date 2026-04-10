import { Router, type Request, type Response } from "express";
import { getSupabase } from "../lib/supabase";

const router = Router();

router.post("/decision-log/recommendation", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { user_id, gameweek, decision_type, options_shown, persona_used, tier_at_time, options } = req.body;

    if (!gameweek || !decision_type || !persona_used) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const { data: rec, error: recError } = await supabase
      .from("recommendations")
      .insert({
        user_id: user_id || "00000000-0000-0000-0000-000000000000",
        gameweek,
        season: "2026-27",
        decision_type,
        options_shown,
        persona_used,
        tier_at_time: tier_at_time || "free",
      })
      .select("id")
      .single();

    if (recError || !rec) {
      req.log.error({ err: recError }, "Failed to insert recommendation");
      res.status(500).json({ error: "Failed to log recommendation" });
      return;
    }

    const recommendationId = rec.id;

    let optionIds: string[] = [];
    if (Array.isArray(options) && options.length > 0) {
      const optionRows = options.map((opt: Record<string, unknown>) => ({
        recommendation_id: recommendationId,
        option_rank: opt.option_rank,
        player_id: opt.player_id ?? null,
        option_type: opt.option_type ?? null,
        expected_points: opt.expected_points ?? null,
        confidence_score: opt.confidence_score ?? null,
        confidence_label: opt.confidence_label,
        upside_text: opt.upside_text ?? null,
        risk_text: opt.risk_text ?? null,
        is_superscout_pick: opt.is_superscout_pick ?? false,
      }));

      const { data: optData, error: optError } = await supabase
        .from("recommendation_options")
        .insert(optionRows)
        .select("id");

      if (optError) {
        req.log.error({ err: optError }, "Failed to insert recommendation_options");
      } else if (optData) {
        optionIds = optData.map((o: { id: string }) => o.id);
      }
    }

    const { error: ctxError } = await supabase
      .from("inference_context")
      .insert({
        recommendation_id: recommendationId,
        engine_level: 1,
        persona_prompt_version: "v1.0",
        model_name: "claude-sonnet-4-6",
        model_provider: "anthropic",
      });

    if (ctxError) {
      req.log.error({ err: ctxError }, "Failed to insert inference_context");
    }

    res.json({ recommendation_id: recommendationId, option_ids: optionIds });
  } catch (error) {
    req.log.error({ err: error }, "Decision log recommendation failed");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/decision-log/decision", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { recommendation_id, recommendation_option_id, user_id, chosen_option, hours_before_deadline } = req.body;

    if (!recommendation_id || !chosen_option) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    let optionId = recommendation_option_id;
    if (!optionId) {
      const { data: opts } = await supabase
        .from("recommendation_options")
        .select("id")
        .eq("recommendation_id", recommendation_id)
        .limit(1);
      optionId = opts?.[0]?.id ?? null;
    }

    const { error } = await supabase.from("user_decisions").insert({
      recommendation_id,
      user_id: user_id || "00000000-0000-0000-0000-000000000000",
      recommendation_option_id: optionId,
      chosen_option,
      hours_before_deadline: hours_before_deadline ?? null,
    });

    if (error) {
      req.log.error({ err: error }, "Failed to insert user_decision");
      res.status(500).json({ error: "Failed to log decision" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    req.log.error({ err: error }, "Decision log decision failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
