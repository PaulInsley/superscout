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
import TransferCard from "@/components/TransferCard";
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
}

export default function TransferAdvisorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { managerId, loading: managerLoading, refresh: refreshManagerId } = useManagerId();
  const [recommendations, setRecommendations] = useState<TransferRecommendation[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<string>("squad");
  const [gameweek, setGameweek] = useState<number>(0);
  const [freeTransfers, setFreeTransfers] = useState<number>(0);
  const [budget, setBudget] = useState<number>(0);
  const [vibe, setVibe] = useState<"expert" | "critic" | "fanboy">("expert");
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshManagerId();
      AsyncStorage.getItem(PERSONA_KEY).then((persona) => {
        if (persona === "expert" || persona === "critic" || persona === "fanboy") {
          setVibe((prev) => {
            if (prev !== persona) {
              setRecommendations(null);
              setAiError(null);
            }
            return persona;
          });
        }
      }).catch(() => {});
    }, []),
  );

  const requestAdvice = useCallback(async () => {
    if (!managerId) return;

    setAiLoading(true);
    setAiError(null);
    setRecommendations(null);
    setLoadingStage("squad");

    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/transfer-advice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          manager_id: managerId,
          vibe,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        if (errorBody?.error === "new_manager") {
          setAiError("Your FPL team hasn't played any gameweeks yet. Transfer advice will be available once you've entered a gameweek.");
        } else if (errorBody?.error === "no_picks") {
          setAiError("Could not find your squad picks. Make sure you have an active FPL team.");
        } else {
          throw new Error(`API error: ${response.status}`);
        }
        setAiLoading(false);
        return;
      }

      let resultData: TransferAdviceResponse | null = null;

      const parseSSELines = (text: string) => {
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr);

            if (event.error) {
              if (event.error === "new_manager") {
                setAiError("Your FPL team hasn't played any gameweeks yet. Transfer advice will be available once you've entered a gameweek.");
              } else if (event.error === "no_picks") {
                setAiError("Could not find your squad picks. Make sure you have an active FPL team.");
              } else {
                setAiError(event.message || "Something went wrong. Try again.");
              }
              return "error";
            }

            if (event.stage === "ai") {
              setLoadingStage("ai");
              if (!aiTimerRef.current) {
                aiTimerRef.current = setTimeout(() => {
                  setLoadingStage("ai_deep");
                }, 15000);
              }
            } else if (event.stage === "result") {
              if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
              resultData = {
                gameweek: event.gameweek,
                free_transfers: event.free_transfers,
                budget_remaining: event.budget_remaining,
                recommendations: event.recommendations,
              };
            } else if (event.stage) {
              setLoadingStage(event.stage);
            }
          } catch {}
        }
        return "ok";
      };

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            if (parseSSELines(buffer) === "error") {
              setAiLoading(false);
              return;
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          if (parseSSELines(lines.join("\n")) === "error") {
            setAiLoading(false);
            return;
          }
        }
      } else {
        setLoadingStage("ai");
        aiTimerRef.current = setTimeout(() => {
          setLoadingStage("ai_deep");
        }, 15000);
        const text = await response.text();
        if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
        if (parseSSELines(text) === "error") {
          setAiLoading(false);
          return;
        }
      }

      if (resultData) {
        setLoadingStage("done");
        setRecommendations(resultData.recommendations);
        setGameweek(resultData.gameweek);
        setFreeTransfers(resultData.free_transfers);
        setBudget(resultData.budget_remaining);
        logRecommendationSilently(resultData);
      } else {
        setAiError("SuperScout is thinking too hard — try again in a moment.");
      }
    } catch (err) {
      console.error("[SuperScout] Transfer advice error:", err);
      setAiError("SuperScout is thinking too hard — try again in a moment.");
    } finally {
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
          tier_at_time: "free",
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
              {recommendations.map((rec, index) => (
                <TransferCard
                  key={rec.is_hold_recommendation ? "hold" : `${rec.player_out}-${rec.player_in}-${index}`}
                  recommendation={rec}
                />
              ))}
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
