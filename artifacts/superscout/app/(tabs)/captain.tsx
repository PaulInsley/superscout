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
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useManagerId } from "@/hooks/useManagerId";
import ChoiceCard from "@/components/ChoiceCard";
import ProgressLoadingIndicator from "@/components/ProgressLoadingIndicator";
import { fetchCaptainCandidates } from "@/services/fpl/api";
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
  const [recommendations, setRecommendations] = useState<
    CaptainRecommendation[] | null
  >(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState<string>("squad");
  const [gameweek, setGameweek] = useState<number>(0);
  const [deadlineTime, setDeadlineTime] = useState<string>("");
  const [isMockData, setIsMockData] = useState(false);
  const [vibe, setVibe] = useState<"expert" | "critic" | "fanboy">("expert");
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const requestPicks = useCallback(async () => {
    if (!candidateData) return;

    setAiLoading(true);
    setAiError(null);
    setRecommendations(null);
    setLoadingStage("squad");
    setGameweek(candidateData.gameweek);
    setDeadlineTime(candidateData.deadlineTime);
    setIsMockData(candidateData.isMockData);

    clearStageTimers();

    stageTimerRef.current = setTimeout(() => {
      setLoadingStage("rules");
      stageTimerRef.current = setTimeout(() => {
        setLoadingStage("ai");
        stageTimerRef.current = setTimeout(() => {
          setLoadingStage("ai_deep");
        }, 8000);
      }, 1500);
    }, 1000);

    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/captain-picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibe,
          context: buildContext(
            candidateData.candidates,
            candidateData.gameweek,
            candidateData.deadlineTime,
            vibe,
          ),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      clearStageTimers();
      setLoadingStage("validating");

      const data: CaptainPicksResponse = await response.json();

      setLoadingStage("done");
      await new Promise((r) => setTimeout(r, 400));
      setRecommendations(data.recommendations);

      logRecommendationSilently(data, candidateData.gameweek);
    } catch (err) {
      console.error("[SuperScout] Captain picks error:", err);
      setAiError(
        "SuperScout is thinking too hard — try again in a moment.",
      );
    } finally {
      clearStageTimers();
      setAiLoading(false);
    }
  }, [candidateData, vibe, clearStageTimers]);

  const logRecommendationSilently = async (
    data: CaptainPicksResponse,
    gw: number,
  ) => {
    try {
      const apiBase = getApiBaseUrl();
      await fetch(`${apiBase}/decision-log/recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameweek: gw,
          decision_type: "captain",
          options_shown: data.recommendations,
          persona_used: vibe,
          tier_at_time: "free",
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

  if (candidateData?.noSquadData || (candidateData && candidateData.candidates.length === 0 && !candidateData.isMockData)) {
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
          Captain Picker
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          GW{candidateData?.gameweek ?? "?"} ·{" "}
          {candidateData?.candidates.length ?? 0} players
          {isMockData ? " · TEST MODE" : ""}
        </Text>

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
            <View style={styles.cardsContainer}>
              {recommendations.map((rec) => (
                <ChoiceCard
                  key={rec.player_name}
                  recommendation={rec}
                />
              ))}
            </View>

            <Text style={[styles.fplReminder, { color: colors.mutedForeground }]}>
              Set your captain in the official FPL app before the deadline
            </Text>

            <Pressable
              onPress={requestPicks}
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
  }>,
  gameweek: number,
  deadlineTime: string,
  vibe: string,
): string {
  const squadSummary = candidates
    .map(
      (c) =>
        `- ${c.name} (${c.position}, ${c.team}) | Form: ${c.form} | Total Pts: ${c.totalPoints} | Ownership: ${c.ownershipPct}% | Price: £${c.price}m | vs ${c.opponent} | FDR: ${c.fixtureDifficulty} | Status: ${c.status}${c.chanceOfPlaying !== null && c.chanceOfPlaying < 100 ? ` (${c.chanceOfPlaying}% chance)` : ""}`,
    )
    .join("\n");

  return `GAMEWEEK: ${gameweek}
DEADLINE: ${deadlineTime}
VIBE: ${vibe}

SQUAD (15 players with upcoming fixtures):
${squadSummary}

You are generating captain recommendations for this FPL manager. Analyse their squad and upcoming fixtures. Return exactly 3 captain options. For each option provide: the player name, their team, the opponent and whether it is home or away, an expected points estimate (your best estimate based on form, fixtures, and historical data), a confidence level (one of: BANKER, CALCULATED_RISK, or BOLD_PUNT), the player's ownership percentage, one clear upside sentence, one clear risk sentence, a persona-voiced one-liner making the case for this pick (this is where your personality shines — make it memorable), and whether this is the SuperScout Pick (exactly one option must be true).

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
      "is_superscout_pick": true|false
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
- ownership_pct should match the data provided.`;
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
