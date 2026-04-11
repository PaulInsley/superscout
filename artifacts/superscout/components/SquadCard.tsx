import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

const SCALE = Math.min(Dimensions.get("window").width - 32, 400) / CARD_WIDTH;

interface CardPlayer {
  id: number;
  webName: string;
  position: string;
  points: number;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isAutoSubIn?: boolean;
  isAutoSubOut?: boolean;
}

interface SquadCardProps {
  teamName: string;
  gameweek: number;
  formation: string;
  starters: CardPlayer[];
  bench: CardPlayer[];
  totalPoints: number;
  benchPoints: number;
  overallRank: number;
  rankChange: number | null;
  rankDirection: "up" | "down" | "same" | "new";
  gwAverage: number | null;
  quipText: string;
  vibe: string;
  captureMode?: boolean;
}

const POSITION_ORDER = ["GKP", "DEF", "MID", "FWD"];

function groupByPosition(starters: CardPlayer[]): CardPlayer[][] {
  const rows: CardPlayer[][] = [];
  for (const pos of POSITION_ORDER) {
    const group = starters.filter(p => p.position === pos);
    if (group.length > 0) rows.push(group);
  }
  return rows;
}

function formatRank(rank: number): string {
  if (rank >= 1_000_000) return `${(rank / 1_000_000).toFixed(1)}M`;
  if (rank >= 1_000) return `${(rank / 1_000).toFixed(0)}K`;
  return rank.toLocaleString();
}

function formatRankChange(change: number): string {
  if (change >= 1_000_000) return `${(change / 1_000_000).toFixed(1)}M`;
  if (change >= 1_000) return `${Math.round(change / 1_000)}K`;
  return change.toLocaleString();
}

function PlayerBadge({ player, scale }: { player: CardPlayer; scale: number }) {
  const isCaptain = player.isCaptain;
  const isVC = player.isViceCaptain;

  return (
    <View style={[
      styles.playerBadge,
      isCaptain && styles.captainBadge,
      { transform: [{ scale }] },
    ]}>
      <View style={styles.playerNameRow}>
        <Text
          style={[styles.playerName, isCaptain && styles.captainName]}
          numberOfLines={1}
        >
          {player.webName}
        </Text>
        {isCaptain && <Text style={styles.captainMarker}>(C)</Text>}
        {isVC && <Text style={styles.vcMarker}>(V)</Text>}
      </View>
      <Text style={[styles.playerPoints, isCaptain && styles.captainPoints]}>
        {player.points}
      </Text>
    </View>
  );
}

export default function SquadCard({
  teamName,
  gameweek,
  formation,
  starters,
  bench,
  totalPoints,
  benchPoints,
  overallRank,
  rankChange,
  rankDirection,
  gwAverage,
  quipText,
  vibe,
  captureMode,
}: SquadCardProps) {
  const s = captureMode ? 1 : SCALE;
  const rows = groupByPosition(starters);

  const rankArrow = rankDirection === "up" ? "▲" : rankDirection === "down" ? "▼" : "";
  const rankColor = rankDirection === "up" ? "#00ff87" : rankDirection === "down" ? "#ef4444" : "#94a3b8";

  const vibeLabel = vibe === "critic" ? "Sarcastic Critic" : vibe === "fanboy" ? "OTT Fanboy" : "Expert";

  return (
    <View style={[
      styles.card,
      {
        width: CARD_WIDTH * s,
        height: CARD_HEIGHT * s,
      },
    ]}>
      <View style={[styles.innerCard, { transform: [{ scale: s }], width: CARD_WIDTH, height: CARD_HEIGHT }]}>
        <View style={styles.headerSection}>
          <Text style={styles.brandName}>SUPERSCOUT</Text>
          <View style={styles.gwBadge}>
            <Text style={styles.gwText}>GAMEWEEK {gameweek}</Text>
          </View>
        </View>

        <Text style={styles.teamName} numberOfLines={1}>{teamName}</Text>

        <View style={styles.pointsSection}>
          <Text style={styles.totalPointsLabel}>POINTS</Text>
          <Text style={styles.totalPoints}>{totalPoints}</Text>
          {gwAverage !== null && (
            <Text style={styles.avgText}>
              GW avg: {gwAverage} | {totalPoints >= gwAverage ? "+" : ""}{totalPoints - gwAverage}
            </Text>
          )}
        </View>

        <View style={styles.rankSection}>
          {rankDirection === "new" ? (
            <Text style={styles.rankNewEntry}>New Entry — Rank #{formatRank(overallRank)}</Text>
          ) : (
            <View style={styles.rankRow}>
              <Text style={[styles.rankArrow, { color: rankColor }]}>
                {rankArrow} {rankChange !== null && rankChange > 0 ? formatRankChange(rankChange) : ""}
              </Text>
              <Text style={styles.rankLabel}>Rank #{formatRank(overallRank)}</Text>
            </View>
          )}
        </View>

        <View style={styles.formationSection}>
          <Text style={styles.formationLabel}>{formation}</Text>

          {[...rows].reverse().map((row, rowIdx) => (
            <View key={rowIdx} style={styles.formationRow}>
              {row.map(player => (
                <PlayerBadge key={player.id} player={player} scale={1} />
              ))}
            </View>
          ))}
        </View>

        <View style={styles.benchSection}>
          <Text style={styles.benchLabel}>BENCH ({benchPoints} pts)</Text>
          <View style={styles.benchRow}>
            {bench.map(player => (
              <View key={player.id} style={[
                styles.benchBadge,
                player.isAutoSubIn && styles.autoSubBadge,
              ]}>
                <Text style={styles.benchPlayerName} numberOfLines={1}>{player.webName}</Text>
                <Text style={styles.benchPlayerPoints}>{player.points}</Text>
                {player.isAutoSubIn && <Text style={styles.autoSubTag}>SUB IN</Text>}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.quipSection}>
          <View style={styles.quipContainer}>
            {quipText ? (
              <>
                <Text style={styles.quipVibeTag}>The {vibeLabel} says:</Text>
                <Text style={styles.quipText}>{quipText}</Text>
              </>
            ) : (
              <Text style={styles.quipUpgradeText}>Upgrade to Pro for AI commentary</Text>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>superscout.pro</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: 24,
  },
  innerCard: {
    backgroundColor: "#0f1923",
    paddingHorizontal: 60,
    paddingTop: 48,
    paddingBottom: 36,
    transformOrigin: "top left",
  },
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  brandName: {
    fontSize: 42,
    fontWeight: "900",
    color: "#00ff87",
    letterSpacing: 6,
  },
  gwBadge: {
    backgroundColor: "rgba(0,255,135,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.3)",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  gwText: {
    color: "#00ff87",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 2,
  },
  teamName: {
    fontSize: 44,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 28,
    letterSpacing: 1,
  },
  pointsSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  totalPointsLabel: {
    fontSize: 20,
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: 4,
    marginBottom: 4,
  },
  totalPoints: {
    fontSize: 96,
    fontWeight: "900",
    color: "#ffffff",
    lineHeight: 100,
  },
  avgText: {
    fontSize: 22,
    color: "#94a3b8",
    marginTop: 4,
  },
  rankSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  rankNewEntry: {
    fontSize: 24,
    color: "#00ff87",
    fontWeight: "600",
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rankArrow: {
    fontSize: 26,
    fontWeight: "800",
  },
  rankLabel: {
    fontSize: 24,
    color: "#94a3b8",
    fontWeight: "600",
  },
  formationSection: {
    flex: 1,
    justifyContent: "center",
    gap: 14,
    marginBottom: 16,
  },
  formationLabel: {
    fontSize: 20,
    color: "#475569",
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 3,
    marginBottom: 4,
  },
  formationRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  playerBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    minWidth: 120,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  captainBadge: {
    backgroundColor: "rgba(255,215,0,0.15)",
    borderColor: "#ffd700",
    borderWidth: 2,
  },
  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  playerName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e2e8f0",
    maxWidth: 100,
  },
  captainName: {
    color: "#ffd700",
  },
  captainMarker: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffd700",
  },
  vcMarker: {
    fontSize: 16,
    fontWeight: "700",
    color: "#94a3b8",
  },
  playerPoints: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    marginTop: 2,
  },
  captainPoints: {
    color: "#ffd700",
  },
  benchSection: {
    marginBottom: 20,
  },
  benchLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#475569",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 10,
  },
  benchRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  benchBadge: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    minWidth: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  autoSubBadge: {
    borderColor: "rgba(0,255,135,0.3)",
  },
  benchPlayerName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#94a3b8",
    maxWidth: 90,
  },
  benchPlayerPoints: {
    fontSize: 22,
    fontWeight: "800",
    color: "#cbd5e1",
    marginTop: 2,
  },
  autoSubTag: {
    fontSize: 11,
    fontWeight: "800",
    color: "#00ff87",
    marginTop: 4,
    letterSpacing: 1,
  },
  quipSection: {
    marginBottom: 20,
  },
  quipContainer: {
    backgroundColor: "rgba(0,255,135,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,255,135,0.15)",
    paddingHorizontal: 28,
    paddingVertical: 20,
  },
  quipVibeTag: {
    fontSize: 16,
    fontWeight: "700",
    color: "#00ff87",
    letterSpacing: 1,
    marginBottom: 8,
  },
  quipText: {
    fontSize: 24,
    fontWeight: "500",
    color: "#e2e8f0",
    lineHeight: 34,
    fontStyle: "italic",
  },
  quipUpgradeText: {
    fontSize: 20,
    fontWeight: "500",
    color: "#64748b",
    fontStyle: "italic",
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
  },
  footerText: {
    fontSize: 20,
    color: "#475569",
    fontWeight: "600",
    letterSpacing: 2,
  },
});
