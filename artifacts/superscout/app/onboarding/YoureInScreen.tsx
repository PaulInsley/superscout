import React, { useEffect, useState, useRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import config from "@/constants/config";
import { fetchCaptainCandidates } from "@/services/fpl/api";

interface Props {
  teamName: string | null;
  managerId: number | null;
  vibe: "expert" | "critic" | "fanboy" | null;
  onFinish: () => void;
}

interface MiniRecommendation {
  playerName: string;
  confidence: string;
  reason: string;
}

const FETCH_TIMEOUT_MS = 12000;

export default function YoureInScreen({ teamName, managerId, vibe, onFinish }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [recommendation, setRecommendation] = useState<MiniRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [gave_up, setGaveUp] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!managerId) return;
    setLoading(true);
    setGaveUp(false);
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const apiBase = `https://${domain}/api`;
    const persona = vibe || "expert";

    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    (async () => {
      try {
        const result = await fetchCaptainCandidates(managerId);
        if (controller.signal.aborted) return;
        if (!result.candidates.length) throw new Error("No candidates available");

        const squadSummary = result.candidates
          .map(
            (c) =>
              `- ${c.name} (${c.position}, ${c.team}) | Pos: ${c.pickPosition}${c.isBench ? " [BENCH]" : ""} | Form: ${c.form} | Total Pts: ${c.totalPoints} | Ownership: ${c.ownershipPct}% | Price: £${c.price}m | vs ${c.opponent} | FDR: ${c.fixtureDifficulty} | Status: ${c.status}${c.chanceOfPlaying !== null && c.chanceOfPlaying < 100 ? ` (${c.chanceOfPlaying}% chance)` : ""}`,
          )
          .join("\n");

        const context = `GAMEWEEK: ${result.gameweek}
DEADLINE: ${result.deadlineTime}
VIBE: ${persona}

SQUAD (15 players — positions 1-11 = starting XI, 12-15 = bench):
${squadSummary}

You are generating captain recommendations for this FPL manager. Analyse their squad and upcoming fixtures. Return exactly 3 captain options. For each option provide: the player name, their team, the opponent and whether it is home or away, an expected points estimate, a confidence level (one of: BANKER, CALCULATED_RISK, or BOLD_PUNT), the player's ownership percentage, one clear upside sentence, one clear risk sentence, a persona-voiced one-liner making the case for this pick, and whether this is the SuperScout Pick (exactly one must be true).

You MUST respond with valid JSON only — no markdown, no preamble, no backticks. Use this exact JSON structure:
{
  "gameweek": ${result.gameweek},
  "recommendations": [
    {
      "player_name": "Player Name",
      "team": "Team Short Name",
      "opponent": "OPP (H/A)",
      "expected_points": 8,
      "confidence": "BANKER",
      "ownership_pct": 50,
      "ownership_context": "One short sentence about what this ownership means for rank",
      "upside": "One sentence",
      "risk": "One sentence",
      "case": "Persona one-liner",
      "is_superscout_pick": true
    }
  ]
}`;

        const captainRes = await fetch(`${apiBase}/captain-picks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vibe: persona, context }),
          signal: controller.signal,
        });
        if (!captainRes.ok) throw new Error(`Captain HTTP ${captainRes.status}`);
        const data = await captainRes.json();

        if (controller.signal.aborted) return;

        const picks = data?.recommendations ?? data?.picks ?? [];
        if (picks.length > 0) {
          const top =
            picks.find((p: Record<string, unknown>) => p.is_superscout_pick) ?? picks[0];
          setRecommendation({
            playerName: top.web_name ?? top.player_name ?? "Unknown",
            confidence: top.confidence ?? "BANKER",
            reason: top.case ?? top.upside ?? "",
          });
        } else {
          setGaveUp(true);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          console.warn("[YoureIn] recommendation fetch timed out");
        } else {
          console.warn("[YoureIn] recommendation fetch failed:", err);
        }
        setGaveUp(true);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    })();

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [managerId, vibe]);

  const confLabel =
    recommendation?.confidence === "BOLD_PUNT"
      ? "Bold Punt"
      : recommendation?.confidence === "CALCULATED_RISK"
        ? "Calculated Risk"
        : "Banker";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.primary, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.content}>
        <Feather name="check-circle" size={64} color={colors.accent} accessibilityElementsHidden={true} />
        <Text style={[styles.heading, { color: colors.primaryForeground }]}>
          {teamName ? teamName : `Welcome to ${config.brandName}`}
        </Text>
        <Text style={[styles.subtext, { color: colors.primaryForeground }]}>
          {recommendation
            ? "Your first recommendation is ready."
            : gave_up
              ? "You're all set — let's go!"
              : "Getting your first recommendation..."}
        </Text>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.loadingHint, { color: colors.primaryForeground }]}>
              Analysing your squad...
            </Text>
          </View>
        )}

        {recommendation && !loading && (
          <View style={[styles.previewCard, { backgroundColor: colors.primary + "dd" }]}>
            <Text style={[styles.previewLabel, { color: colors.accent }]}>SuperScout Pick</Text>
            <Text style={[styles.previewPlayer, { color: colors.primaryForeground }]}>
              {recommendation.playerName}
            </Text>
            <View style={[styles.confBadge, { backgroundColor: colors.accent + "30" }]}>
              <Text style={[styles.confText, { color: colors.accent }]}>{confLabel}</Text>
            </View>
            {recommendation.reason ? (
              <Text
                style={[styles.previewReason, { color: colors.primaryForeground }]}
                numberOfLines={3}
              >
                "{recommendation.reason}"
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <Pressable
        onPress={onFinish}
        accessibilityLabel="See my squad"
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.primary }]}>See my squad</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  heading: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtext: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    opacity: 0.9,
    textAlign: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  loadingHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    opacity: 0.7,
  },
  previewCard: {
    borderRadius: 12,
    padding: 16,
    width: "100%",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  previewPlayer: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  confBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  confText: {
    fontSize: 12,
    fontWeight: "700",
  },
  previewReason: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    opacity: 0.85,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 4,
  },
  button: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
});
