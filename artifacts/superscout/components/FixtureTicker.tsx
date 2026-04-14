import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useFixtureData, getUpcomingFixtures } from "@/hooks/useFixtureData";
import type { FixtureInfo } from "@/hooks/useFixtureData";

const FDR_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: "#00875A", text: "#FFFFFF" },
  2: { bg: "#A3F5C1", text: "#1A1A1A" },
  3: { bg: "#E7E7E7", text: "#555555" },
  4: { bg: "#FF6B6B", text: "#FFFFFF" },
  5: { bg: "#80132B", text: "#FFFFFF" },
};

interface FixtureTickerProps {
  teamShortName: string | string[] | null | undefined;
  compact?: boolean;
}

function FixturePill({ fixture, compact }: { fixture: FixtureInfo; compact?: boolean }) {
  const fdr = FDR_COLORS[fixture.fdr] ?? { bg: "#888", text: "#fff" };
  return (
    <View style={[compact ? compactStyles.pill : styles.pill, { backgroundColor: fdr.bg }]}>
      <Text style={[compact ? compactStyles.pillGw : styles.pillGw, { color: fdr.text }]}>
        {fixture.event}
      </Text>
      <Text style={[compact ? compactStyles.pillTeam : styles.pillTeam, { color: fdr.text }]}>
        {fixture.opponentShortName}
      </Text>
      <Text style={[compact ? compactStyles.pillVenue : styles.pillVenue, { color: fdr.text }]}>
        {fixture.isHome ? "h" : "a"}
      </Text>
    </View>
  );
}

function DgwPill({ fixtures, compact }: { fixtures: FixtureInfo[]; compact?: boolean }) {
  const worstFdr = Math.max(...fixtures.map((f) => f.fdr));
  const fdr = FDR_COLORS[worstFdr] ?? { bg: "#888", text: "#fff" };
  const label = fixtures.map((f) => f.opponentShortName).join("/");
  return (
    <View style={[compact ? compactStyles.dgwPill : styles.dgwPill, { backgroundColor: fdr.bg }]}>
      <Text style={[compact ? compactStyles.pillGw : styles.pillGw, { color: fdr.text }]}>
        {fixtures[0].event}
      </Text>
      <Text style={[compact ? compactStyles.dgwTeam : styles.dgwTeam, { color: fdr.text }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[compact ? compactStyles.pillVenue : styles.pillVenue, { color: fdr.text }]}>
        {fixtures[0].isHome ? "h" : "a"}
      </Text>
    </View>
  );
}

export default function FixtureTicker({ teamShortName, compact }: FixtureTickerProps) {
  const colors = useColors();
  const fixtureData = useFixtureData();

  const safeName =
    typeof teamShortName === "string" && teamShortName.length > 0
      ? teamShortName
      : Array.isArray(teamShortName) && typeof (teamShortName as string[])[0] === "string"
        ? (teamShortName as string[])[0]
        : null;

  if (!fixtureData || !safeName) return null;

  const allFixtures = getUpcomingFixtures(safeName, fixtureData, 7);
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
  if (slots.length === 0) return null;

  return (
    <View style={compact ? compactStyles.container : styles.container}>
      {!compact && (
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Next {slots.length}</Text>
      )}
      <View style={compact ? compactStyles.row : styles.row}>
        {slots.map((group, i) =>
          group.length > 1 ? (
            <DgwPill key={`gw-${group[0].event}-${i}`} fixtures={group} compact={compact} />
          ) : (
            <FixturePill key={`gw-${group[0].event}-${i}`} fixture={group[0]} compact={compact} />
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    gap: 4,
  },
  pill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  pillGw: {
    fontSize: 8,
    fontWeight: "500",
    opacity: 0.7,
    marginBottom: 1,
  },
  pillTeam: {
    fontSize: 10,
    fontWeight: "700",
  },
  pillVenue: {
    fontSize: 8,
    fontWeight: "400",
    opacity: 0.7,
    marginTop: 1,
  },
  dgwPill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  dgwTeam: {
    fontSize: 9,
    fontWeight: "700",
  },
});

const compactStyles = StyleSheet.create({
  container: {
    marginTop: 3,
    marginBottom: 1,
  },
  row: {
    flexDirection: "row",
    gap: 4,
  },
  pill: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  pillGw: {
    fontSize: 7,
    fontWeight: "500",
    opacity: 0.7,
    marginBottom: 1,
  },
  pillTeam: {
    fontSize: 9,
    fontWeight: "700",
  },
  pillVenue: {
    fontSize: 7,
    fontWeight: "400",
    opacity: 0.7,
    marginTop: 1,
  },
  dgwPill: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  dgwTeam: {
    fontSize: 8,
    fontWeight: "700",
  },
});
