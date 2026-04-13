import { Router, type Request, type Response } from "express";
import { getSupabase } from "../lib/supabase";
import { getCached, getStale, setCache, cacheKey, TTL } from "../lib/fplCache";

const router = Router();

interface FPLElement {
  id: number;
  first_name: string;
  second_name: string;
  web_name: string;
  team: number;
}

interface FPLTeam {
  id: number;
  short_name: string;
  name: string;
}

interface BootstrapData {
  elements: FPLElement[];
  teams: FPLTeam[];
}

async function getBootstrapData(): Promise<{ elements: FPLElement[]; teamMap: Map<string, number> }> {
  const key = cacheKey("bootstrap-static");
  let data: BootstrapData | null = null;

  const cached = getCached<BootstrapData>(key);
  if (cached) {
    data = cached.data;
  } else {
    const stale = getStale<BootstrapData>(key);
    if (stale) {
      data = stale.data;
    }
  }

  if (!data) {
    try {
      const resp = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
      if (resp.ok) {
        data = await resp.json() as BootstrapData;
        setCache(key, data, TTL.STATIC);
      }
    } catch {
    }
  }

  if (!data) return { elements: [], teamMap: new Map() };

  const teamMap = new Map<string, number>();
  if (data.teams) {
    for (const t of data.teams) {
      teamMap.set(t.short_name.toUpperCase(), t.id);
    }
  }

  return { elements: data.elements, teamMap };
}

function findPlayerId(name: string, elements: FPLElement[], teamShortName?: string, teamMap?: Map<string, number>): number | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();

  const teamId = teamShortName && teamMap ? teamMap.get(teamShortName.toUpperCase()) ?? null : null;

  const bySecondName = elements.filter(
    (e) => e.second_name.toLowerCase() === lower
  );
  if (bySecondName.length === 1) return bySecondName[0].id;
  if (bySecondName.length > 1 && teamId) {
    const teamMatch = bySecondName.find((e) => e.team === teamId);
    if (teamMatch) return teamMatch.id;
  }
  if (bySecondName.length > 1) return bySecondName[0].id;

  const byWebName = elements.filter(
    (e) => e.web_name.toLowerCase() === lower
  );
  if (byWebName.length === 1) return byWebName[0].id;
  if (byWebName.length > 1 && teamId) {
    const teamMatch = byWebName.find((e) => e.team === teamId);
    if (teamMatch) return teamMatch.id;
  }
  if (byWebName.length > 1) return byWebName[0].id;

  const byFullName = elements.find(
    (e) =>
      `${e.first_name} ${e.second_name}`.toLowerCase() === lower
  );
  if (byFullName) return byFullName.id;

  let partialMatches = elements.filter(
    (e) => e.second_name.toLowerCase().includes(lower) || e.second_name.toLowerCase().endsWith(lower)
  );
  if (partialMatches.length > 1 && teamId) {
    const teamMatch = partialMatches.find((e) => e.team === teamId);
    if (teamMatch) return teamMatch.id;
  }
  if (partialMatches.length === 1) return partialMatches[0].id;

  return null;
}

function resolvePlayerIdForOption(
  optionShown: Record<string, unknown> | undefined,
  optionType: string | null,
  elements: FPLElement[],
  teamMap: Map<string, number>
): number | null {
  if (!optionShown) return null;

  if (optionType === "captain_pick") {
    const playerName = optionShown.player_name as string | undefined;
    const team = optionShown.team as string | undefined;
    if (playerName) return findPlayerId(playerName, elements, team, teamMap);
    return null;
  }

  if (optionType === "hold") return null;

  if (optionType === "package") {
    const transfers = optionShown.transfers as Array<{ player_in?: string; team_in?: string }> | undefined;
    if (transfers && transfers.length > 0 && transfers[0].player_in) {
      return findPlayerId(transfers[0].player_in, elements, transfers[0].team_in, teamMap);
    }
    return null;
  }

  if (optionType === "transfer") {
    const playerIn = optionShown.player_in as string | undefined;
    const teamIn = optionShown.team_in as string | undefined;
    if (playerIn) return findPlayerId(playerIn, elements, teamIn, teamMap);
    return null;
  }

  return null;
}

function getPlayerDisplayName(
  optionShown: Record<string, unknown> | undefined,
  optionType: string | null,
): string {
  if (!optionShown) return "unknown";

  if (optionType === "captain_pick") {
    return (optionShown.player_name as string) ?? "unknown";
  }

  if (optionType === "hold") return "hold";

  if (optionType === "package") {
    return (optionShown.package_name as string) ?? "package";
  }

  if (optionType === "transfer") {
    return (optionShown.player_in as string) ?? "unknown";
  }

  return "unknown";
}

router.post("/decision-log/recommendation", async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    const { user_id, gameweek, decision_type, options_shown, persona_used, tier_at_time, options } = req.body;

    if (!user_id || !gameweek || !decision_type || !persona_used) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const { elements, teamMap } = await getBootstrapData();
    const optionsShownArray = Array.isArray(options_shown) ? options_shown : [];
    const optionsArray = Array.isArray(options) ? options : [];

    const confidenceLevels = optionsArray.map((opt: Record<string, unknown>, i: number) => {
      const optionType = (opt.option_type as string) ?? null;
      const shown = optionsShownArray[i] as Record<string, unknown> | undefined;
      return {
        player: getPlayerDisplayName(shown, optionType),
        confidence: opt.confidence_score ?? 0,
        label: opt.confidence_label ?? "UNKNOWN",
      };
    });

    const { data: rec, error: recError } = await supabase
      .from("recommendations")
      .insert({
        user_id: user_id,
        gameweek,
        season: "2026-27",
        decision_type,
        options_shown,
        persona_used,
        tier_at_time: tier_at_time || "free",
        confidence_levels: confidenceLevels.length > 0 ? confidenceLevels : null,
        data_sources_used: ["fpl_api", "ai_knowledge"],
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
    if (optionsArray.length > 0) {
      const optionRows = optionsArray.map((opt: Record<string, unknown>, i: number) => {
        const optionType = (opt.option_type as string) ?? null;
        const shown = optionsShownArray[i] as Record<string, unknown> | undefined;
        const playerId = resolvePlayerIdForOption(shown, optionType, elements, teamMap);

        if (playerId) {
          req.log.info({ optionRank: opt.option_rank, playerId, optionType }, "Matched player_id for option");
        }

        return {
          recommendation_id: recommendationId,
          option_rank: opt.option_rank,
          player_id: playerId,
          option_type: optionType,
          expected_points: opt.expected_points ?? null,
          confidence_score: opt.confidence_score ?? null,
          confidence_label: opt.confidence_label,
          upside_text: opt.upside_text ?? null,
          risk_text: opt.risk_text ?? null,
          is_superscout_pick: opt.is_superscout_pick ?? false,
        };
      });

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
        model_name: "claude-haiku-4-5-20251001",
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

    if (!recommendation_id || !user_id || !chosen_option) {
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
      user_id: user_id,
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
