import { View, Text, Pressable, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { CaptainRecommendation } from "@/services/fpl/types";

interface ChoiceCardProps {
  recommendation: CaptainRecommendation;
  isSelected: boolean;
  onSelect: () => void;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "#22c55e",
  MEDIUM: "#f59e0b",
  SPECULATIVE: "#ef4444",
};

export default function ChoiceCard({
  recommendation,
  isSelected,
  onSelect,
}: ChoiceCardProps) {
  const colors = useColors();
  const confidenceColor =
    CONFIDENCE_COLORS[recommendation.confidence] ?? colors.mutedForeground;
  const isSuperScoutPick = recommendation.is_superscout_pick;

  return (
    <Pressable onPress={onSelect}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isSelected
              ? colors.accent
              : isSuperScoutPick
                ? colors.accent + "60"
                : colors.border,
            borderWidth: isSelected ? 2 : isSuperScoutPick ? 1.5 : 1,
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
              { backgroundColor: confidenceColor + "20", borderColor: confidenceColor },
            ]}
          >
            <Text style={[styles.confidenceText, { color: confidenceColor }]}>
              {recommendation.confidence}
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

        {isSelected && (
          <View style={[styles.selectedIndicator, { backgroundColor: colors.accent }]}>
            <Text style={[styles.selectedText, { color: colors.primary }]}>
              Selected
            </Text>
          </View>
        )}
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
  selectedIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    alignItems: "center",
  },
  selectedText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
