import { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated, LayoutAnimation, Platform, UIManager } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFixtureData, getUpcomingFixtures } from "@/hooks/useFixtureData";
import type { FixtureInfo } from "@/hooks/useFixtureData";
import type { TransferRecommendation } from "./TransferCard";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FDR_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: "#257D5A", text: "#FFFFFF" },
  2: { bg: "#00FF87", text: "#1A1A1A" },
  3: { bg: "#CBCBCB", text: "#333333" },
  4: { bg: "#FF1751", text: "#FFFFFF" },
  5: { bg: "#80132B", text: "#FFFFFF" },
};

const COLORS = {
  indigo: "#4F46E5",
  indigoLight: "#EEF2FF",
  green: "#16A34A",
  greenTag: "#15803D",
  greenBg: "#F0FDF4",
  red: "#DC2626",
  redBg: "#FEF2F2",
  coral: "#C2410C",
  coralBg: "#FFF7ED",
  text: "#1A1A1A",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  cardBg: "#FFFFFF",
  fixtureBg: "#FAFAF8",
  quoteText: "#3730A3",
};

function DgwDot() {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulseAnim]);

  const scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });

  const ringOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0],
  });

  return (
    <View style={styles.dgwDotContainer}>
      <Animated.View
        style={{
          position: "absolute",
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: COLORS.indigo,
          opacity: ringOpacity,
          transform: [{ scale }],
        }}
      />
      <View style={styles.dgwDotCore} />
    </View>
  );
}

function FixtureCell({ fixture }: { fixture: FixtureInfo }) {
  const fdr = FDR_COLORS[fixture.fdr] ?? { bg: "#888", text: "#fff" };
  return (
    <View style={[styles.fixtureCell, { backgroundColor: fdr.bg }]}>
      <Text style={[styles.fixtureCellGw, { color: fdr.text }]}>
        {fixture.event}
      </Text>
      <Text style={[styles.fixtureCellTeam, { color: fdr.text }]}>
        {fixture.opponentShortName}
      </Text>
      <Text style={[styles.fixtureCellVenue, { color: fdr.text }]}>
        {fixture.isHome ? "h" : "a"}
      </Text>
    </View>
  );
}

function FixtureStrip({ teamShortName }: { teamShortName: string }) {
  const fixtureData = useFixtureData();
  if (!fixtureData) return null;

  const allFixtures = getUpcomingFixtures(teamShortName, fixtureData, 7);
  if (allFixtures.length === 0) return null;

  const grouped: FixtureInfo[][] = [];
  for (const fix of allFixtures) {
    const last = grouped[grouped.length - 1];
    if (last && last[0].event === fix.event) {
      last.push(fix);
    } else {
      grouped.push([fix]);
    }
  }

  const slots = grouped.slice(0, 5);
  const hasDgw = slots.some((g) => g.length > 1);

  return (
    <View style={styles.fixtureZone}>
      <View style={styles.fixtureHeader}>
        <Text style={styles.fixtureHeaderLabel}>NEXT 5 FIXTURES</Text>
        {hasDgw && (
          <View style={styles.dgwIndicator}>
            <View style={styles.dgwIndicatorDot} />
            <Text style={styles.dgwIndicatorText}>Plays twice</Text>
          </View>
        )}
      </View>

      <View style={styles.fixtureCellRow}>
        {slots.map((group, i) => {
          const isDgw = group.length > 1;
          if (isDgw) {
            return (
              <View key={`gw-${group[0].event}-${i}`} style={styles.fixtureCellWrapper}>
                <FixtureCell fixture={{ ...group[0], opponentShortName: group.map(f => f.opponentShortName).join("/") }} />
                <DgwDot />
              </View>
            );
          }
          return (
            <View key={`gw-${group[0].event}-${i}`} style={styles.fixtureCellWrapper}>
              <FixtureCell fixture={group[0]} />
            </View>
          );
        })}
      </View>

      <View style={styles.fdrLegend}>
        <Text style={styles.fdrLegendLabel}>Easy</Text>
        <View style={styles.fdrGradient}>
          <View style={[styles.fdrSegment, { backgroundColor: "#257D5A", borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }]} />
          <View style={[styles.fdrSegment, { backgroundColor: "#00FF87" }]} />
          <View style={[styles.fdrSegment, { backgroundColor: "#CBCBCB" }]} />
          <View style={[styles.fdrSegment, { backgroundColor: "#FF1751" }]} />
          <View style={[styles.fdrSegment, { backgroundColor: "#80132B", borderTopRightRadius: 3, borderBottomRightRadius: 3 }]} />
        </View>
        <Text style={styles.fdrLegendLabel}>Hard</Text>
      </View>
    </View>
  );
}

function TagPill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

interface TransferCardV2Props {
  recommendation: TransferRecommendation;
}

export default function TransferCardV2({
  recommendation,
}: TransferCardV2Props) {
  const isSuperScoutPick = recommendation.is_superscout_pick;
  const [expanded, setExpanded] = useState(isSuperScoutPick);
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
  const isFreeTransfer = hitCost === 0;

  const playerOut = isPackage
    ? recommendation.transfers![0]?.player_out ?? ""
    : (recommendation.player_out ?? "");
  const playerIn = isPackage
    ? recommendation.package_name ?? "Transfer Package"
    : (recommendation.player_in ?? "");
  const playerInTeam = isPackage
    ? recommendation.transfers![0]?.player_in_team ?? ""
    : (recommendation.player_in_team ?? "");
  const playerInPrice = isPackage
    ? null
    : (recommendation.player_in_price ?? null);

  const projectionWindow = isFreeTransfer ? 3 : 5;
  const breakevenGw = !isFreeTransfer && pointsImpact > 0
    ? Math.max(1, Math.ceil(hitCost / (pointsImpact / projectionWindow)))
    : null;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  if (isHold) {
    return (
      <View style={styles.card}>
        <View style={styles.holdCard}>
          <View style={styles.holdIconContainer}>
            <Text style={styles.holdEmoji}>⏸️</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.headerInName, { color: COLORS.text }]}>
              Hold Your Transfer{(recommendation.uses_free_transfers ?? 0) > 1 ? "s" : ""}
            </Text>
            <Text style={[styles.headerMeta, { color: COLORS.textSecondary }]}>
              Save {(recommendation.uses_free_transfers ?? 1) > 1 ? "them" : "it"} for next week
            </Text>
          </View>
        </View>

        <View style={styles.tagRow}>
          {isSuperScoutPick && (
            <TagPill label="SuperScout Pick" bg={COLORS.indigoLight} color={COLORS.indigo} />
          )}
          <TagPill label="Free transfer" bg={COLORS.greenBg} color={COLORS.greenTag} />
        </View>

        <View style={styles.coachingZone}>
          <View style={styles.upsideRiskGrid}>
            <View style={styles.gridRow}>
              <Text style={styles.upsideLabel}>UPSIDE</Text>
              <Text style={styles.gridText}>{recommendation.upside}</Text>
            </View>
          </View>
          <View style={styles.quoteBlock}>
            <Text style={styles.quoteText}>"{recommendation.case}"</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* ZONE 1: Header */}
      <View style={styles.headerZone}>
        <View style={styles.headerLeft}>
          <View style={styles.headerOutRow}>
            <Text style={styles.headerOutName}>{playerOut}</Text>
            <Text style={styles.headerArrow}> → </Text>
          </View>
          <Text style={styles.headerInName} numberOfLines={1}>
            {playerIn}
          </Text>
          <Text style={styles.headerMeta}>
            {playerInTeam}
            {typeof playerInPrice === "number" ? ` · £${playerInPrice.toFixed(1)}m` : ""}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Text
            style={[
              styles.headerImpactNumber,
              { color: pointsImpact >= 0 ? COLORS.green : COLORS.red },
            ]}
          >
            {pointsImpact >= 0 ? "+" : ""}{pointsImpact.toFixed(0)}
          </Text>
          <Text style={styles.headerImpactLabel}>
            pts vs {isPackage ? "current" : playerOut}
          </Text>
          <Text style={styles.headerImpactSub}>
            {isFreeTransfer
              ? `Over next ${projectionWindow} gameweeks`
              : breakevenGw
                ? `Over ${projectionWindow} GWs · evens in ${breakevenGw}`
                : `Over ${projectionWindow} GWs`}
          </Text>
        </View>
      </View>

      {/* Package sub-swaps for multi-transfer */}
      {isPackage && recommendation.transfers && (
        <View style={styles.packageSwaps}>
          {recommendation.transfers.map((swap, i) => (
            <View key={`${swap.player_out}-${swap.player_in}-${i}`} style={styles.packageSwapRow}>
              <Text style={styles.packageSwapOut}>{swap.player_out}</Text>
              <Feather name="arrow-right" size={10} color={COLORS.textMuted} style={{ marginHorizontal: 4 }} />
              <Text style={styles.packageSwapIn}>{swap.player_in}</Text>
              {typeof swap.player_in_price === "number" && (
                <Text style={styles.packageSwapPrice}>£{swap.player_in_price.toFixed(1)}m</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ZONE 2: Tags */}
      <View style={styles.tagRow}>
        {isSuperScoutPick && (
          <TagPill label="SuperScout Pick" bg={COLORS.indigoLight} color={COLORS.indigo} />
        )}
        {isFreeTransfer ? (
          <TagPill label="Free transfer" bg={COLORS.greenBg} color={COLORS.greenTag} />
        ) : (
          <TagPill label={`−${hitCost} pt hit`} bg={COLORS.redBg} color={COLORS.red} />
        )}
        {netCost < 0 && (
          <TagPill
            label={`Saves £${Math.abs(netCost).toFixed(1)}m`}
            bg={COLORS.borderLight}
            color={COLORS.textSecondary}
          />
        )}
        {recommendation.confidence === "CALCULATED_RISK" && (
          <TagPill label="Calculated Risk" bg={COLORS.coralBg} color={COLORS.coral} />
        )}
        {recommendation.confidence === "BOLD_PUNT" && (
          <TagPill label="Bold Punt" bg={COLORS.coralBg} color={COLORS.coral} />
        )}
      </View>

      {/* ZONE 3: Fixtures */}
      {!isPackage && playerInTeam ? (
        <FixtureStrip teamShortName={playerInTeam} />
      ) : isPackage && recommendation.transfers && recommendation.transfers.length > 0 ? (
        <FixtureStrip teamShortName={recommendation.transfers[0].player_in_team} />
      ) : null}

      {/* ZONE 4: Coaching Content */}
      <Pressable
        onPress={toggleExpand}
        style={styles.coachingToggle}
        accessibilityLabel={expanded ? "Hide coaching detail" : "Show coaching detail"}
        accessibilityRole="button"
      >
        <Text style={styles.coachingToggleText}>
          {expanded ? "Hide coaching detail \u25B4" : "Show coaching detail \u25BE"}
        </Text>
      </Pressable>

      {expanded && (
        <View style={styles.coachingZone}>
          <View style={styles.upsideRiskGrid}>
            <View style={styles.gridRow}>
              <Text style={styles.upsideLabel}>UPSIDE</Text>
              <Text style={styles.gridText}>{recommendation.upside}</Text>
            </View>
            <View style={styles.gridRow}>
              <Text style={styles.riskLabel}>RISK</Text>
              <Text style={styles.gridText}>{recommendation.risk}</Text>
            </View>
          </View>

          <View style={styles.quoteBlock}>
            <Text style={styles.quoteText}>"{recommendation.case}"</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0,0,0,0.1)",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
      },
    }),
  },

  headerZone: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  headerOutRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  headerOutName: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: COLORS.textSecondary,
    textDecorationLine: "line-through",
  },
  headerArrow: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  headerInName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: COLORS.text,
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
  },
  headerRight: {
    minWidth: 80,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerImpactNumber: {
    fontSize: 28,
    fontFamily: "SpaceGrotesk_700Bold",
    lineHeight: 32,
  },
  headerImpactLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: COLORS.textMuted,
    textAlign: "right",
    marginTop: 2,
  },
  headerImpactSub: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: COLORS.textMuted,
    textAlign: "right",
  },

  packageSwaps: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 4,
  },
  packageSwapRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  packageSwapOut: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: COLORS.textSecondary,
    textDecorationLine: "line-through",
  },
  packageSwapIn: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.text,
  },
  packageSwapPrice: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: COLORS.textMuted,
    marginLeft: 6,
  },

  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },

  fixtureZone: {
    backgroundColor: COLORS.fixtureBg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fixtureHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  fixtureHeaderLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  dgwIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dgwIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.indigo,
  },
  dgwIndicatorText: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: COLORS.textMuted,
  },
  fixtureCellRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "stretch",
  },
  fixtureCellWrapper: {
    flex: 1,
    position: "relative",
    overflow: "visible",
  },
  fixtureCell: {
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
    alignItems: "center",
    minHeight: 46,
    justifyContent: "center",
  },
  fixtureCellGw: {
    fontSize: 8,
    fontFamily: "Inter_500Medium",
    opacity: 0.7,
    marginBottom: 1,
  },
  fixtureCellTeam: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  fixtureCellVenue: {
    fontSize: 8,
    fontFamily: "Inter_400Regular",
    opacity: 0.7,
    marginTop: 1,
  },
  dgwDotContainer: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  dgwDotCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.indigo,
    borderWidth: 1.5,
    borderColor: COLORS.fixtureBg,
  },
  fdrLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    gap: 6,
  },
  fdrLegendLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: COLORS.textMuted,
  },
  fdrGradient: {
    flexDirection: "row",
    height: 6,
    maxWidth: 120,
    flex: 1,
    borderRadius: 3,
    overflow: "hidden",
  },
  fdrSegment: {
    flex: 1,
  },

  coachingToggle: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingVertical: 10,
    alignItems: "center",
  },
  coachingToggleText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.indigo,
  },

  coachingZone: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  upsideRiskGrid: {
    gap: 10,
  },
  gridRow: {
    flexDirection: "row",
    gap: 10,
  },
  upsideLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.green,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    width: 52,
    paddingTop: 2,
  },
  riskLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: COLORS.red,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    width: 52,
    paddingTop: 2,
  },
  gridText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: COLORS.text,
    lineHeight: 20,
    flex: 1,
  },
  quoteBlock: {
    backgroundColor: COLORS.indigoLight,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.indigo,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  quoteText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    color: COLORS.quoteText,
    lineHeight: 20,
  },

  holdCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  holdIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.indigoLight,
    alignItems: "center",
    justifyContent: "center",
  },
  holdEmoji: {
    fontSize: 20,
  },
});
