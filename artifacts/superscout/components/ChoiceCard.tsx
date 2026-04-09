import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
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
  const conf = CONFIDENCE_CONFIG[recommendation.confidence] ?? {
    label: recommendation.confidence,
    color: colors.mutedForeground,
  };
  const isSuperScoutPick = recommendation.is_superscout_pick;

  return (
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
          <Text
            style={[styles.playerName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {recommendation.player_name}
          </Text>
          <Text style={[styles.teamLine, { color: colors.mutedForeground }]}>
            {recommendation.team} vs {recommendation.opponent}
          </Text>
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
            numberOfLines={2}
          >
            {recommendation.upside}
          </Text>
        </View>
        <View style={styles.reasonRow}>
          <Text style={[styles.reasonLabel, { color: "#ef4444" }]}>Risk</Text>
          <Text
            style={[styles.reasonText, { color: colors.foreground }]}
            numberOfLines={2}
          >
            {recommendation.risk}
          </Text>
        </View>
      </View>

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
        >
          "{recommendation.case}"
        </Text>
      </View>
    </View>
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
  playerName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
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
  caseContainer: {
    padding: 10,
    borderRadius: 8,
  },
  caseText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
