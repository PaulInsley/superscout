import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColors } from "@/hooks/useColors";
import { useStreak } from "@/hooks/useStreak";
import { useManagerId } from "@/hooks/useManagerId";
import { fetchPlayers, getBootstrapData, getLastFinishedGameweek } from "@/services/fpl";
import type { NormalizedPlayer } from "@/services/fpl";
import config from "@/constants/config";
import StreakBadge from "@/components/StreakBadge";
import StreakDetailSheet from "@/components/StreakDetailSheet";
import MilestoneCelebration from "@/components/MilestoneCelebration";
import ReportCardSheet from "@/components/ReportCardSheet";

const REPORT_DISMISSED_KEY = (mid: number, gw: number) =>
  `superscout_report_dismissed_${mid}_gw_${gw}`;

export default function PlayersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { streak, pendingMilestone, dismissMilestone } = useStreak();
  const [showStreakDetail, setShowStreakDetail] = useState(false);
  const [showReportCard, setShowReportCard] = useState(false);
  const { managerId } = useManagerId();

  const [reportDismissedGw, setReportDismissedGw] = useState<number | null>(null);

  const {
    data: players,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["fpl", "players"],
    queryFn: fetchPlayers,
  });

  const { data: lastFinishedGw } = useQuery({
    queryKey: ["fpl", "lastFinishedGw", managerId],
    queryFn: async () => {
      const bootstrap = await getBootstrapData();
      const gw = getLastFinishedGameweek(bootstrap);
      if (gw && managerId) {
        const key = REPORT_DISMISSED_KEY(managerId, gw);
        const dismissed = await AsyncStorage.getItem(key);
        if (dismissed) setReportDismissedGw(gw);
      }
      return gw;
    },
    staleTime: 5 * 60 * 1000,
  });

  const showReportBanner =
    !!lastFinishedGw && !!managerId && reportDismissedGw !== lastFinishedGw;

  const handleDismissReportBanner = async () => {
    if (!lastFinishedGw || !managerId) return;
    const key = REPORT_DISMISSED_KEY(managerId, lastFinishedGw);
    await AsyncStorage.setItem(key, "1");
    setReportDismissedGw(lastFinishedGw);
  };

  const renderPlayer = ({ item }: { item: NormalizedPlayer }) => (
    <View
      style={[
        styles.playerCard,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, { color: colors.foreground }]}>
          {item.name}
        </Text>
        <View style={styles.statsRow}>
          <View
            style={[
              styles.priceBadge,
              { backgroundColor: colors.secondary },
            ]}
          >
            <Text
              style={[styles.priceText, { color: colors.secondaryForeground }]}
            >
              £{item.price.toFixed(1)}m
            </Text>
          </View>
          <View style={styles.formContainer}>
            <Text
              style={[styles.formLabel, { color: colors.mutedForeground }]}
            >
              Form
            </Text>
            <Text style={[styles.formValue, { color: colors.primary }]}>
              {item.form}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View
        style={[styles.centered, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          Loading players...
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View
        style={[styles.centered, { backgroundColor: colors.background }]}
      >
        <Feather name="wifi-off" size={48} color={colors.mutedForeground} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>
          Connection Error
        </Text>
        <Text style={[styles.errorMessage, { color: colors.mutedForeground }]}>
          Couldn't reach the FPL servers — try again in a moment.
        </Text>
        <Pressable
          onPress={() => refetch()}
          style={({ pressed }) => [
            styles.retryButton,
            {
              backgroundColor: colors.primary,
              borderRadius: colors.radius,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
            Try Again
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {config.brandName}
          </Text>
          {streak && (
            <StreakBadge
              currentStreak={streak.current_streak}
              shieldAvailable={streak.streak_shield_available}
              shieldUsedGw={streak.streak_shield_used_gw}
              onPress={() => setShowStreakDetail(true)}
            />
          )}
        </View>
        <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
          {players?.length ?? 0} players
        </Text>
      </View>

      {showReportBanner && (
        <Pressable
          style={[styles.reportBanner, { backgroundColor: "#1a472a" }]}
          onPress={() => setShowReportCard(true)}
        >
          <View style={styles.reportBannerLeft}>
            <Feather name="award" size={20} color="#00ff87" />
            <View>
              <Text style={styles.reportBannerTitle}>
                Your GW{lastFinishedGw} report is ready
              </Text>
              <Text style={styles.reportBannerSub}>
                See how your decisions scored
              </Text>
            </View>
          </View>
          <View style={styles.reportBannerActions}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleDismissReportBanner();
              }}
              hitSlop={8}
            >
              <Feather name="x" size={16} color="#ffffffaa" />
            </Pressable>
            <Feather name="chevron-right" size={18} color="#00ff87" />
          </View>
        </Pressable>
      )}

      <FlatList
        data={players}
        renderItem={renderPlayer}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom:
              Platform.OS === "web" ? 34 + 84 : insets.bottom + 84,
          },
        ]}
        scrollEnabled={(players?.length ?? 0) > 0}
        onRefresh={() => refetch()}
        refreshing={isRefetching}
        showsVerticalScrollIndicator={false}
      />

      {streak && (
        <StreakDetailSheet
          visible={showStreakDetail}
          onClose={() => setShowStreakDetail(false)}
          currentStreak={streak.current_streak}
          longestStreak={streak.longest_streak}
          shieldAvailable={streak.streak_shield_available}
          shieldUsedGw={streak.streak_shield_used_gw}
        />
      )}

      {pendingMilestone && streak && (
        <MilestoneCelebration
          milestone={pendingMilestone}
          currentStreak={streak.current_streak}
          onDismiss={dismissMilestone}
        />
      )}

      {lastFinishedGw && managerId && (
        <ReportCardSheet
          visible={showReportCard}
          onClose={() => setShowReportCard(false)}
          gameweek={lastFinishedGw}
          managerId={managerId}
          vibe="expert"
          streakCount={streak?.current_streak}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  playerCard: {
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  playerInfo: {
    gap: 8,
  },
  playerName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  priceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  formContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  formLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  formValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginTop: 12,
  },
  errorMessage: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  retryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  reportBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  reportBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  reportBannerTitle: {
    color: "#00ff87",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  reportBannerSub: {
    color: "#ffffffcc",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  reportBannerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
