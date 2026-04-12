import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import FixtureTicker from "@/components/FixtureTicker";

export interface TransferSwap {
  player_out: string;
  player_out_team: string;
  player_out_selling_price?: number | null;
  player_in: string;
  player_in_team: string;
  player_in_price?: number | null;
}

export interface TransferRecommendation {
  player_out?: string | null;
  player_out_team?: string | null;
  player_out_selling_price?: number | null;
  player_in?: string | null;
  player_in_team?: string | null;
  player_in_price?: number | null;
  net_cost?: number | null;
  uses_free_transfer?: boolean;
  hit_cost?: number;
  expected_points_gain_3gw?: number;
  confidence: "BANKER" | "CALCULATED_RISK" | "BOLD_PUNT";
  upside: string;
  risk: string;
  case: string;
  is_superscout_pick: boolean;
  is_hold_recommendation?: boolean;
  is_package?: boolean;
  package_name?: string;
  transfers?: TransferSwap[];
  total_net_cost?: number;
  total_hit_cost?: number;
  uses_free_transfers?: number;
  total_expected_points_gain_3gw?: number;
}

const CONFIDENCE_CONFIG: Record<string, { label: string; color: string }> = {
  BANKER: { label: "Banker", color: "#22c55e" },
  CALCULATED_RISK: { label: "Calculated Risk", color: "#f59e0b" },
  BOLD_PUNT: { label: "Bold Punt", color: "#f97316" },
};

function SingleSwapRow({ playerOut, playerOutTeam, playerOutPrice, playerIn, playerInTeam, playerInPrice, colors }: {
  playerOut: string;
  playerOutTeam: string;
  playerOutPrice?: number | null;
  playerIn: string;
  playerInTeam: string;
  playerInPrice?: number | null;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View>
      <View style={styles.swapRow}>
        <View style={styles.playerBlock}>
          <Text style={[styles.outLabel, { color: "#ef4444" }]}>OUT</Text>
          <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>
            {playerOut}
          </Text>
          <Text style={[styles.teamLine, { color: colors.mutedForeground }]}>
            {playerOutTeam}
            {typeof playerOutPrice === "number" ? ` · £${playerOutPrice.toFixed(1)}m` : ""}
          </Text>
          <FixtureTicker teamShortName={playerOutTeam} />
        </View>
        <Text style={[styles.arrow, { color: colors.accent }]}>→</Text>
        <View style={styles.playerBlock}>
          <Text style={[styles.inLabel, { color: "#22c55e" }]}>IN</Text>
          <Text style={[styles.playerName, { color: colors.foreground }]} numberOfLines={1}>
            {playerIn}
          </Text>
          <Text style={[styles.teamLine, { color: colors.mutedForeground }]}>
            {playerInTeam}
            {typeof playerInPrice === "number" ? ` · £${playerInPrice.toFixed(1)}m` : ""}
          </Text>
          <FixtureTicker teamShortName={playerInTeam} />
        </View>
      </View>
    </View>
  );
}

export default function TransferCard({ recommendation }: { recommendation: TransferRecommendation }) {
  const colors = useColors();
  const conf = CONFIDENCE_CONFIG[recommendation.confidence] ?? {
    label: recommendation.confidence,
    color: colors.mutedForeground,
  };
  const isSuperScoutPick = recommendation.is_superscout_pick;
  const isHold = recommendation.is_hold_recommendation;
  const isPackage = recommendation.is_package && Array.isArray(recommendation.transfers) && recommendation.transfers.length > 0;

  const pointsImpact = isPackage
    ? recommendation.total_expected_points_gain_3gw ?? 0
    : recommendation.expected_points_gain_3gw ?? 0;

  const netCost = isPackage
    ? recommendation.total_net_cost ?? 0
    : recommendation.net_cost ?? 0;

  const hitCost = isPackage
    ? recommendation.total_hit_cost ?? 0
    : recommendation.hit_cost ?? 0;

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
              Hold Your Transfer{(recommendation.uses_free_transfers ?? 0) > 1 ? "s" : ""}
            </Text>
            <Text style={[styles.teamLine, { color: colors.mutedForeground }]}>
              Save {(recommendation.uses_free_transfers ?? 1) > 1 ? "them" : "it"} for next week
            </Text>
          </View>
        </View>
      ) : isPackage ? (
        <View style={styles.packageHeader}>
          <View style={[styles.packageBanner, { backgroundColor: colors.accent + "15" }]}>
            <Text style={[styles.packageIcon]}>📦</Text>
            <Text style={[styles.packageName, { color: colors.accent }]}>
              {recommendation.package_name ?? "Transfer Package"}
            </Text>
            {recommendation.uses_free_transfers != null && (
              <Text style={[styles.packageFtCount, { color: colors.mutedForeground }]}>
                {recommendation.uses_free_transfers} FT
              </Text>
            )}
          </View>
          <View style={styles.packageSwaps}>
            {recommendation.transfers!.map((swap, i) => (
              <View key={`${swap.player_out}-${swap.player_in}-${i}`}>
                {i > 0 && <View style={[styles.swapDivider, { backgroundColor: colors.border }]} />}
                <SingleSwapRow
                  playerOut={swap.player_out}
                  playerOutTeam={swap.player_out_team}
                  playerOutPrice={swap.player_out_selling_price}
                  playerIn={swap.player_in}
                  playerInTeam={swap.player_in_team}
                  playerInPrice={swap.player_in_price}
                  colors={colors}
                />
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <SingleSwapRow
              playerOut={recommendation.player_out ?? ""}
              playerOutTeam={recommendation.player_out_team ?? ""}
              playerOutPrice={recommendation.player_out_selling_price ?? null}
              playerIn={recommendation.player_in ?? ""}
              playerInTeam={recommendation.player_in_team ?? ""}
              playerInPrice={recommendation.player_in_price ?? null}
              colors={colors}
            />
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
            {typeof netCost === "number" && netCost !== 0 && (
              <Text style={[styles.costText, { color: colors.mutedForeground }]}>
                {netCost > 0
                  ? `Costs £${netCost.toFixed(1)}m`
                  : `Saves £${Math.abs(netCost).toFixed(1)}m`}
              </Text>
            )}
            {(netCost === 0 || netCost == null) && !isPackage && (
              <Text style={[styles.costText, { color: colors.mutedForeground }]}>
                Free swap
              </Text>
            )}

            {hitCost > 0 ? (
              <View style={[styles.hitBadge, { backgroundColor: "#ef444420" }]}>
                <Text style={[styles.hitText, { color: "#ef4444" }]}>
                  -{hitCost}pt hit
                </Text>
              </View>
            ) : (
              <View style={[styles.freeBadge, { backgroundColor: "#22c55e20" }]}>
                <Text style={[styles.freeText, { color: "#22c55e" }]}>
                  {isPackage ? `${recommendation.uses_free_transfers ?? 0} free transfers` : "Free transfer"}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {!isHold && (
        <View style={[styles.impactRow, { backgroundColor: colors.primary + "10" }]}>
          <Text style={[styles.impactLabel, { color: colors.mutedForeground }]}>
            {isPackage ? "Combined 3GW impact" : "Expected 3GW impact"}
          </Text>
          <Text style={[styles.impactValue, { color: typeof pointsImpact === "number" && pointsImpact >= 0 ? "#22c55e" : "#ef4444" }]}>
            {typeof pointsImpact === "number" && pointsImpact >= 0 ? "+" : ""}
            {typeof pointsImpact === "number" ? pointsImpact.toFixed(1) : "0.0"} pts
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
  packageHeader: {
    marginBottom: 10,
  },
  packageBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  packageIcon: {
    fontSize: 16,
  },
  packageName: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  packageFtCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  packageSwaps: {
    gap: 0,
  },
  swapDivider: {
    height: 1,
    marginVertical: 8,
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
