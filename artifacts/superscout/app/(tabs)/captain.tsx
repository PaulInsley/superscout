import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useManagerId } from "@/hooks/useManagerId";
import { useSubscription } from "@/lib/revenuecat";
import { getAuthenticatedUserId } from "@/services/auth";
import ChoiceCard from "@/components/ChoiceCard";
import BlurredCard from "@/components/BlurredCard";
import Paywall from "@/components/Paywall";
import PulseCheck from "@/components/PulseCheck";
import ProgressLoadingIndicator from "@/components/ProgressLoadingIndicator";
import CoachingCard from "@/components/CoachingCard";
import { trackStreakActivity } from "@/services/streaks/trackActivity";
import { useBeginnerMode } from "@/hooks/useBeginnerMode";
import { GRADUATION_CONTENT } from "@/lib/coachingLessons";
import { fetchCaptainCandidates } from "@/services/fpl/api";
import type { CaptainCandidateResult } from "@/services/fpl/api";
import type {
  CaptainRecommendation,
  CaptainPicksResponse,
} from "@/services/fpl/types";

const PERSONA_KEY = "superscout_persona";

function getApiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return `https://${domain}/api`;
}

export default function CaptainPickerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { managerId, loading: managerLoading, refresh: refreshManagerId } = useManagerId();
  const { isPro } = useSubscription();
  const beginner = useBeginnerMode();
  const [recommendations, setRecommendations] = useState<
    CaptainRecommendation[] | null
  >(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<string>("squad");
  const [gameweek, setGameweek] = useState<number>(0);
  const [deadlineTime, setDeadlineTime] = useState<string>("");
  const [vibe, setVibe] = useState<"expert" | "critic" | "fanboy">("expert");
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [coachingDismissed, setCoachingDismissed] = useState(false);
  const [showGraduation, setShowGraduation] = useState(false);
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshManagerId();
      AsyncStorage.getItem(PERSONA_KEY).then((persona) => {
        if (persona === "expert" || persona === "critic" || persona === "fanboy") {
          const effectiveVibe = isPro ? persona : "expert";
          setVibe((prev) => {
            if (prev !== effectiveVibe) {
              setRecommendations(null);
              setAiError(null);
            }
            return effectiveVibe as "expert" | "critic" | "fanboy";
          });
        }
      }).catch(() => {});
    }, [isPro]),
  );

  const {
    data: candidateData,
    isLoading: candidatesLoading,
    error: candidatesError,
  } = useQuery({
    queryKey: ["captainCandidates", managerId],
    queryFn: async () => {
      if (!managerId) {
        throw new Error("NO_MANAGER_ID");
      }
      return fetchCaptainCandidates(managerId);
    },
    enabled: managerId !== null && !managerLoading,
  });

  const clearStageTimers = useCallback(() => {
    if (stageTimerRef.current) {
      clearTimeout(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearStageTimers();
  }, [clearStageTimers]);

  useEffect(() => {
    if (candidateData?.deadlinePassed && recommendations && gameweek > 0) {
      const timer = setTimeout(() => setShowPulse(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [candidateData?.deadlinePassed, recommendations, gameweek]);

  const MIN_LOADING_MS = 2500;

  const startCaptainStageTimers = useCallback(() => {
    clearStageTimers();
    stageTimerRef.current = setTimeout(() => {
      setLoadingStage("analyse_fixtures");
      stageTimerRef.current = setTimeout(() => {
        setLoadingStage("analyse_form");
        stageTimerRef.current = setTimeout(() => {
          setLoadingStage("analyse_differentials");
          stageTimerRef.current = setTimeout(() => {
            setLoadingStage("ai");
            stageTimerRef.current = setTimeout(() => {
              setLoadingStage("ai_deep");
            }, 8000);
          }, 1200);
        }, 800);
      }, 700);
    }, 600);
  }, [clearStageTimers]);

  const requestPicks = useCallback(async (skipCache = false) => {
    if (!candidateData) return;

    setAiLoading(true);
    setAiError(null);
    setRecommendations(null);
    setLoadingStage("squad");
    setGameweek(candidateData.gameweek);
    setDeadlineTime(candidateData.deadlineTime);

    const loadingStart = Date.now();
    startCaptainStageTimers();

    const waitForMinLoading = () => {
      const elapsed = Date.now() - loadingStart;
      const remaining = MIN_LOADING_MS - elapsed;
      return remaining > 0 ? new Promise<void>((r) => setTimeout(r, remaining)) : Promise.resolve();
    };

    try {
      const apiBase = getApiBaseUrl();

      const userId = await getAuthenticatedUserId();
      if (!userId) {
        setAiError("Please sign in to get captain picks.");
        return;
      }

      if (!skipCache) {
        const preGenUrl = `${apiBase}/pre-generated/${candidateData.gameweek}?user_id=${userId}&decision_type=captain&vibe=${vibe}`;
        try {
          const preGenRes = await fetch(preGenUrl);
          if (preGenRes.ok) {
            const preGenData = await preGenRes.json();
            if (preGenData.found && preGenData.response) {
              const recs = preGenData.response.recommendations ?? preGenData.response;
              const recsArray = Array.isArray(recs) ? recs : [];
              await waitForMinLoading();
              clearStageTimers();
              setLoadingStage("done");
              setGameweek(candidateData.gameweek);
              setDeadlineTime(candidateData.deadlineTime);
              setRecommendations(recsArray);
              logRecommendationSilently({ recommendations: recsArray } as CaptainPicksResponse, candidateData.gameweek);
              trackStreakActivity();
              return;
            }
          }
        } catch {}
      }

      const response = await fetch(`${apiBase}/captain-picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibe,
          user_id: userId,
          skip_cache: skipCache,
          context: buildContext(
            candidateData.candidates,
            candidateData.gameweek,
            candidateData.deadlineTime,
            vibe,
            candidateData.activeChip,
          ),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: CaptainPicksResponse = await response.json();

      if (data.recommendations) {
        await waitForMinLoading();
        clearStageTimers();
        setLoadingStage("done");
        setRecommendations(data.recommendations);
        logRecommendationSilently(data, candidateData.gameweek);
        trackStreakActivity();
      } else {
        throw new Error("No recommendations returned");
      }
    } catch (err) {
      console.error("[SuperScout] Captain picks error:", err);
      setAiError(
        "SuperScout is thinking too hard — try again in a moment.",
      );
    } finally {
      clearStageTimers();
      setAiLoading(false);
    }
  }, [candidateData, vibe, clearStageTimers, startCaptainStageTimers]);

  const autoLoadedVibeRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      candidateData &&
      !recommendations &&
      !aiLoading &&
      !aiError &&
      autoLoadedVibeRef.current !== vibe
    ) {
      autoLoadedVibeRef.current = vibe;
      requestPicks(false);
    }
  }, [candidateData, recommendations, aiLoading, aiError, vibe, requestPicks]);

  const logRecommendationSilently = async (
    data: CaptainPicksResponse,
    gw: number,
  ) => {
    try {
      const apiBase = getApiBaseUrl();
      const logUserId = await getAuthenticatedUserId();
      if (!logUserId) return;
      await fetch(`${apiBase}/decision-log/recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: logUserId,
          gameweek: gw,
          decision_type: "captain",
          options_shown: data.recommendations,
          persona_used: vibe,
          tier_at_time: isPro ? "pro" : "free",
          options: data.recommendations.map((r, i) => ({
            option_rank: i + 1,
            player_id: null,
            option_type: "captain_pick",
            expected_points: r.expected_points,
            confidence_score:
              r.confidence === "BANKER"
                ? 0.9
                : r.confidence === "CALCULATED_RISK"
                  ? 0.6
                  : 0.3,
            confidence_label: r.confidence,
            upside_text: r.upside,
            risk_text: r.risk,
            is_superscout_pick: r.is_superscout_pick,
          })),
        }),
      });
    } catch {
      // silent
    }
  };

  const isLoading = managerLoading || candidatesLoading;
  const hasError = candidatesError;

  if (managerLoading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!managerId) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <Feather name="link" size={40} color={colors.mutedForeground} />
        <Text style={[styles.connectPrompt, { color: colors.foreground }]}>
          Connect your FPL account in Settings to use the Captain Picker.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Loading your squad...
        </Text>
      </View>
    );
  }

  if (hasError) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <Text style={[styles.errorText, { color: colors.destructive }]}>
          Could not load squad data. Check your connection and try again.
        </Text>
      </View>
    );
  }

  if (candidateData?.seasonNotStarted) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <Feather name="calendar" size={40} color={colors.mutedForeground} />
        <Text style={[styles.connectPrompt, { color: colors.foreground }]}>
          The FPL season hasn't started yet. Captain recommendations will be available once GW1 begins.
        </Text>
      </View>
    );
  }

  if (candidateData?.noSquadData || (candidateData && candidateData.candidates.length === 0)) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.connectPrompt, { color: colors.foreground }]}>
          No squad data found for this season. Make sure you've entered your current FPL Manager ID in Settings.
        </Text>
      </View>
    );
  }

  const superscoutPick = recommendations?.find((r) => r.is_superscout_pick);
  const otherPicks = recommendations?.filter((r) => !r.is_superscout_pick) || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          Captain Picker
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          GW{candidateData?.gameweek ?? "?"} ·{" "}
          {candidateData?.candidates.length ?? 0} players
        </Text>

        {candidateData?.deadlinePassed && (
          <View style={[styles.banner, { backgroundColor: "#f59e0b20", borderColor: "#f59e0b" }]}>
            <Feather name="clock" size={16} color="#f59e0b" />
            <Text style={[styles.bannerText, { color: "#f59e0b" }]}>
              Deadline has passed{candidateData.currentCaptain ? ` — your captain is ${candidateData.currentCaptain}` : ""}. Showing picks for the next gameweek.
            </Text>
          </View>
        )}

        {candidateData?.activeChip && (
          <View style={[styles.banner, { backgroundColor: "#8b5cf620", borderColor: "#8b5cf6" }]}>
            <Feather name="zap" size={16} color="#8b5cf6" />
            <Text style={[styles.bannerText, { color: "#8b5cf6" }]}>
              {candidateData.activeChip === "3xc" ? "Triple Captain active — your captain earns 3x points!" :
               candidateData.activeChip === "bboost" ? "Bench Boost active — all 15 players score this week" :
               candidateData.activeChip === "wildcard" ? "Wildcard active" :
               candidateData.activeChip === "freehit" ? "Free Hit active" :
               `${candidateData.activeChip} chip active`}
            </Text>
          </View>
        )}

        {(candidateData?.gwType === "bgw" || candidateData?.gwType === "bgw_dgw") && (
          <View style={[styles.banner, { backgroundColor: "#ef444420", borderColor: "#ef4444" }]}>
            <Feather name="alert-triangle" size={16} color="#ef4444" />
            <Text style={[styles.bannerText, { color: "#ef4444" }]}>
              Blank Gameweek — {candidateData.blankTeams?.length ?? 0} teams not playing
            </Text>
          </View>
        )}

        {(candidateData?.gwType === "dgw" || candidateData?.gwType === "bgw_dgw") && (
          <View style={[styles.banner, { backgroundColor: "#22c55e20", borderColor: "#22c55e" }]}>
            <Feather name="layers" size={16} color="#22c55e" />
            <Text style={[styles.bannerText, { color: "#22c55e" }]}>
              Double Gameweek — {candidateData.doubleTeams?.join(", ")} play twice
            </Text>
          </View>
        )}

        {!recommendations && !aiLoading && (
          <Pressable
            onPress={requestPicks}
            style={[styles.generateButton, { backgroundColor: colors.accent }]}
          >
            <Text
              style={[styles.generateButtonText, { color: colors.primary }]}
            >
              Get Captain Recommendations
            </Text>
          </Pressable>
        )}

        {aiLoading && (
          <ProgressLoadingIndicator
            vibe={vibe}
            currentStage={loadingStage}
            variant="captain"
          />
        )}

        {aiError && (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {aiError}
            </Text>
            <Pressable
              onPress={requestPicks}
              style={[styles.retryButton, { borderColor: colors.accent }]}
            >
              <Text style={[styles.retryText, { color: colors.accent }]}>
                Try Again
              </Text>
            </Pressable>
          </View>
        )}

        {recommendations && (
          <>
            {!coachingDismissed && !showGraduation && (() => {
              const lesson = beginner.getNextLesson("captain");
              if (!lesson) return null;
              return (
                <CoachingCard
                  headline={lesson.headline}
                  body={lesson.content[vibe]}
                  onDismiss={async () => {
                    const isGraduating = await beginner.dismissLesson(lesson.key);
                    setCoachingDismissed(true);
                    if (isGraduating) setShowGraduation(true);
                  }}
                />
              );
            })()}

            {showGraduation && (
              <CoachingCard
                headline={GRADUATION_CONTENT[vibe].headline}
                body={GRADUATION_CONTENT[vibe].body}
                isGraduation
                onDismiss={() => {
                  setShowGraduation(false);
                  beginner.graduate();
                }}
              />
            )}

            <View style={styles.cardsContainer}>
              {isPro ? (
                recommendations.map((rec) => (
                  <ChoiceCard
                    key={rec.player_name}
                    recommendation={rec}
                    isBeginner={beginner.isBeginner}
                    vibe={vibe}
                  />
                ))
              ) : (
                <>
                  {superscoutPick && (
                    <ChoiceCard
                      key={superscoutPick.player_name}
                      recommendation={superscoutPick}
                      isBeginner={beginner.isBeginner}
                      vibe={vibe}
                    />
                  )}
                  {otherPicks.map((_, i) => (
                    <BlurredCard key={`blurred-${i}`} onPress={() => setShowPaywall(true)} />
                  ))}
                </>
              )}
            </View>

            <Text style={[styles.fplReminder, { color: colors.mutedForeground }]}>
              Set your captain in the official FPL app before the deadline
            </Text>

            <Pressable
              onPress={() => requestPicks(true)}
              style={[styles.regenerateButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.regenerateText, { color: colors.mutedForeground }]}>
                Regenerate
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
      <PulseCheck
        gameweek={gameweek}
        visible={showPulse}
        onDismiss={() => setShowPulse(false)}
      />
    </View>
  );
}

function buildContext(
  candidates: Array<{
    name: string;
    position: string;
    team: string;
    form: string;
    totalPoints: number;
    ownershipPct: number;
    price: number;
    opponent: string;
    fixtureDifficulty: number;
    status: string;
    chanceOfPlaying: number | null;
    pickPosition: number;
    isBench: boolean;
  }>,
  gameweek: number,
  deadlineTime: string,
  vibe: string,
  activeChip?: string | null,
): string {
  const squadSummary = candidates
    .map(
      (c) =>
        `- ${c.name} (${c.position}, ${c.team}) | Pos: ${c.pickPosition}${c.isBench ? " [BENCH]" : ""} | Form: ${c.form} | Total Pts: ${c.totalPoints} | Ownership: ${c.ownershipPct}% | Price: £${c.price}m | vs ${c.opponent} | FDR: ${c.fixtureDifficulty} | Status: ${c.status}${c.chanceOfPlaying !== null && c.chanceOfPlaying < 100 ? ` (${c.chanceOfPlaying}% chance)` : ""}`,
    )
    .join("\n");

  const chipLine = activeChip ? `\nACTIVE_CHIP: ${activeChip}` : "";

  return `GAMEWEEK: ${gameweek}
DEADLINE: ${deadlineTime}
VIBE: ${vibe}${chipLine}

SQUAD (15 players — positions 1-11 = starting XI, 12-15 = bench):
${squadSummary}

You are generating captain recommendations for this FPL manager. Analyse their squad and upcoming fixtures. Return exactly 3 captain options. For each option provide: the player name, their team, the opponent and whether it is home or away, an expected points estimate (your best estimate based on form, fixtures, and historical data), a confidence level (one of: BANKER, CALCULATED_RISK, or BOLD_PUNT), the player's ownership percentage, one clear upside sentence, one clear risk sentence, a persona-voiced one-liner making the case for this pick (this is where your personality shines — make it memorable), and whether this is the SuperScout Pick (exactly one option must be true).

LINEUP OPTIMISATION:
- Set is_on_bench to true if the captain pick is currently on the bench (position 12-15), false otherwise.
- If a captain pick is on the bench, you MUST include a lineup_changes array showing which bench player to bring in and which starting player to bench, plus a lineup_note summarising the change.
- Even for starting XI captains, if you spot a clearly better lineup (e.g. a benched player with much better fixture than a starter of the same position), include lineup_changes.
- If no lineup changes are needed, omit lineup_changes and lineup_note entirely.
- lineup_changes player names must use the EXACT names from the squad data above.

Confidence levels explained:
- BANKER — the safe, obvious pick. The one you'd tell your nan to captain.
- CALCULATED_RISK — good data supports it but not guaranteed. A smart pick with some variance.
- BOLD_PUNT — high ceiling, real chance it blanks. The pick you make when chasing a gap.

You MUST respond with valid JSON only — no markdown, no preamble, no backticks, no explanation. Just the JSON object.

Use this exact JSON structure:
{
  "gameweek": ${gameweek},
  "recommendations": [
    {
      "player_name": "Player Name",
      "team": "Team Short Name",
      "opponent": "OPP (H/A)",
      "expected_points": <number>,
      "confidence": "BANKER|CALCULATED_RISK|BOLD_PUNT",
      "ownership_pct": <number>,
      "upside": "One sentence about the upside",
      "risk": "One sentence about the risk",
      "case": "Your persona-voiced one-liner goes here",
      "is_superscout_pick": true|false,
      "is_on_bench": false,
      "lineup_changes": [
        {
          "player_in": "Bench player name",
          "player_out": "Starting player name",
          "reason": "Short reason"
        }
      ],
      "lineup_note": "Brief summary of lineup changes"
    }
  ]
}

Rules:
- Exactly 3 recommendations, ordered with the SuperScout Pick first.
- Exactly one recommendation must have is_superscout_pick: true.
- Do not recommend players who are injured, suspended, or have 0% chance of playing.
- Do not recommend players with no fixture in this gameweek.
- The expected_points should be a realistic estimate (typically 2-12 range).
- The "case" field is where your vibe personality comes through.
- ownership_pct should match the data provided.
- is_on_bench must be true if the player's position number is 12-15.
- If a captain pick is on the bench, lineup_changes is REQUIRED.
- lineup_changes player names must match EXACTLY the names from the squad data.`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  connectPrompt: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 22,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  generateButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  aiLoadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  cardsContainer: {
    marginTop: 16,
  },
  fplReminder: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  regenerateButton: {
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  regenerateText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
