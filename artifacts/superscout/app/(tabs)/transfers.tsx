import { useState, useCallback, useRef } from "react";
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
import { supabase } from "@/services/supabase";
import TransferCard from "@/components/TransferCard";
import BlurredCard from "@/components/BlurredCard";
import Paywall from "@/components/Paywall";
import ProgressLoadingIndicator from "@/components/ProgressLoadingIndicator";
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
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const requestAdvice = useCallback(async () => {
    if (!managerId) return;

    setAiLoading(true);
    setAiError(null);
    setRecommendations(null);
    setLoadingStage("squad");

    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const apiBase = getApiBaseUrl();

      let userId = "00000000-0000-0000-0000-000000000000";
      try { const { data: { user } } = await supabase.auth.getUser(); if (user?.id) userId = user.id; } catch {}
      const preGenUrl = `${apiBase}/pre-generated/current?user_id=${userId}&decision_type=transfer&vibe=${vibe}`;
      try {
        const preGenRes = await fetch(preGenUrl, { signal: controller.signal });
        if (preGenRes.ok) {
          const preGenData = await preGenRes.json();
          if (preGenData.found && preGenData.response) {
            if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
            setLoadingStage("done");
            const resultData = preGenData.response as TransferAdviceResponse;
            setRecommendations(resultData.recommendations ?? []);
            setGameweek(resultData.gameweek ?? 0);
            setFreeTransfers(resultData.free_transfers ?? 0);
            setBudget(resultData.budget_remaining ?? 0);
            setGwType(resultData.gw_type ?? null);
            setBlankTeams(resultData.blank_teams ?? []);
            setDoubleTeams(resultData.double_teams ?? []);
            setActiveChip(resultData.active_chip ?? null);
            logRecommendationSilently(resultData);
            return;
          }
        }
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
      }

      const response = await fetch(`${apiBase}/transfer-advice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manager_id: managerId,
          vibe,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
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

      setLoadingStage("ai");
      aiTimerRef.current = setTimeout(() => {
        setLoadingStage("ai_deep");
      }, 15000);

      const json = await response.json() as TransferAdviceResponse;
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

      if (json.recommendations) {
        setLoadingStage("done");
        setRecommendations(json.recommendations);
        setGameweek(json.gameweek);
        setFreeTransfers(json.free_transfers);
        setBudget(json.budget_remaining);
        setGwType(json.gw_type ?? null);
        setBlankTeams(json.blank_teams ?? []);
        setDoubleTeams(json.double_teams ?? []);
        setActiveChip(json.active_chip ?? null);
        logRecommendationSilently(json);
      } else {
        setAiError("Couldn't load transfer advice. Tap to try again.");
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setAiError("Request timed out. Tap to try again.");
      } else {
        console.error("[SuperScout] Transfer advice error:", err);
        setAiError("Couldn't load transfer advice. Tap to try again.");
      }
    } finally {
      clearTimeout(timeoutId);
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      setAiLoading(false);
    }
  }, [managerId, vibe]);

  const logRecommendationSilently = async (data: TransferAdviceResponse) => {
    try {
      const apiBase = getApiBaseUrl();
      await fetch(`${apiBase}/decision-log/recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
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
            <View style={styles.cardsContainer}>
              {isPro ? (
                recommendations.map((rec, index) => (
                  <TransferCard
                    key={rec.is_hold_recommendation ? "hold" : `${rec.player_out}-${rec.player_in}-${index}`}
                    recommendation={rec}
                  />
                ))
              ) : (
                <>
                  {recommendations.length > 0 && (
                    <TransferCard
                      key={recommendations[0].is_hold_recommendation ? "hold" : `${recommendations[0].player_out}-${recommendations[0].player_in}-0`}
                      recommendation={recommendations[0]}
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
              onPress={requestAdvice}
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
