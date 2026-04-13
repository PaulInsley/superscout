import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import FixtureTicker from "@/components/FixtureTicker";
import ExplainIcon from "@/components/ExplainIcon";
import { EXPLAIN_TIPS } from "@/lib/coachingLessons";

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

function SingleSwapRow({
  playerOut,
  playerOutTeam,
  playerOutPrice,
  playerIn,
  playerInTeam,
  playerInPrice,
  colors,
  isBeginner,
  vibe,
}: {
  playerOut: string;
  playerOutTeam: string;
  playerOutPrice?: number | null;
  playerIn: string;
  playerInTeam: string;
  playerInPrice?: number | null;
  colors: ReturnType<typeof useColors>;
  isBeginner?: boolean;
  vibe?: "expert" | "critic" | "fanboy";
}) {
  return (
    <View style={s.swapContainer}>
      <View style={s.swapRow}>
        <View style={s.playerBlock}>
          <Text style={[s.dirLabel, { color: "#ef4444" }]}>OUT</Text>
          <Text style={[s.playerName, { color: colors.foreground }]} numberOfLines={1}>
            {playerOut}
          </Text>
          <Text style={[s.playerMeta, { color: colors.mutedForeground }]}>
            {playerOutTeam}
            {typeof playerOutPrice === "number" ? ` · £${playerOutPrice.toFixed(1)}m` : ""}
          </Text>
        </View>

        <View style={[s.arrowContainer, { backgroundColor: colors.accent + "15" }]}>
          <Text style={[s.arrow, { color: colors.accent }]}>→</Text>
        </View>

        <View style={s.playerBlock}>
          <Text style={[s.dirLabel, { color: "#22c55e" }]}>IN</Text>
          <Text style={[s.playerName, { color: colors.foreground }]} numberOfLines={1}>
            {playerIn}
          </Text>
          <Text style={[s.playerMeta, { color: colors.mutedForeground }]}>
            {playerInTeam}
            {typeof playerInPrice === "number" ? ` · £${playerInPrice.toFixed(1)}m` : ""}
          </Text>
        </View>
      </View>

      <View style={s.fixtureSection}>
        <View style={s.fixtureRow}>
          <View style={[s.fixtureDot, { backgroundColor: "#ef4444" }]} />
          <View style={{ flex: 1 }}>
            <FixtureTicker teamShortName={playerOutTeam} compact />
          </View>
        </View>
        <View style={s.fixtureRow}>
          <View style={[s.fixtureDot, { backgroundColor: "#22c55e" }]} />
          <View style={{ flex: 1 }}>
            <FixtureTicker teamShortName={playerInTeam} compact />
          </View>
          <ExplainIcon
            tipText={EXPLAIN_TIPS.fixtures[vibe ?? "expert"]}
            isBeginner={isBeginner ?? false}
          />
        </View>
      </View>
    </View>
  );
}

export default function TransferCard({
  recommendation,
  isBeginner = false,
  vibe = "expert",
}: {
  recommendation: TransferRecommendation;
  isBeginner?: boolean;
  vibe?: "expert" | "critic" | "fanboy";
}) {
  const colors = useColors();
  const isSuperScoutPick = recommendation.is_superscout_pick;
  const [expanded, setExpanded] = useState(isSuperScoutPick);
  const conf = CONFIDENCE_CONFIG[recommendation.confidence] ?? {
    label: recommendation.confidence,
    color: colors.mutedForeground,
  };
  const isHold = recommendation.is_hold_recommendation;
  const isPackage =
    recommendation.is_package &&
    Array.isArray(recommendation.transfers) &&
    recommendation.transfers.length > 0;

  const pointsImpact = isPackage
    ? (recommendation.total_expected_points_gain_3gw ?? 0)
    : (recommendation.expected_points_gain_3gw ?? 0);

  const netCost = isPackage ? (recommendation.total_net_cost ?? 0) : (recommendation.net_cost ?? 0);

  const hitCost = isPackage ? (recommendation.total_hit_cost ?? 0) : (recommendation.hit_cost ?? 0);

  return (
    <Pressable onPress={() => setExpanded((prev) => !prev)} accessibilityLabel={expanded ? "Show less details" : "Show more details"} accessibilityRole="button">
      <View
        style={[
          s.card,
          {
            backgroundColor: colors.card,
            borderColor: isSuperScoutPick ? colors.accent + "60" : colors.border,
            borderWidth: isSuperScoutPick ? 1.5 : 1,
          },
        ]}
      >
        {isSuperScoutPick && (
          <View style={[s.badge, { backgroundColor: colors.accent }]}>
            <Text style={[s.badgeText, { color: colors.primary }]}>SuperScout Pick</Text>
          </View>
        )}

        {isHold ? (
          <View style={s.holdHeader}>
            <View style={[s.holdIcon, { backgroundColor: colors.accent + "20" }]}>
              <Text style={s.holdEmoji}>⏸️</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.playerName, { color: colors.foreground }]}>
                Hold Your Transfer{(recommendation.uses_free_transfers ?? 0) > 1 ? "s" : ""}
              </Text>
              <Text style={[s.playerMeta, { color: colors.mutedForeground }]}>
                Save {(recommendation.uses_free_transfers ?? 1) > 1 ? "them" : "it"} for next week
              </Text>
            </View>
          </View>
        ) : isPackage ? (
          <View style={s.packageSection}>
            <View style={[s.packageBanner, { backgroundColor: colors.accent + "15" }]}>
              <Text style={s.packageIcon}>📦</Text>
              <Text style={[s.packageName, { color: colors.accent }]}>
                {recommendation.package_name ?? "Transfer Package"}
              </Text>
              {recommendation.uses_free_transfers != null && (
                <Text style={[s.packageFtCount, { color: colors.mutedForeground }]}>
                  {recommendation.uses_free_transfers} FT
                </Text>
              )}
            </View>
            <View style={s.packageSwaps}>
              {recommendation.transfers!.map((swap, i) => (
                <View key={`${swap.player_out}-${swap.player_in}-${i}`}>
                  {i > 0 && <View style={[s.swapDivider, { backgroundColor: colors.border }]} />}
                  <SingleSwapRow
                    playerOut={swap.player_out}
                    playerOutTeam={swap.player_out_team}
                    playerOutPrice={swap.player_out_selling_price}
                    playerIn={swap.player_in}
                    playerInTeam={swap.player_in_team}
                    playerInPrice={swap.player_in_price}
                    colors={colors}
                    isBeginner={isBeginner}
                    vibe={vibe}
                  />
                </View>
              ))}
            </View>
          </View>
        ) : Array.isArray(recommendation.player_out) ? (
          <View style={s.packageSection}>
            <View style={s.packageSwaps}>
              {(recommendation.player_out as string[]).map((pOut, i) => {
                const pOutTeam = Array.isArray(recommendation.player_out_team)
                  ? (recommendation.player_out_team as string[])[i]
                  : recommendation.player_out_team;
                const pOutPrice = Array.isArray(recommendation.player_out_selling_price)
                  ? (recommendation.player_out_selling_price as number[])[i]
                  : recommendation.player_out_selling_price;
                const pIn = Array.isArray(recommendation.player_in)
                  ? (recommendation.player_in as string[])[i]
                  : recommendation.player_in;
                const pInTeam = Array.isArray(recommendation.player_in_team)
                  ? (recommendation.player_in_team as string[])[i]
                  : recommendation.player_in_team;
                const pInPrice = Array.isArray(recommendation.player_in_price)
                  ? (recommendation.player_in_price as number[])[i]
                  : recommendation.player_in_price;
                return (
                  <View key={`${pOut}-${pIn}-${i}`}>
                    {i > 0 && <View style={[s.swapDivider, { backgroundColor: colors.border }]} />}
                    <SingleSwapRow
                      playerOut={pOut ?? ""}
                      playerOutTeam={(pOutTeam as string) ?? ""}
                      playerOutPrice={typeof pOutPrice === "number" ? pOutPrice : null}
                      playerIn={(pIn as string) ?? ""}
                      playerInTeam={(pInTeam as string) ?? ""}
                      playerInPrice={typeof pInPrice === "number" ? pInPrice : null}
                      colors={colors}
                      isBeginner={isBeginner}
                      vibe={vibe}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={s.singleSwapSection}>
            <SingleSwapRow
              playerOut={recommendation.player_out ?? ""}
              playerOutTeam={recommendation.player_out_team ?? ""}
              playerOutPrice={recommendation.player_out_selling_price ?? null}
              playerIn={recommendation.player_in ?? ""}
              playerInTeam={recommendation.player_in_team ?? ""}
              playerInPrice={recommendation.player_in_price ?? null}
              colors={colors}
              isBeginner={isBeginner}
              vibe={vibe}
            />
          </View>
        )}

        <View style={s.metaRow}>
          <View style={s.inlineRow}>
            <View
              style={[
                s.confidenceBadge,
                { backgroundColor: conf.color + "20", borderColor: conf.color },
              ]}
            >
              <Text style={[s.confidenceText, { color: conf.color }]}>{conf.label}</Text>
            </View>
            <ExplainIcon tipText={EXPLAIN_TIPS.confidence[vibe]} isBeginner={isBeginner} />
          </View>

          {!isHold && (
            <>
              {typeof netCost === "number" && netCost !== 0 && (
                <Text style={[s.costText, { color: colors.mutedForeground }]}>
                  {netCost > 0
                    ? `Costs £${netCost.toFixed(1)}m`
                    : `Saves £${Math.abs(netCost).toFixed(1)}m`}
                </Text>
              )}
              {(netCost === 0 || netCost == null) && !isPackage && (
                <Text style={[s.costText, { color: colors.mutedForeground }]}>Free swap</Text>
              )}

              {hitCost > 0 ? (
                <View style={[s.hitBadge, { backgroundColor: "#ef444420" }]}>
                  <Text style={[s.hitText, { color: "#ef4444" }]}>-{hitCost}pt hit</Text>
                </View>
              ) : (
                <View style={[s.freeBadge, { backgroundColor: "#22c55e20" }]}>
                  <Text style={[s.freeText, { color: "#22c55e" }]}>
                    {isPackage
                      ? `${recommendation.uses_free_transfers ?? 0} free transfers`
                      : "Free transfer"}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {!isHold && (
          <View style={[s.impactRow, { backgroundColor: colors.primary + "10" }]}>
            <Text style={[s.impactLabel, { color: colors.mutedForeground }]}>
              {isPackage ? "Combined 3GW impact" : "Expected 3GW impact"}
            </Text>
            <Text
              style={[
                s.impactValue,
                {
                  color:
                    typeof pointsImpact === "number" && pointsImpact >= 0 ? "#22c55e" : "#ef4444",
                },
              ]}
            >
              {typeof pointsImpact === "number" && pointsImpact >= 0 ? "+" : ""}
              {typeof pointsImpact === "number" ? pointsImpact.toFixed(1) : "0.0"} pts
            </Text>
          </View>
        )}

        <View style={s.reasoningSection}>
          <View style={s.reasonRow}>
            <Text style={[s.reasonLabel, { color: "#22c55e" }]}>Upside</Text>
            <Text
              style={[s.reasonText, { color: colors.foreground }]}
              numberOfLines={expanded ? undefined : 2}
            >
              {recommendation.upside}
            </Text>
          </View>
          <View style={s.reasonRow}>
            <Text style={[s.reasonLabel, { color: "#ef4444" }]}>Risk</Text>
            <Text
              style={[s.reasonText, { color: colors.foreground }]}
              numberOfLines={expanded ? undefined : 2}
            >
              {recommendation.risk}
            </Text>
          </View>
        </View>

        <View style={[s.caseContainer, { backgroundColor: colors.primary + "15" }]}>
          <Text
            style={[s.caseText, { color: colors.foreground, fontStyle: "italic" }]}
            numberOfLines={expanded ? undefined : 2}
          >
            "{recommendation.case}"
          </Text>
        </View>

        <View style={s.expandRow}>
          <Text style={[s.expandText, { color: colors.accent }]}>
            {expanded ? "Show less \u25B2" : "Read more \u25BC"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
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

  holdHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
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

  singleSwapSection: {
    marginBottom: 16,
  },
  packageSection: {
    marginBottom: 16,
  },
  packageBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
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
    marginVertical: 12,
  },

  swapContainer: {
    gap: 12,
  },
  swapRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  playerBlock: {
    flex: 1,
  },
  dirLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  playerName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  playerMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
  arrow: {
    fontSize: 18,
    fontWeight: "700",
  },

  fixtureSection: {
    gap: 6,
  },
  fixtureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fixtureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
    flexWrap: "wrap",
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  costText: {
    fontSize: 13,
  },
  hitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  hitText: {
    fontSize: 11,
    fontWeight: "700",
  },
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  impactLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  impactValue: {
    fontSize: 18,
    fontWeight: "800",
  },

  reasoningSection: {
    gap: 8,
    marginBottom: 16,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: "700",
    width: 48,
    letterSpacing: 0.3,
    paddingTop: 1,
  },
  reasonText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },

  caseContainer: {
    padding: 12,
    borderRadius: 8,
  },
  caseText: {
    fontSize: 14,
    lineHeight: 20,
  },

  expandRow: {
    alignItems: "center",
    paddingTop: 12,
  },
  expandText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
