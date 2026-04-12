import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useFixtureData, getUpcomingFixtures } from "@/hooks/useFixtureData";
import type { FixtureInfo } from "@/hooks/useFixtureData";

const FDR_COLORS: Record<number, string> = {
  1: "#4CAF7D",
  2: "#4CAF7D",
  3: "#E5A825",
  4: "#E84C4C",
  5: "#E84C4C",
};

interface FixtureTickerProps {
  teamShortName: string | string[] | null | undefined;
}

function FixturePill({ fixture }: { fixture: FixtureInfo }) {
  const bg = FDR_COLORS[fixture.fdr] ?? "#888";
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={styles.pillTeam}>{fixture.opponentShortName}</Text>
      <Text style={styles.pillVenue}>{fixture.isHome ? "h" : "a"}</Text>
    </View>
  );
}

function DgwPill({ fixtures }: { fixtures: FixtureInfo[] }) {
  const worstFdr = Math.max(...fixtures.map((f) => f.fdr));
  const bg = FDR_COLORS[worstFdr] ?? "#888";
  const label = fixtures.map((f) => f.opponentShortName).join("/");
  return (
    <View style={[styles.dgwPill, { backgroundColor: bg }]}>
      <Text style={styles.dgwTeam} numberOfLines={1}>{label}</Text>
      <Text style={styles.dgwLabel}>DGW</Text>
    </View>
  );
}

export default function FixtureTicker({ teamShortName }: FixtureTickerProps) {
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
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        Next {slots.length}
      </Text>
      <View style={styles.row}>
        {slots.map((group, i) =>
          group.length > 1 ? (
            <DgwPill key={`gw-${group[0].event}-${i}`} fixtures={group} />
          ) : (
            <FixturePill key={`gw-${group[0].event}-${i}`} fixture={group[0]} />
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
    width: 44,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  pillTeam: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  pillVenue: {
    fontSize: 9,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
    marginTop: -1,
  },
  dgwPill: {
    width: 52,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  dgwTeam: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
  dgwLabel: {
    fontSize: 7,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.5,
    marginTop: -1,
  },
});
