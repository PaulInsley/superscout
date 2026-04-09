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
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import ChoiceCard from "@/components/ChoiceCard";
import { fetchCaptainCandidates } from "@/services/fpl/api";
import { logRecommendation, logUserDecision } from "@/services/decisionLog";
import type {
  CaptainRecommendation,
  CaptainPicksResponse,
} from "@/services/fpl/types";

const MANAGER_ID_KEY = "superscout_manager_id";
const PERSONA_KEY = "superscout_persona";

const CONFIRM_MESSAGES: Record<string, string> = {
  expert:
    "Locked in. The data backs this decision. Now we wait for the numbers to confirm it.",
  critic:
    "Bold choice. Don't come crying to me on Monday.",
  fanboy:
    "LET'S GOOOOO!! THIS IS YOUR WEEK BRO!! 🔥",
};

function getApiBaseUrl(): string {
  if (Platform.OS === "web") {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return `https://${domain}/api`;
  }
  return "https://superscout.pro/api";
}

export default function CaptainPickerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [recommendations, setRecommendations] = useState<
    CaptainRecommendation[] | null
  >(null);
  const [recommendationId, setRecommendationId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [gameweek, setGameweek] = useState<number>(0);
  const [deadlineTime, setDeadlineTime] = useState<string>("");
  const [isMockData, setIsMockData] = useState(false);
  const [vibe, setVibe] = useState<"expert" | "critic" | "fanboy">("expert");

  const {
    data: candidateData,
    isLoading: candidatesLoading,
    error: candidatesError,
  } = useQuery({
    queryKey: ["captainCandidates"],
    queryFn: async () => {
      const managerId = await AsyncStorage.getItem(MANAGER_ID_KEY);
      const persona = await AsyncStorage.getItem(PERSONA_KEY);
      if (persona === "critic" || persona === "fanboy") {
        setVibe(persona);
      }
      if (!managerId) {
        throw new Error("NO_MANAGER_ID");
      }
      return fetchCaptainCandidates(parseInt(managerId, 10));
    },
  });

  const requestPicks = useCallback(async () => {
    if (!candidateData) return;

    setAiLoading(true);
    setAiError(null);
    setRecommendations(null);
    setSelectedIndex(null);
    setConfirmed(false);
    setGameweek(candidateData.gameweek);
    setDeadlineTime(candidateData.deadlineTime);
    setIsMockData(candidateData.isMockData);

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

      const data: CaptainPicksResponse = await response.json();
      setRecommendations(data.recommendations);

      const superscoutIdx = data.recommendations.findIndex(
        (r) => r.is_superscout_pick,
      );
      if (superscoutIdx >= 0) {
        setSelectedIndex(superscoutIdx);
      }

      logRecommendationSilently(data, candidateData.gameweek);
    } catch {
      setAiError(
        "SuperScout is thinking too hard — try again in a moment.",
      );
    } finally {
      setAiLoading(false);
    }
  }, [candidateData, vibe]);

  const logRecommendationSilently = async (
    data: CaptainPicksResponse,
    gw: number,
  ) => {
    try {
      const id = await logRecommendation({
        user_id: "anonymous",
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
            r.confidence === "HIGH"
              ? 0.9
              : r.confidence === "MEDIUM"
                ? 0.6
                : 0.3,
          confidence_label: r.confidence,
          upside_text: r.upside,
          risk_text: r.risk,
          is_superscout_pick: r.is_superscout_pick,
        })),
      });
      if (id) setRecommendationId(id);
    } catch {
      // silent
    }
  };

  const handleConfirm = async () => {
    if (selectedIndex === null || !recommendations) return;

    const chosen = recommendations[selectedIndex];
    setConfirmed(true);
    setConfirmMessage(CONFIRM_MESSAGES[vibe] ?? CONFIRM_MESSAGES.expert);

    if (recommendationId) {
      try {
        await logUserDecision({
          recommendation_id: recommendationId,
          user_id: "anonymous",
          recommendation_option_id: recommendationId,
          chosen_option: chosen.player_name,
          hours_before_deadline: deadlineTime
            ? (new Date(deadlineTime).getTime() - Date.now()) / 3600000
            : null,
        });
      } catch {
        // silent
      }
    }
  };

  const isLoading = candidatesLoading;
  const hasError = candidatesError;

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
    const errorMsg =
      hasError instanceof Error && hasError.message === "NO_MANAGER_ID"
        ? "Connect your FPL account in Settings to use the Captain Picker."
        : "Could not load squad data. Check your connection and try again.";

    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <Text style={[styles.errorText, { color: colors.destructive }]}>
          {errorMsg}
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
          <View style={styles.aiLoadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text
              style={[styles.loadingText, { color: colors.mutedForeground }]}
            >
              SuperScout is analysing your squad...
            </Text>
          </View>
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
          <View style={styles.cardsContainer}>
            {recommendations.map((rec, i) => (
              <ChoiceCard
                key={rec.player_name}
                recommendation={rec}
                isSelected={selectedIndex === i}
                onSelect={() => {
                  if (!confirmed) setSelectedIndex(i);
                }}
              />
            ))}
          </View>
        )}

        {confirmed && (
          <View
            style={[
              styles.confirmationBanner,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={[styles.confirmationText, { color: colors.accent }]}
            >
              {confirmMessage}
            </Text>
          </View>
        )}
      </ScrollView>

      {recommendations && selectedIndex !== null && !confirmed && (
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 16,
              borderTopColor: colors.border,
            },
          ]}
        >
          <Pressable
            onPress={handleConfirm}
            style={[styles.confirmButton, { backgroundColor: colors.accent }]}
          >
            <Text
              style={[styles.confirmButtonText, { color: colors.primary }]}
            >
              Confirm Captain: {recommendations[selectedIndex].player_name}
            </Text>
          </Pressable>
        </View>
      )}
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

You are generating captain recommendations for this FPL manager. Analyse their squad and upcoming fixtures. Return exactly 3 captain options. For each option provide: the player name, their team, the opponent and whether it is home or away, an expected points estimate (your best estimate based on form, fixtures, and historical data), a confidence level (one of: HIGH, MEDIUM, or SPECULATIVE), the player's ownership percentage, one clear upside sentence, one clear risk sentence, a persona-voiced one-liner making the case for this pick (this is where your personality shines — make it memorable), and whether this is the SuperScout Pick (exactly one option must be true).

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
      "confidence": "HIGH|MEDIUM|SPECULATIVE",
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
  confirmationBanner: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    alignItems: "center",
  },
  confirmationText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 22,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  confirmButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
