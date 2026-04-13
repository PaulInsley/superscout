import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase } from "../lib/supabase";
import { VIBE_PROMPTS } from "../lib/vibes";
import {
  computeFullScore,
  getStarLabel,
  type CaptainScoreInput,
  type TransferScoreInput,
  type PerformanceScoreInput,
} from "../services/reportcard/fpl-scoring";

const router = Router();
const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

interface FPLLiveElement {
  id: number;
  stats: { total_points: number };
}

interface FPLPicksResponse {
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    rank: number;
    rank_sort: number;
    overall_rank: number;
    bank: number;
    event_transfers: number;
    event_transfers_cost: number;
    points_on_bench: number;
  };
  picks: Array<{
    element: number;
    position: number;
    multiplier: number;
    is_captain: boolean;
    is_vice_captain: boolean;
  }>;
}

async function fetchFplJson<T>(path: string): Promise<T> {
  const resp = await fetch(`${FPL_BASE_URL}${path}`);
  if (!resp.ok) throw new Error(`FPL API error: ${resp.status} for ${path}`);
  return resp.json() as Promise<T>;
}

router.post(
  "/report-card/generate/:gameweek",
  async (req: Request, res: Response) => {
    try {
      const gw = parseInt(String(req.params.gameweek), 10);
      if (isNaN(gw) || gw < 1 || gw > 50) {
        res.status(400).json({ error: "Invalid gameweek" });
        return;
      }

      const { manager_id, vibe = "expert" } = req.body;
      if (!manager_id) {
        res.status(400).json({ error: "Missing manager_id" });
        return;
      }

      const managerId = parseInt(String(manager_id), 10);
      const supabase = getSupabase();
      if (!supabase) {
        res.status(503).json({ error: "Database not configured" });
        return;
      }

      let userId: string | null = null;
      try {
        const { data: userRow } = await supabase
          .from("users")
          .select("id")
          .eq("fpl_manager_id", String(managerId))
          .limit(1)
          .single();
        if (userRow?.id) userId = userRow.id;
      } catch {}

      if (!userId) {
        req.log.warn({ managerId, gw }, "No user found for manager_id");
        res.status(404).json({ error: "User not found. Please sign in and link your FPL team." });
        return;
      }

      const { data: existingReport } = await supabase
        .from("report_cards")
        .select("*")
        .eq("user_id", userId)
        .eq("gameweek", gw)
        .limit(1)
        .single();

      if (existingReport) {
        res.json({ report: existingReport, source: "cached" });
        return;
      }

      req.log.info({ managerId, gw, userId }, "Generating report card");

      const [bootstrap, liveData, userPicks, transferHistory] =
        await Promise.all([
          fetchFplJson<{
            events: Array<{
              id: number;
              finished: boolean;
              average_entry_score: number;
            }>;
            elements: Array<{ id: number; web_name: string }>;
          }>("/bootstrap-static/"),
          fetchFplJson<{ elements: FPLLiveElement[] }>(
            `/event/${gw}/live/`,
          ),
          fetchFplJson<FPLPicksResponse>(
            `/entry/${managerId}/event/${gw}/picks/`,
          ),
          fetchFplJson<
            Array<{
              element_in: number;
              element_in_cost: number;
              element_out: number;
              element_out_cost: number;
              event: number;
            }>
          >(`/entry/${managerId}/transfers/`),
        ]);

      const event = bootstrap.events.find((e) => e.id === gw);
      if (!event || !event.finished) {
        res.status(400).json({
          error: "gameweek_not_finished",
          message: `Gameweek ${gw} hasn't finished yet.`,
        });
        return;
      }

      const averagePoints = event.average_entry_score ?? 0;
      const playerMap = new Map(
        bootstrap.elements.map((p) => [p.id, p.web_name]),
      );
      const pointsMap = new Map(
        liveData.elements.map((e) => [e.id, e.stats.total_points]),
      );

      const captainPick = userPicks.picks.find((p) => p.is_captain);
      const captainId = captainPick?.element ?? 0;
      const captainRawPoints = pointsMap.get(captainId) ?? 0;
      const captainPoints = captainRawPoints * (captainPick?.multiplier ?? 2);

      const { data: captainRecs } = await supabase
        .from("recommendations")
        .select("id, options_shown")
        .eq("user_id", userId)
        .eq("gameweek", gw)
        .eq("decision_type", "captain")
        .order("created_at", { ascending: false })
        .limit(1);

      let captainOptions: CaptainScoreInput["recommendedOptions"] = [];

      if (captainRecs && captainRecs.length > 0) {
        const optionsShown = captainRecs[0].options_shown as {
          picks?: Array<{
            name?: string;
            player_id?: number;
            is_superscout_pick?: boolean;
          }>;
        };

        if (optionsShown?.picks) {
          captainOptions = optionsShown.picks.map((pick) => {
            const pId = pick.player_id ?? 0;
            const pName = pick.name ?? playerMap.get(pId) ?? "Unknown";
            return {
              playerId: pId,
              playerName: pName,
              actualPoints: pointsMap.get(pId) ?? 0,
              isSuperscoutPick: pick.is_superscout_pick ?? false,
            };
          });
        }
      }

      if (captainOptions.length === 0) {
        captainOptions = [
          {
            playerId: captainId,
            playerName: playerMap.get(captainId) ?? "Unknown",
            actualPoints: captainRawPoints,
            isSuperscoutPick: false,
          },
        ];
      }

      const gwTransfers = transferHistory.filter((t) => t.event === gw);

      const { data: transferRecs } = await supabase
        .from("recommendations")
        .select("id, options_shown")
        .eq("user_id", userId)
        .eq("gameweek", gw)
        .eq("decision_type", "transfer")
        .order("created_at", { ascending: false })
        .limit(1);

      const recommendedPlayerIns = new Set<number>();
      let recommendedHold = false;

      if (transferRecs && transferRecs.length > 0) {
        const optionsShown = transferRecs[0].options_shown as {
          recommendations?: Array<{
            player_in?: string;
            is_hold_recommendation?: boolean;
          }>;
        };

        if (optionsShown?.recommendations) {
          for (const rec of optionsShown.recommendations) {
            if (rec.is_hold_recommendation) {
              recommendedHold = true;
            }
            if (rec.player_in) {
              const found = bootstrap.elements.find(
                (e) =>
                  e.web_name.toLowerCase() ===
                  rec.player_in!.toLowerCase(),
              );
              if (found) recommendedPlayerIns.add(found.id);
            }
          }
        }
      }

      const transferScoreInput: TransferScoreInput = {
        transfers: gwTransfers.map((t) => ({
          playerInId: t.element_in,
          playerInName: playerMap.get(t.element_in) ?? "Unknown",
          playerInPoints: pointsMap.get(t.element_in) ?? 0,
          playerOutId: t.element_out,
          playerOutName: playerMap.get(t.element_out) ?? "Unknown",
          playerOutPoints: pointsMap.get(t.element_out) ?? 0,
          wasRecommended: recommendedPlayerIns.has(t.element_in),
          hitCost:
            gwTransfers.length > 0
              ? Math.max(
                  0,
                  (userPicks.entry_history.event_transfers_cost ?? 0) /
                    gwTransfers.length,
                )
              : 0,
        })),
        recommendedHold,
        userHeld: gwTransfers.length === 0,
      };

      const scoringResult = computeFullScore(
        {
          userCaptainId: captainId,
          userCaptainPoints: captainRawPoints,
          recommendedOptions: captainOptions,
        },
        transferScoreInput,
        {
          userPoints: userPicks.entry_history.points,
          averagePoints,
        },
      );

      let previousRank: number | null = null;
      try {
        const prevPicks = await fetchFplJson<FPLPicksResponse>(
          `/entry/${managerId}/event/${gw - 1}/picks/`,
        );
        previousRank = prevPicks.entry_history.overall_rank;
      } catch {}

      const currentRank = userPicks.entry_history.overall_rank;
      const rankMovement = previousRank
        ? previousRank - currentRank
        : 0;

      let commentary = "";
      try {
        const vibePrompt = VIBE_PROMPTS[vibe] ?? VIBE_PROMPTS.expert;
        const followedAdvice =
          captainOptions.length > 0 &&
          captainOptions.some(
            (o) => o.playerId === captainId && o.isSuperscoutPick,
          );

        const anthropic = new Anthropic();
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          temperature: 0.7,
          messages: [
            {
              role: "user",
              content: `${vibePrompt}

You are writing a post-gameweek report card commentary. Write 3-5 sentences.

GAMEWEEK: ${gw}
USER'S POINTS: ${userPicks.entry_history.points} pts
AVERAGE MANAGER: ${averagePoints} pts
RANK MOVEMENT: ${rankMovement > 0 ? `Up ${rankMovement.toLocaleString()} places` : rankMovement < 0 ? `Down ${Math.abs(rankMovement).toLocaleString()} places` : "Unchanged"}
CAPTAIN: ${playerMap.get(captainId) ?? "Unknown"} scored ${captainRawPoints} pts (×${captainPick?.multiplier ?? 2} = ${captainPoints})
SUPERSCOUT'S TOP PICK: ${scoringResult.bestRecommendedCaptain} scored ${scoringResult.bestRecommendedCaptainPoints} pts
FOLLOWED SUPERSCOUT ADVICE: ${followedAdvice ? "Yes" : "No"}
DECISION QUALITY: ${scoringResult.decisionQualityScore}/100 (${scoringResult.starRating} stars)
STAR LABEL: ${getStarLabel(scoringResult.starRating)}
TRANSFERS THIS GW: ${gwTransfers.length === 0 ? "None (held)" : gwTransfers.map((t) => `${playerMap.get(t.element_out) ?? "?"} → ${playerMap.get(t.element_in) ?? "?"} (${(pointsMap.get(t.element_in) ?? 0) - (pointsMap.get(t.element_out) ?? 0)} pt diff)`).join(", ")}
HIT COST: ${userPicks.entry_history.event_transfers_cost} pts

Focus on decision quality, not just points. A good decision can have a bad outcome.
If they followed SuperScout's advice and it worked: acknowledge the smart move.
If they followed and it didn't work: reassure — the process was right.
If they went their own way and it worked: credit their instinct.
If they went their own way and it didn't: be constructive, never harsh.
Write ONLY the commentary paragraph — no headers, no labels, no JSON.`,
            },
          ],
        });

        const block = msg.content[0];
        if (block.type === "text") {
          commentary = block.text.trim();
        }
      } catch (err) {
        req.log.warn({ err }, "Failed to generate report card commentary");
        commentary = `Gameweek ${gw} is in the books. ${scoringResult.starRating >= 4 ? "Strong decisions this week." : scoringResult.starRating >= 3 ? "Solid week overall." : "A learning opportunity."} Your captain ${playerMap.get(captainId) ?? "pick"} returned ${captainPoints} points.`;
      }

      const reportCard = {
        user_id: userId,
        gameweek: gw,
        season: "2025-26",
        total_points: userPicks.entry_history.points,
        average_points: averagePoints,
        rank_movement: rankMovement,
        overall_rank: currentRank,
        captain_name: playerMap.get(captainId) ?? "Unknown",
        captain_points: captainPoints,
        star_rating: scoringResult.starRating,
        decision_quality_score: scoringResult.decisionQualityScore,
        captain_quality_score: scoringResult.captainQualityScore,
        transfer_quality_score: scoringResult.transferQualityScore,
        commentary,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("report_cards")
        .insert(reportCard)
        .select("*")
        .single();

      if (insertErr) {
        req.log.error({ err: insertErr }, "Failed to insert report card");
        res.json({ report: reportCard, source: "generated_unsaved" });
        return;
      }

      req.log.info(
        {
          gw,
          stars: scoringResult.starRating,
          quality: scoringResult.decisionQualityScore,
        },
        "Report card generated",
      );

      res.json({ report: inserted, source: "generated" });
    } catch (error: any) {
      req.log.error({ err: error }, "Report card generation failed");
      res.status(500).json({ error: "Failed to generate report card" });
    }
  },
);

router.get(
  "/report-card/:gameweek",
  async (req: Request, res: Response) => {
    try {
      const gw = parseInt(String(req.params.gameweek), 10);
      const managerId = req.query.manager_id;

      if (isNaN(gw) || !managerId) {
        res
          .status(400)
          .json({ error: "Missing gameweek or manager_id" });
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        res.status(503).json({ error: "Database not configured" });
        return;
      }

      let userId: string | null = null;
      try {
        const { data: userRow } = await supabase
          .from("users")
          .select("id")
          .eq("fpl_manager_id", String(managerId))
          .limit(1)
          .single();
        if (userRow?.id) userId = userRow.id;
      } catch {}

      if (!userId) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const { data: report, error } = await supabase
        .from("report_cards")
        .select("*")
        .eq("user_id", userId)
        .eq("gameweek", gw)
        .limit(1)
        .single();

      if (error || !report) {
        res.json({ report: null });
        return;
      }

      res.json({ report });
    } catch (error: any) {
      req.log.error({ err: error }, "Failed to fetch report card");
      res.status(500).json({ error: "Failed to fetch report card" });
    }
  },
);

export default router;
