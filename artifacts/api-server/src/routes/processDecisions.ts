import { Router, type Request, type Response } from "express";
import { getSupabase } from "../lib/supabase";

const router = Router();

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

router.post("/process-decisions/:gameweek", async (req: Request, res: Response) => {
  try {
    const adminSecret = process.env.PROCESS_DECISIONS_SECRET;
    if (!adminSecret) {
      res.status(500).json({ error: "Server configuration error: admin secret not set. Contact the administrator." });
      return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${adminSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const gw = parseInt(String(req.params.gameweek), 10);
    if (isNaN(gw) || gw < 1 || gw > 50) {
      res.status(400).json({ error: "Invalid gameweek" });
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    try {
      const bootstrapResp = await fetch(`${FPL_BASE_URL}/bootstrap-static/`);
      if (bootstrapResp.ok) {
        const bootstrap = await bootstrapResp.json() as {
          events: Array<{ id: number; deadline_time: string; finished: boolean }>;
        };
        const event = bootstrap.events?.find((e) => e.id === gw);
        if (event) {
          const deadline = new Date(event.deadline_time);
          if (Date.now() < deadline.getTime()) {
            res.status(400).json({ error: "Gameweek deadline has not passed yet" });
            return;
          }
        }
      }
    } catch (err) {
      req.log.warn({ err }, "Could not verify deadline, proceeding anyway");
    }

    const [captainResult, transferResult] = await Promise.all([
      supabase
        .from("recommendations")
        .select("id, user_id, gameweek, options_shown")
        .eq("gameweek", gw)
        .eq("decision_type", "captain"),
      supabase
        .from("recommendations")
        .select("id, user_id, gameweek, options_shown")
        .eq("gameweek", gw)
        .eq("decision_type", "transfer"),
    ]);

    if (captainResult.error) {
      req.log.error({ err: captainResult.error }, "Failed to fetch captain recommendations");
    }
    if (transferResult.error) {
      req.log.warn({ err: transferResult.error }, "Failed to fetch transfer recommendations");
    }

    const recs = captainResult.data ?? [];
    const transferRecs = transferResult.data ?? [];

    if (recs.length === 0 && transferRecs.length === 0) {
      res.json({
        message: "No recommendations found for this gameweek",
        captain: { processed: 0, matched_superscout: 0, ignored_superscout: 0 },
        transfers: { processed: 0, matched_superscout: 0 },
      });
      return;
    }

    const allRecIds = [...recs, ...transferRecs].map((r: { id: string }) => r.id);
    const { data: existingDecisions } = await supabase
      .from("user_decisions")
      .select("recommendation_id")
      .in("recommendation_id", allRecIds);

    const alreadyProcessed = new Set(
      (existingDecisions ?? []).map((d: { recommendation_id: string }) => d.recommendation_id)
    );

    const managerIdOverride = req.body?.manager_id ? parseInt(req.body.manager_id, 10) : null;

    const userFplMap = new Map<string, number>();
    const allUserRecs = [...recs, ...transferRecs];
    if (managerIdOverride) {
      for (const rec of allUserRecs) {
        userFplMap.set(rec.user_id, managerIdOverride);
      }
    } else {
      try {
        const { data: users } = await supabase
          .from("users")
          .select("id, fpl_team_id");
        for (const u of users ?? []) {
          if (u.fpl_team_id) {
            userFplMap.set(u.id, u.fpl_team_id);
          }
        }
      } catch (err) {
        req.log.warn({ err }, "Could not fetch user FPL IDs from users table");
      }
    }

    let bootstrapElements: Array<{ id: number; first_name: string; second_name: string }> = [];
    try {
      const bootstrapResp = await fetch(`${FPL_BASE_URL}/bootstrap-static/`);
      if (bootstrapResp.ok) {
        const bootstrap = await bootstrapResp.json() as {
          elements: Array<{ id: number; first_name: string; second_name: string }>;
        };
        bootstrapElements = bootstrap.elements ?? [];
      }
    } catch (err) {
      req.log.warn({ err }, "Failed to fetch bootstrap data, will use fallback player names");
    }

    const playerNameMap = new Map<number, string>();
    for (const el of bootstrapElements) {
      playerNameMap.set(el.id, el.second_name);
    }

    let processed = 0;
    let matched = 0;
    let ignored = 0;

    for (const rec of recs) {
      if (alreadyProcessed.has(rec.id)) {
        continue;
      }

      const managerId = userFplMap.get(rec.user_id);
      if (!managerId) {
        req.log.info({ userId: rec.user_id }, "No FPL manager ID for user, skipping");
        continue;
      }

      try {
        const picksResponse = await fetch(
          `${FPL_BASE_URL}/entry/${managerId}/event/${gw}/picks/`
        );

        if (!picksResponse.ok) {
          req.log.warn(
            { managerId, status: picksResponse.status },
            "FPL API error for manager, skipping"
          );
          continue;
        }

        const picksData = await picksResponse.json() as {
          picks: Array<{ element: number; is_captain: boolean }>;
        };

        const captainPick = picksData.picks?.find((p) => p.is_captain);
        if (!captainPick) {
          req.log.info({ managerId }, "No captain found in picks, skipping");
          continue;
        }

        const captainName = playerNameMap.get(captainPick.element) ?? `Player #${captainPick.element}`;

        const recommendedPlayers: string[] = [];
        if (Array.isArray(rec.options_shown)) {
          for (const opt of rec.options_shown as Array<{ player_name?: string }>) {
            if (opt.player_name) recommendedPlayers.push(opt.player_name);
          }
        }

        let optionId: string | null = null;
        const { data: optData } = await supabase
          .from("recommendation_options")
          .select("id, option_rank")
          .eq("recommendation_id", rec.id);

        if (optData && optData.length > 0 && Array.isArray(rec.options_shown)) {
          const options = rec.options_shown as Array<{ player_name?: string }>;
          const matchIdx = options.findIndex(
            (opt) => opt.player_name?.toLowerCase() === captainName.toLowerCase()
          );
          if (matchIdx >= 0 && optData[matchIdx]) {
            optionId = optData.find((o: { option_rank: number }) => o.option_rank === matchIdx + 1)?.id ?? null;
          }
        }

        const { error: insertError } = await supabase
          .from("user_decisions")
          .insert({
            recommendation_id: rec.id,
            user_id: rec.user_id,
            recommendation_option_id: optionId,
            chosen_option: captainName,
            hours_before_deadline: null,
          });

        if (insertError) {
          req.log.error({ err: insertError, recId: rec.id }, "Failed to insert user_decision");
          continue;
        }

        processed++;

        const didMatch = recommendedPlayers.some(
          (name) => name.toLowerCase() === captainName.toLowerCase()
        );
        if (didMatch) {
          matched++;
        } else {
          ignored++;
        }
      } catch (err) {
        req.log.error({ err, managerId }, "Error processing manager, skipping");
        continue;
      }
    }

    let transferProcessed = 0;
    let transferMatched = 0;

    if (transferRecs.length > 0) {
      for (const rec of transferRecs) {
        if (alreadyProcessed.has(rec.id)) continue;

        const managerId = userFplMap.get(rec.user_id);
        if (!managerId) continue;

        try {
          const transfersResp = await fetch(
            `${FPL_BASE_URL}/entry/${managerId}/transfers/`
          );
          if (!transfersResp.ok) continue;

          const transfers = await transfersResp.json() as Array<{
            element_in: number;
            element_out: number;
            event: number;
          }>;

          const gwTransfers = transfers.filter((t) => t.event === gw);

          const recommendedTransfers: Array<{ player_out?: string; player_in?: string; is_hold_recommendation?: boolean }> = [];
          if (Array.isArray(rec.options_shown)) {
            for (const opt of rec.options_shown as Array<{ player_out?: string; player_in?: string; is_hold_recommendation?: boolean }>) {
              recommendedTransfers.push(opt);
            }
          }

          let chosenOption = "no_transfer";
          if (gwTransfers.length > 0) {
            const transferNames = gwTransfers.map((t) => {
              const inName = playerNameMap.get(t.element_in) ?? `#${t.element_in}`;
              const outName = playerNameMap.get(t.element_out) ?? `#${t.element_out}`;
              return `${outName} → ${inName}`;
            });
            chosenOption = transferNames.join(", ");

            const didFollow = gwTransfers.some((t) => {
              const inName = playerNameMap.get(t.element_in)?.toLowerCase() ?? "";
              const outName = playerNameMap.get(t.element_out)?.toLowerCase() ?? "";
              return recommendedTransfers.some((r) =>
                r.player_in?.toLowerCase().includes(inName) ||
                r.player_out?.toLowerCase().includes(outName)
              );
            });
            if (didFollow) transferMatched++;
          } else {
            const hadHoldRec = recommendedTransfers.some((r) => r.is_hold_recommendation);
            if (hadHoldRec) transferMatched++;
          }

          await supabase.from("user_decisions").insert({
            recommendation_id: rec.id,
            user_id: rec.user_id,
            recommendation_option_id: null,
            chosen_option: chosenOption,
            hours_before_deadline: null,
          });

          transferProcessed++;
        } catch (err) {
          req.log.error({ err }, "Error processing transfer decision");
        }
      }
    }

    req.log.info(
      { gameweek: gw, processed, matched, ignored, transferProcessed, transferMatched },
      "Decision processing complete"
    );

    res.json({
      gameweek: gw,
      captain: { processed, matched_superscout: matched, ignored_superscout: ignored },
      transfers: { processed: transferProcessed, matched_superscout: transferMatched },
    });
  } catch (error) {
    req.log.error({ err: error }, "Process decisions failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
