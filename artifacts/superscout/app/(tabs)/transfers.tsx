import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/useColors";
import TransferCard from "@/components/TransferCard";
import type { TransferRecommendation } from "@/components/TransferCard";

const MANAGER_ID_KEY = "superscout_manager_id";
const PERSONA_KEY = "superscout_persona";

function getApiBaseUrl(): string {
  if (Platform.OS === "web") {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return `https://${domain}/api`;
  }
  return "https://superscout.pro/api";
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
  const [recommendations, setRecommendations] = useState<TransferRecommendation[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [gameweek, setGameweek] = useState<number>(0);
  const [freeTransfers, setFreeTransfers] = useState<number>(0);
  const [budget, setBudget] = useState<number>(0);
  const [vibe, setVibe] = useState<"expert" | "critic" | "fanboy">("expert");
  const [managerId, setManagerId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
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

      AsyncStorage.getItem(MANAGER_ID_KEY).then((id) => {
        setManagerId(id);
      }).catch(() => {});
    }, []),
  );

  const requestAdvice = useCallback(async () => {
    if (!managerId) return;

    setAiLoading(true);
    setAiError(null);
    setRecommendations(null);

    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/transfer-advice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manager_id: managerId,
          vibe,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: TransferAdviceResponse = await response.json();
      setRecommendations(data.recommendations);
      setGameweek(data.gameweek);
      setFreeTransfers(data.free_transfers);
      setBudget(data.budget_remaining);

      logRecommendationSilently(data);
    } catch {
      setAiError("SuperScout is thinking too hard — try again in a moment.");
    } finally {
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
            option_type: r.is_hold_recommendation ? "hold" : "transfer",
            expected_points: r.expected_points_gain_3gw,
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

  if (!managerId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Text style={[styles.errorText, { color: colors.destructive }]}>
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

        {recommendations ? (
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
          <View style={styles.aiLoadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              SuperScout is analysing your squad and the transfer market...
            </Text>
          </View>
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
