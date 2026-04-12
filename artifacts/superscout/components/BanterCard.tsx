import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Share,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export interface BanterCardData {
  rival_team_name: string;
  rival_rank: number;
  points_gap: number;
  points_gap_text: string;
  headline: string;
  key_battle: string;
  captain_clash: string;
  verdict: string;
  share_line: string;
  league_name: string;
  league_type: string;
}

interface Props {
  card: BanterCardData;
  onShare?: (card: BanterCardData) => void;
}

export default function BanterCard({ card, onShare }: Props) {
  const colors = useColors();

  const pointsColor =
    card.points_gap > 0
      ? "#4CAF7D"
      : card.points_gap < 0
        ? "#E84C4C"
        : colors.mutedForeground;

  const handleShare = async () => {
    const shareText = `${card.share_line}\n\n— SuperScout Banter Engine 🏆`;

    if (Platform.OS === "web") {
      await Clipboard.setStringAsync(shareText);
    } else {
      try {
        await Share.share({ message: shareText });
      } catch {}
    }

    onShare?.(card);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.rankBadge, { backgroundColor: colors.accent + "20" }]}>
            <Text style={[styles.rankText, { color: colors.accent }]}>
              #{card.rival_rank}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text
              style={[styles.rivalName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {card.rival_team_name}
            </Text>
            <Text style={[styles.leagueName, { color: colors.mutedForeground }]}>
              {card.league_name}
            </Text>
          </View>
        </View>
        <Text style={[styles.pointsGap, { color: pointsColor }]}>
          {card.points_gap > 0 ? "+" : ""}
          {card.points_gap} pts
        </Text>
      </View>

      <Text style={[styles.headline, { color: colors.foreground }]}>
        {card.headline}
      </Text>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="zap" size={14} color={colors.accent} />
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            Key Battle
          </Text>
        </View>
        <Text style={[styles.sectionText, { color: colors.foreground }]}>
          {card.key_battle}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="award" size={14} color="#E5A825" />
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            Captain Clash
          </Text>
        </View>
        <Text style={[styles.sectionText, { color: colors.foreground }]}>
          {card.captain_clash}
        </Text>
      </View>

      <View
        style={[
          styles.verdictBox,
          { backgroundColor: colors.accent + "10", borderColor: colors.accent + "30" },
        ]}
      >
        <Text style={[styles.verdictLabel, { color: colors.accent }]}>
          Verdict
        </Text>
        <Text style={[styles.verdictText, { color: colors.foreground }]}>
          {card.verdict}
        </Text>
      </View>

      <Pressable
        onPress={handleShare}
        style={({ pressed }) => [
          styles.shareButton,
          {
            backgroundColor: colors.accent,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Feather name="share-2" size={16} color="#1a472a" />
        <Text style={styles.shareButtonText}>Send to Rival</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  headerInfo: {
    flex: 1,
  },
  rivalName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  leagueName: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  pointsGap: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginLeft: 8,
  },
  headline: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    lineHeight: 26,
    marginBottom: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  verdictBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  verdictLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  verdictText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shareButtonText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#1a472a",
  },
});
