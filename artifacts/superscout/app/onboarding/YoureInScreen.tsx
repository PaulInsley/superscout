import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import config from "@/constants/config";

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

export default function YoureInScreen({ teamName, managerId, vibe, onFinish }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [recommendation, setRecommendation] = useState<MiniRecommendation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!managerId) return;
    setLoading(true);
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const apiBase = `https://${domain}/api`;
    const persona = vibe || "expert";

    (async () => {
      try {
        const bootstrapRes = await fetch(`${apiBase}/fpl/bootstrap-static`);
        if (!bootstrapRes.ok) throw new Error(`Bootstrap HTTP ${bootstrapRes.status}`);
        const bootstrap = await bootstrapRes.json();

        const currentGw =
          bootstrap.events?.find((e: { is_current: boolean }) => e.is_current)?.id ?? 1;
        const deadlineTime =
          bootstrap.events?.find((e: { id: number }) => e.id === currentGw)?.deadline_time ?? "";

        const picksRes = await fetch(`${apiBase}/fpl/entry/${managerId}/event/${currentGw}/picks`);
        if (!picksRes.ok) throw new Error(`Picks HTTP ${picksRes.status}`);
        const picksData = await picksRes.json();

        const squad = (picksData.picks ?? []).slice(0, 11);
        const elements = bootstrap.elements ?? [];
        const teams = bootstrap.teams ?? [];

        const candidates = squad.map(
          (pick: { element: number; position: number; is_captain: boolean }) => {
            const el = elements.find((e: { id: number }) => e.id === pick.element);
            if (!el) return null;
            const team = teams.find((t: { id: number }) => t.id === el.team);
            return `${el.web_name} (${team?.short_name ?? "?"}) - Form: ${el.form}, Pts: ${el.total_points}, Own: ${el.selected_by_percent}%`;
          },
        );

        const context = `Gameweek ${currentGw}. Deadline: ${deadlineTime}. Manager's starting XI:\n${candidates.filter(Boolean).join("\n")}`;

        const captainRes = await fetch(`${apiBase}/captain-picks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vibe: persona, context }),
        });
        if (!captainRes.ok) throw new Error(`Captain HTTP ${captainRes.status}`);
        const data = await captainRes.json();

        const picks = data?.recommendations ?? data?.picks ?? [];
        if (picks.length > 0) {
          const top =
            picks.find((p: Record<string, unknown>) => p.is_superscout_pick) ?? picks[0];
          setRecommendation({
            playerName: top.web_name ?? top.player_name ?? "Unknown",
            confidence: top.confidence ?? "BANKER",
            reason: top.case ?? top.upside ?? "",
          });
        }
      } catch (err: unknown) {
        console.warn("[YoureIn] recommendation fetch failed:", err);
      } finally {
        setLoading(false);
      }
    })();
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
          Your first recommendation is ready.
        </Text>

        {loading && (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 16 }} />
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
