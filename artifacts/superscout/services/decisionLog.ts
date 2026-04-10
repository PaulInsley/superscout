import { supabase } from "./supabase";

export interface RecommendationOption {
  option_rank: number;
  player_id?: number | null;
  option_type?: string;
  expected_points?: number | null;
  confidence_score?: number | null;
  confidence_label: "BANKER" | "CALCULATED_RISK" | "BOLD_PUNT";
  upside_text?: string;
  risk_text?: string;
  is_superscout_pick: boolean;
}

export interface LogRecommendationParams {
  user_id: string;
  gameweek: number;
  decision_type: "captain" | "transfer" | "chip_usage" | "lineup";
  options_shown: unknown;
  persona_used: "expert" | "critic" | "fanboy";
  tier_at_time: string;
  options: RecommendationOption[];
}

export async function logRecommendation(
  params: LogRecommendationParams,
): Promise<string | null> {
  try {
    const { data: rec, error: recError } = await supabase
      .from("recommendations")
      .insert({
        user_id: params.user_id,
        gameweek: params.gameweek,
        season: "2026-27",
        decision_type: params.decision_type,
        options_shown: params.options_shown,
        persona_used: params.persona_used,
        tier_at_time: params.tier_at_time,
      })
      .select("id")
      .single();

    if (recError || !rec) {
      console.error("[DecisionLog] Failed to insert recommendation:", recError);
      return null;
    }

    const recommendationId = rec.id;

    const optionRows = params.options.map((opt) => ({
      recommendation_id: recommendationId,
      option_rank: opt.option_rank,
      player_id: opt.player_id ?? null,
      option_type: opt.option_type ?? null,
      expected_points: opt.expected_points ?? null,
      confidence_score: opt.confidence_score ?? null,
      confidence_label: opt.confidence_label,
      upside_text: opt.upside_text ?? null,
      risk_text: opt.risk_text ?? null,
      is_superscout_pick: opt.is_superscout_pick,
    }));

    const { error: optError } = await supabase
      .from("recommendation_options")
      .insert(optionRows);

    if (optError) {
      console.error(
        "[DecisionLog] Failed to insert recommendation_options:",
        optError,
      );
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
      console.error(
        "[DecisionLog] Failed to insert inference_context:",
        ctxError,
      );
    }

    return recommendationId;
  } catch (err) {
    console.error("[DecisionLog] logRecommendation failed silently:", err);
    return null;
  }
}

export interface LogUserDecisionParams {
  recommendation_id: string;
  user_id: string;
  recommendation_option_id: string;
  chosen_option: string;
  hours_before_deadline?: number | null;
}

export async function logUserDecision(
  params: LogUserDecisionParams,
): Promise<void> {
  try {
    const { error } = await supabase.from("user_decisions").insert({
      recommendation_id: params.recommendation_id,
      user_id: params.user_id,
      recommendation_option_id: params.recommendation_option_id,
      chosen_option: params.chosen_option,
      hours_before_deadline: params.hours_before_deadline ?? null,
    });

    if (error) {
      console.error("[DecisionLog] Failed to insert user_decision:", error);
    }
  } catch (err) {
    console.error("[DecisionLog] logUserDecision failed silently:", err);
  }
}
