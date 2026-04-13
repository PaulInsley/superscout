import { useState, useCallback, useRef, useEffect } from "react";
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
import { useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useManagerId } from "@/hooks/useManagerId";
import { useSubscription } from "@/lib/revenuecat";
import { getAuthenticatedUserId } from "@/services/auth";
import TransferCard from "@/components/TransferCard";
import BlurredCard from "@/components/BlurredCard";
import Paywall from "@/components/Paywall";
import ProgressLoadingIndicator from "@/components/ProgressLoadingIndicator";
import CoachingCard from "@/components/CoachingCard";
import { trackStreakActivity } from "@/services/streaks/trackActivity";
import { useBeginnerMode } from "@/hooks/useBeginnerMode";
import { GRADUATION_CONTENT } from "@/lib/coachingLessons";
import type { TransferRecommendation } from "@/components/TransferCard";

const PERSONA_KEY = "superscout_persona";

function getApiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return `https://${domain}/api`;
}

interface TransferAdviceResponse {
  gameweek: number;
  free_transfers: number;
  budget_remaining: number;
  recommendations: TransferRecommendation[];
  gw_type?: "normal" | "bgw" | "dgw" | "bgw_dgw";
  blank_teams?: string[];
  double_teams?: string[];
  active_chip?: string | null;
}

export default function TransferAdvisorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { managerId, loading: managerLoading, refresh: refreshManagerId } = useManagerId();
  const { isPro } = useSubscription();
  const beginner = useBeginnerMode();
  const [recommendations, setRecommendations] = useState<TransferRecommendation[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<string>("squad");
  const [gameweek, setGameweek] = useState<number>(0);
  const [freeTransfers, setFreeTransfers] = useState<number>(0);
  const [budget, setBudget] = useState<number>(0);
  const [vibe, setVibe] = useState<"expert" | "critic" | "fanboy">("expert");
  const [showPaywall, setShowPaywall] = useState(false);
  const [gwType, setGwType] = useState<string | null>(null);
  const [blankTeams, setBlankTeams] = useState<string[]>([]);
  const [doubleTeams, setDoubleTeams] = useState<string[]>([]);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [coachingDismissed, setCoachingDismissed] = useState(false);
  const [showGraduation, setShowGraduation] = useState(false);

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

  const MIN_LOADING_MS = 3500;
  const stageTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearStageTimers = useCallback(() => {
    stageTimersRef.current.forEach(clearTimeout);
    stageTimersRef.current = [];
  }, []);

  const startStageTimers = useCallback(() => {
    clearStageTimers();
    const t1 = setTimeout(() => setLoadingStage("analyse_fixtures"), 800);
    const t2 = setTimeout(() => setLoadingStage("analyse_form"), 1600);
    const t3 = setTimeout(() => setLoadingStage("analyse_differentials"), 2400);
    const t4 = setTimeout(() => setLoadingStage("market"), 3200);
    const t5 = setTimeout(() => setLoadingStage("ai"), 5000);
    const t6 = setTimeout(() => setLoadingStage("ai_deep"), 20000);
    stageTimersRef.current = [t1, t2, t3, t4, t5, t6];
  }, [clearStageTimers]);

  const applyTransferResult = useCallback((data: TransferAdviceResponse) => {
    setRecommendations(data.recommendations ?? []);
    trackStreakActivity();
    setGameweek(data.gameweek ?? 0);
    setFreeTransfers(data.free_transfers ?? 0);
    setBudget(data.budget_remaining ?? 0);
    setGwType(data.gw_type ?? null);
    setBlankTeams(data.blank_teams ?? []);
    setDoubleTeams(data.double_teams ?? []);
    setActiveChip(data.active_chip ?? null);
    logRecommendationSilently(data);
  }, [vibe, isPro]);

  const requestAdvice = useCallback(async (skipCache = false) => {
    if (!managerId) return;

    setAiLoading(true);
    setAiError(null);
    setRecommendations(null);
    setLoadingStage("squad");

    const loadingStart = Date.now();
    startStageTimers();

    const waitForMinLoading = () => {
      const elapsed = Date.now() - loadingStart;
      const remaining = MIN_LOADING_MS - elapsed;
      return remaining > 0 ? new Promise<void>((r) => setTimeout(r, remaining)) : Promise.resolve();
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const apiBase = getApiBaseUrl();

      const userId = await getAuthenticatedUserId();
      if (!userId) {
        setAiError("Please sign in to get transfer advice.");
        return;
      }

      if (!skipCache) {
        const preGenUrl = `${apiBase}/pre-generated/current?user_id=${userId}&decision_type=transfer&vibe=${vibe}`;
        try {
          const preGenRes = await fetch(preGenUrl, { signal: controller.signal });
          if (preGenRes.ok) {
            const preGenData = await preGenRes.json();
            if (preGenData.found && preGenData.response) {
              const resultData = preGenData.response as TransferAdviceResponse;
              await waitForMinLoading();
              clearStageTimers();
              setLoadingStage("done");
              applyTransferResult(resultData);
              return;
            }
          }
        } catch (e: any) {
          if (e?.name === "AbortError") throw e;
        }
      }

      const response = await fetch(`${apiBase}/transfer-advice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manager_id: managerId,
          vibe,
          skip_cache: skipCache,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        clearStageTimers();
        const errorBody = await response.json().catch(() => null);
        if (errorBody?.error === "new_manager") {
          setAiError("Your FPL team hasn't played any gameweeks yet. Transfer advice will be available once you've entered a gameweek.");
        } else if (errorBody?.error === "no_picks") {
          setAiError("Could not find your squad picks. Make sure you have an active FPL team.");
        } else if (errorBody?.error === "season_not_started") {
          setAiError("The FPL season hasn't started yet. Transfer advice will be available once the season begins.");
        } else {
          setAiError("Couldn't load transfer advice. Tap to try again.");
        }
        setAiLoading(false);
        return;
      }

      const json = await response.json() as TransferAdviceResponse;
      if (json.recommendations) {
        await waitForMinLoading();
        clearStageTimers();
        setLoadingStage("done");
        applyTransferResult(json);
      } else {
        setAiError("Couldn't load transfer advice. Tap to try again.");
      }
    } catch (err: any) {
      clearStageTimers();
      if (err?.name === "AbortError") {
        setAiError("Request timed out. Tap to try again.");
      } else {
        console.error("[SuperScout] Transfer advice error:", err);
        setAiError("Couldn't load transfer advice. Tap to try again.");
      }
    } finally {
      clearTimeout(timeoutId);
      clearStageTimers();
      setAiLoading(false);
    }
  }, [managerId, vibe, startStageTimers, clearStageTimers, applyTransferResult]);

  const autoLoadedVibeRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      managerId &&
      !recommendations &&
      !aiLoading &&
      !aiError &&
      autoLoadedVibeRef.current !== vibe
    ) {
      autoLoadedVibeRef.current = vibe;
      requestAdvice(false);
    }
  }, [managerId, recommendations, aiLoading, aiError, vibe, requestAdvice]);

  const logRecommendationSilently = async (data: TransferAdviceResponse) => {
    try {
      const apiBase = getApiBaseUrl();
      const logUserId = await getAuthenticatedUserId();
      if (!logUserId) return;
      await fetch(`${apiBase}/decision-log/recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: logUserId,
          gameweek: data.gameweek,
          decision_type: "transfer",
          options_shown: data.recommendations,
          persona_used: vibe,
          tier_at_time: isPro ? "pro" : "free",
          options: data.recommendations.map((r, i) => ({
            option_rank: i + 1,
            player_id: null,
            option_type: r.is_hold_recommendation ? "hold" : r.is_package ? "package" : "transfer",
            expected_points: r.is_package
              ? r.total_expected_points_gain_3gw ?? 0
              : r.expected_points_gain_3gw ?? 0,
            confidence_score:
              r.confidence === "BANKER" ? 0.9
                : r.confidence === "CALCULATED_RISK" ? 0.6
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

  if (managerLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!managerId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Feather name="link" size={40} color={colors.mutedForeground} />
        <Text style={[styles.connectPrompt, { color: colors.foreground }]}>
          Connect your FPL account in Settings to use the Transfer Advisor.
        </Text>
      </View>
    );
  }

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
          Transfer Advisor
        </Text>

        {recommendations || aiLoading ? (
          gameweek > 0 ? (
            <View style={[styles.summaryBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.summaryText, { color: colors.foreground }]}>
                GW{gameweek}
              </Text>
              <View style={[styles.summaryDot, { backgroundColor: colors.mutedForeground }]} />
              <Text style={[styles.summaryText, { color: colors.foreground }]}>
                {freeTransfers} free transfer{freeTransfers !== 1 ? "s" : ""}
              </Text>
              <View style={[styles.summaryDot, { backgroundColor: colors.mutedForeground }]} />
              <Text style={[styles.summaryText, { color: colors.foreground }]}>
                £{budget.toFixed(1)}m in bank
              </Text>
            </View>
          ) : (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Scanning the transfer market...
            </Text>
          )
        ) : (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            AI-powered transfer recommendations for your squad
          </Text>
        )}

        {activeChip && (recommendations || aiLoading) && (
          <View style={[styles.banner, { backgroundColor: "#8b5cf620", borderColor: "#8b5cf6" }]}>
            <Feather name="zap" size={16} color="#8b5cf6" />
            <Text style={[styles.bannerText, { color: "#8b5cf6" }]}>
              {activeChip === "3xc" ? "Triple Captain active" :
               activeChip === "bboost" ? "Bench Boost active — all 15 players matter" :
               activeChip === "wildcard" ? "Wildcard active — unlimited transfers" :
               activeChip === "freehit" ? "Free Hit active — build your ideal XI" :
               `${activeChip} chip active`}
            </Text>
          </View>
        )}

        {(gwType === "bgw" || gwType === "bgw_dgw") && (recommendations || aiLoading) && (
          <View style={[styles.banner, { backgroundColor: "#ef444420", borderColor: "#ef4444" }]}>
            <Feather name="alert-triangle" size={16} color="#ef4444" />
            <Text style={[styles.bannerText, { color: "#ef4444" }]}>
              Blank Gameweek — {blankTeams.length} teams not playing
            </Text>
          </View>
        )}

        {(gwType === "dgw" || gwType === "bgw_dgw") && (recommendations || aiLoading) && (
          <View style={[styles.banner, { backgroundColor: "#22c55e20", borderColor: "#22c55e" }]}>
            <Feather name="layers" size={16} color="#22c55e" />
            <Text style={[styles.bannerText, { color: "#22c55e" }]}>
              Double Gameweek — {doubleTeams.join(", ")} play twice
            </Text>
          </View>
        )}

        {!recommendations && !aiLoading && (
          <Pressable
            onPress={requestAdvice}
            style={[styles.generateButton, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.generateButtonText, { color: colors.primary }]}>
              Get Transfer Recommendations
            </Text>
          </Pressable>
        )}

        {aiLoading && (
          <ProgressLoadingIndicator
            vibe={vibe}
            currentStage={loadingStage}
            variant="transfer"
          />
        )}

        {aiError && (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {aiError}
            </Text>
            <Pressable
              onPress={requestAdvice}
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
              const lesson = beginner.getNextLesson("transfers");
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
                recommendations.map((rec, index) => (
                  <TransferCard
                    key={rec.is_hold_recommendation ? "hold" : `${rec.player_out}-${rec.player_in}-${index}`}
                    recommendation={rec}
                    isBeginner={beginner.isBeginner}
                    vibe={vibe}
                  />
                ))
              ) : (
                <>
                  {recommendations.length > 0 && (
                    <TransferCard
                      key={recommendations[0].is_hold_recommendation ? "hold" : `${recommendations[0].player_out}-${recommendations[0].player_in}-0`}
                      recommendation={recommendations[0]}
                      isBeginner={beginner.isBeginner}
                      vibe={vibe}
                    />
                  )}
                  {recommendations.slice(1).map((_, i) => (
                    <BlurredCard key={`blurred-transfer-${i}`} onPress={() => setShowPaywall(true)} />
                  ))}
                </>
              )}
            </View>

            <Text style={[styles.fplReminder, { color: colors.mutedForeground }]}>
              Make your transfers in the official FPL app before the deadline
            </Text>

            <Pressable
              onPress={() => requestAdvice(true)}
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
    </View>
  );
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
    marginBottom: 20,
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    marginTop: 4,
    gap: 8,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  summaryDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
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
    textAlign: "center",
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
    marginTop: 4,
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
