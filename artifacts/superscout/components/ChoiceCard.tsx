import { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import FixtureTicker from "@/components/FixtureTicker";
import type { CaptainRecommendation } from "@/services/fpl/types";

interface ChoiceCardProps {
  recommendation: CaptainRecommendation;
}

const CONFIDENCE_CONFIG: Record<string, { label: string; color: string }> = {
  BANKER: { label: "Banker", color: "#22c55e" },
  CALCULATED_RISK: { label: "Calculated Risk", color: "#f59e0b" },
  BOLD_PUNT: { label: "Bold Punt", color: "#f97316" },
};

export default function ChoiceCard({ recommendation }: ChoiceCardProps) {
  const colors = useColors();
  const isSuperScoutPick = recommendation.is_superscout_pick;
  const [expanded, setExpanded] = useState(isSuperScoutPick);
  const conf = CONFIDENCE_CONFIG[recommendation.confidence] ?? {
    label: recommendation.confidence,
    color: colors.mutedForeground,
  };
  const hasLineupChanges = recommendation.lineup_changes && recommendation.lineup_changes.length > 0;

  return (
    <Pressable onPress={() => setExpanded((prev) => !prev)}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isSuperScoutPick ? colors.accent + "60" : colors.border,
            borderWidth: isSuperScoutPick ? 1.5 : 1,
          },
        ]}
      >
        {isSuperScoutPick && (
          <View style={[styles.badge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              SuperScout Pick
            </Text>
          </View>
        )}

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.playerName, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {recommendation.player_name}
              </Text>
              {recommendation.is_on_bench && (
                <View style={[styles.benchBadge, { backgroundColor: "#f59e0b20", borderColor: "#f59e0b" }]}>
                  <Text style={[styles.benchBadgeText, { color: "#f59e0b" }]}>BENCH</Text>
                </View>
              )}
            </View>
            <Text style={[styles.teamLine, { color: colors.mutedForeground }]}>
              {recommendation.team} vs {recommendation.opponent}
            </Text>
            {recommendation.team ? <FixtureTicker teamShortName={recommendation.team} /> : null}
          </View>
          <View style={styles.pointsContainer}>
            <Text style={[styles.expectedPoints, { color: colors.accent }]}>
              {recommendation.expected_points.toFixed(1)}
            </Text>
            <Text
              style={[styles.pointsLabel, { color: colors.mutedForeground }]}
            >
              exp pts
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View
            style={[
              styles.confidenceBadge,
              { backgroundColor: conf.color + "20", borderColor: conf.color },
            ]}
          >
            <Text style={[styles.confidenceText, { color: conf.color }]}>
              {conf.label}
            </Text>
          </View>
          <Text style={[styles.ownership, { color: colors.mutedForeground }]}>
            {recommendation.ownership_pct.toFixed(1)}% owned
          </Text>
        </View>

        <View style={styles.reasoningContainer}>
          <View style={styles.reasonRow}>
            <Text style={[styles.reasonLabel, { color: "#22c55e" }]}>
              Upside
            </Text>
            <Text
              style={[styles.reasonText, { color: colors.foreground }]}
              numberOfLines={expanded ? undefined : 2}
            >
              {recommendation.upside}
            </Text>
          </View>
          <View style={styles.reasonRow}>
            <Text style={[styles.reasonLabel, { color: "#ef4444" }]}>Risk</Text>
            <Text
              style={[styles.reasonText, { color: colors.foreground }]}
              numberOfLines={expanded ? undefined : 2}
            >
              {recommendation.risk}
            </Text>
          </View>
        </View>

        {hasLineupChanges && (
          <View style={[styles.lineupContainer, { backgroundColor: "#8b5cf610", borderColor: "#8b5cf640" }]}>
            <View style={styles.lineupHeader}>
              <Feather name="shuffle" size={13} color="#8b5cf6" />
              <Text style={[styles.lineupTitle, { color: "#8b5cf6" }]}>
                Lineup Changes
              </Text>
            </View>
            {recommendation.lineup_changes!.map((change, idx) => (
              <View key={idx} style={styles.lineupSwap}>
                <View style={styles.swapRow}>
                  <Feather name="arrow-up" size={11} color="#22c55e" />
                  <Text style={[styles.swapPlayerIn, { color: colors.foreground }]}>
                    {change.player_in}
                  </Text>
                  <Feather name="arrow-down" size={11} color="#ef4444" />
                  <Text style={[styles.swapPlayerOut, { color: colors.mutedForeground }]}>
                    {change.player_out}
                  </Text>
                </View>
                {expanded && (
                  <Text style={[styles.swapReason, { color: colors.mutedForeground }]}>
                    {change.reason}
                  </Text>
                )}
              </View>
            ))}
            {expanded && recommendation.lineup_note && (
              <Text style={[styles.lineupNote, { color: colors.mutedForeground }]}>
                {recommendation.lineup_note}
              </Text>
            )}
          </View>
        )}

        <View
          style={[
            styles.caseContainer,
            { backgroundColor: colors.primary + "15" },
          ]}
        >
          <Text
            style={[
              styles.caseText,
              { color: colors.foreground, fontStyle: "italic" },
            ]}
            numberOfLines={expanded ? undefined : 2}
          >
            "{recommendation.case}"
          </Text>
        </View>

        <View style={styles.expandRow}>
          <Text style={[styles.expandText, { color: colors.accent }]}>
            {expanded ? "Show less ▲" : "Read more ▼"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    position: "relative",
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  playerName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  benchBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 2,
  },
  benchBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  teamLine: {
    fontSize: 13,
  },
  pointsContainer: {
    alignItems: "center",
    marginLeft: 12,
  },
  expectedPoints: {
    fontSize: 24,
    fontWeight: "800",
  },
  pointsLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  ownership: {
    fontSize: 12,
  },
  reasoningContainer: {
    gap: 6,
    marginBottom: 10,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: "700",
    width: 45,
    letterSpacing: 0.3,
  },
  reasonText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  lineupContainer: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    gap: 6,
  },
  lineupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  lineupTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  lineupSwap: {
    gap: 2,
  },
  swapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  swapPlayerIn: {
    fontSize: 13,
    fontWeight: "600",
    marginRight: 6,
  },
  swapPlayerOut: {
    fontSize: 13,
  },
  swapReason: {
    fontSize: 11,
    marginLeft: 15,
  },
  lineupNote: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 2,
  },
  caseContainer: {
    padding: 10,
    borderRadius: 8,
  },
  caseText: {
    fontSize: 13,
    lineHeight: 18,
  },
  expandRow: {
    alignItems: "center",
    marginTop: 8,
  },
  expandText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
