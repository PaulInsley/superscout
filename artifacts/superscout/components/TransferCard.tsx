import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface TransferRecommendation {
  player_out: string | null;
  player_out_team: string | null;
  player_out_selling_price: number | null;
  player_in: string | null;
  player_in_team: string | null;
  player_in_price: number | null;
  net_cost: number | null;
  uses_free_transfer: boolean;
  hit_cost: number;
  expected_points_gain_3gw: number;
  confidence: "BANKER" | "CALCULATED_RISK" | "BOLD_PUNT";
  upside: string;
  risk: string;
  case: string;
  is_superscout_pick: boolean;
  is_hold_recommendation?: boolean;
}

const CONFIDENCE_CONFIG: Record<string, { label: string; color: string }> = {
  BANKER: { label: "Banker", color: "#22c55e" },
  CALCULATED_RISK: { label: "Calculated Risk", color: "#f59e0b" },
  BOLD_PUNT: { label: "Bold Punt", color: "#f97316" },
};

export default function TransferCard({ recommendation }: { recommendation: TransferRecommendation }) {
  const colors = useColors();
  const conf = CONFIDENCE_CONFIG[recommendation.confidence] ?? {
    label: recommendation.confidence,
    color: colors.mutedForeground,
  };
  const isSuperScoutPick = recommendation.is_superscout_pick;
  const isHold = recommendation.is_hold_recommendation;

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

      {isHold ? (
        <View style={styles.header}>
          <View style={[styles.holdIcon, { backgroundColor: colors.accent + "20" }]}>
            <Text style={styles.holdEmoji}>⏸️</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.playerName, { color: colors.foreground }]}>
              Hold Your Transfer
            </Text>
            <Text style={[styles.teamLine, { color: colors.mutedForeground }]}>
              Save it for next week
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.swapRow}>
              <View style={styles.playerBlock}>
                <Text style={[styles.outLabel, { color: "#ef4444" }]}>OUT</Text>
                <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>
                  {recommendation.player_out}
                </Text>
                <Text style={[styles.teamLine, { color: colors.mutedForeground }]}>
                  {recommendation.player_out_team}
                  {recommendation.player_out_selling_price != null
                    ? ` · £${recommendation.player_out_selling_price.toFixed(1)}m`
                    : ""}
                </Text>
              </View>
              <Text style={[styles.arrow, { color: colors.accent }]}>→</Text>
              <View style={styles.playerBlock}>
                <Text style={[styles.inLabel, { color: "#22c55e" }]}>IN</Text>
                <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>
                  {recommendation.player_in}
                </Text>
                <Text style={[styles.teamLine, { color: colors.mutedForeground }]}>
                  {recommendation.player_in_team}
                  {recommendation.player_in_price != null
                    ? ` · £${recommendation.player_in_price.toFixed(1)}m`
                    : ""}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

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

        {!isHold && (
          <>
            {recommendation.net_cost != null && (
              <Text style={[styles.costText, { color: colors.mutedForeground }]}>
                {recommendation.net_cost > 0
                  ? `Costs £${recommendation.net_cost.toFixed(1)}m`
                  : recommendation.net_cost < 0
                    ? `Saves £${Math.abs(recommendation.net_cost).toFixed(1)}m`
                    : "Free swap"}
              </Text>
            )}

            {recommendation.hit_cost > 0 ? (
              <View style={[styles.hitBadge, { backgroundColor: "#ef444420" }]}>
                <Text style={[styles.hitText, { color: "#ef4444" }]}>
                  -{recommendation.hit_cost}pt hit
                </Text>
              </View>
            ) : (
              <View style={[styles.freeBadge, { backgroundColor: "#22c55e20" }]}>
                <Text style={[styles.freeText, { color: "#22c55e" }]}>
                  Free transfer
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {!isHold && (
        <View style={[styles.impactRow, { backgroundColor: colors.primary + "10" }]}>
          <Text style={[styles.impactLabel, { color: colors.mutedForeground }]}>
            Expected 3GW impact
          </Text>
          <Text style={[styles.impactValue, { color: recommendation.expected_points_gain_3gw >= 0 ? "#22c55e" : "#ef4444" }]}>
            {recommendation.expected_points_gain_3gw >= 0 ? "+" : ""}
            {recommendation.expected_points_gain_3gw.toFixed(1)} pts
          </Text>
        </View>
      )}

      <View style={styles.reasoningContainer}>
        <View style={styles.reasonRow}>
          <Text style={[styles.reasonLabel, { color: "#22c55e" }]}>Upside</Text>
          <Text style={[styles.reasonText, { color: colors.foreground }]} numberOfLines={2}>
            {recommendation.upside}
          </Text>
        </View>
        <View style={styles.reasonRow}>
          <Text style={[styles.reasonLabel, { color: "#ef4444" }]}>Risk</Text>
          <Text style={[styles.reasonText, { color: colors.foreground }]} numberOfLines={2}>
            {recommendation.risk}
          </Text>
        </View>
      </View>

      <View style={[styles.caseContainer, { backgroundColor: colors.primary + "15" }]}>
        <Text style={[styles.caseText, { color: colors.foreground, fontStyle: "italic" }]}>
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
  holdIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  holdEmoji: {
    fontSize: 20,
  },
  swapRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  playerBlock: {
    flex: 1,
  },
  outLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 2,
  },
  inLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 2,
  },
  arrow: {
    fontSize: 20,
    fontWeight: "700",
    marginHorizontal: 8,
    marginTop: 10,
  },
  playerName: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  teamLine: {
    fontSize: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
    flexWrap: "wrap",
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
  costText: {
    fontSize: 12,
  },
  hitBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hitText: {
    fontSize: 11,
    fontWeight: "700",
  },
  freeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  freeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  impactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 10,
  },
  impactLabel: {
    fontSize: 12,
  },
  impactValue: {
    fontSize: 16,
    fontWeight: "800",
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
