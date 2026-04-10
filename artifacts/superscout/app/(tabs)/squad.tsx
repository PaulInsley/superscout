import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { useManagerId } from "@/hooks/useManagerId";
import { fetchManagerData } from "@/services/fpl";
import type { SquadPlayer, NormalizedTransfer, FPLLeague } from "@/services/fpl";

type ActiveTab = "squad" | "transfers" | "leagues";

export default function SquadScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { managerId, loading: managerLoading, refresh: refreshManagerId } = useManagerId();
  const [activeTab, setActiveTab] = useState<ActiveTab>("squad");

  useFocusEffect(
    useCallback(() => {
      refreshManagerId();
    }, [refreshManagerId]),
  );

  const {
    data: managerData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["fpl", "manager", managerId],
    queryFn: () => fetchManagerData(managerId!),
    enabled: managerId !== null,
  });

  const isNotFound = isError && error?.message === "MANAGER_NOT_FOUND";

  const formatRank = (rank: number): string => {
    return rank.toLocaleString();
  };

  if (managerLoading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!managerId) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <Feather name="link" size={40} color={colors.mutedForeground} />
        <Text
          style={[
            styles.connectPrompt,
            { color: colors.foreground },
          ]}
        >
          Connect your FPL account in Settings to view your squad.
        </Text>
      </View>
    );
  }

  const renderManagerHeader = () => {
    if (!managerData) return null;
    return (
      <View
        style={[
          styles.managerHeader,
          {
            backgroundColor: colors.primary,
            borderRadius: colors.radius,
          },
        ]}
      >
        <Text
          style={[styles.teamName, { color: colors.primaryForeground }]}
        >
          {managerData.teamName}
        </Text>
        <Text
          style={[styles.managerName, { color: colors.primaryForeground }]}
          numberOfLines={1}
        >
          {managerData.managerName}
        </Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text
              style={[styles.statValue, { color: colors.primaryForeground }]}
            >
              {managerData.overallPoints ?? "—"}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: colors.primaryForeground, opacity: 0.75 },
              ]}
            >
              Overall Pts
            </Text>
          </View>
          <View
            style={[
              styles.statDivider,
              { backgroundColor: colors.primaryForeground, opacity: 0.2 },
            ]}
          />
          <View style={styles.statItem}>
            <Text
              style={[styles.statValue, { color: colors.primaryForeground }]}
            >
              {managerData.overallRank != null
                ? formatRank(managerData.overallRank)
                : "—"}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: colors.primaryForeground, opacity: 0.75 },
              ]}
            >
              Overall Rank
            </Text>
          </View>
          <View
            style={[
              styles.statDivider,
              { backgroundColor: colors.primaryForeground, opacity: 0.2 },
            ]}
          />
          <View style={styles.statItem}>
            <Text
              style={[styles.statValue, { color: colors.primaryForeground }]}
            >
              {managerData.currentGwPoints ?? "—"}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: colors.primaryForeground, opacity: 0.75 },
              ]}
            >
              GW Pts
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderTabBar = () => {
    if (!managerData) return null;
    const tabs: { key: ActiveTab; label: string }[] = [
      { key: "squad", label: "Squad" },
      { key: "transfers", label: "Transfers" },
      { key: "leagues", label: "Leagues" },
    ];
    return (
      <View
        style={[
          styles.tabBar,
          { borderBottomColor: colors.border },
        ]}
      >
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[
              styles.tab,
              activeTab === tab.key && {
                borderBottomColor: colors.primary,
                borderBottomWidth: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === tab.key
                      ? colors.primary
                      : colors.mutedForeground,
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderSquadPlayer = (player: SquadPlayer) => (
    <View
      key={player.id}
      style={[
        styles.squadCard,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.squadCardLeft}>
        <View style={styles.playerNameRow}>
          <Text style={[styles.squadPlayerName, { color: colors.foreground }]}>
            {player.name}
          </Text>
          {player.isCaptain && (
            <View
              style={[
                styles.captainBadge,
                { backgroundColor: colors.accent },
              ]}
            >
              <Text style={[styles.captainText, { color: colors.accentForeground }]}>
                C
              </Text>
            </View>
          )}
          {player.isViceCaptain && (
            <View
              style={[
                styles.captainBadge,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Text
                style={[
                  styles.captainText,
                  { color: colors.secondaryForeground },
                ]}
              >
                V
              </Text>
            </View>
          )}
        </View>
        <View style={styles.squadMeta}>
          <Text
            style={[styles.positionText, { color: colors.mutedForeground }]}
          >
            {player.position}
          </Text>
          <Text
            style={[styles.squadPrice, { color: colors.mutedForeground }]}
          >
            £{player.price.toFixed(1)}m
          </Text>
        </View>
      </View>
      <View style={styles.squadCardRight}>
        <Text style={[styles.formBadge, { color: colors.primary }]}>
          {player.form}
        </Text>
      </View>
    </View>
  );

  const renderSquadTab = () => {
    if (!managerData) return null;

    if (managerData.isNewManager) {
      return (
        <View style={styles.emptyState}>
          <Feather name="clock" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            This manager hasn't played a gameweek yet. Squad data will appear once they've entered their first gameweek.
          </Text>
        </View>
      );
    }

    if (managerData.squad.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Feather name="users" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No squad data available for this gameweek
          </Text>
        </View>
      );
    }

    const starters = managerData.squad.filter((p) => !p.isBench);
    const bench = managerData.squad.filter((p) => p.isBench);

    return (
      <View style={styles.tabContent}>
        {managerData.gameweekLoaded != null && (
          <Text style={[styles.gwIndicator, { color: colors.mutedForeground }]}>
            Gameweek {managerData.gameweekLoaded}
          </Text>
        )}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Starting XI
        </Text>
        {starters.map(renderSquadPlayer)}

        <View
          style={[styles.benchDivider, { backgroundColor: colors.border }]}
        />
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          Bench
        </Text>
        {bench.map(renderSquadPlayer)}
      </View>
    );
  };

  const renderTransferItem = (transfer: NormalizedTransfer, index: number) => (
    <View
      key={`${transfer.event}-${index}`}
      style={[
        styles.transferCard,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.gwLabel, { color: colors.mutedForeground }]}>
        GW {transfer.event}
      </Text>
      <View style={styles.transferRow}>
        <View style={styles.transferPlayer}>
          <Feather name="arrow-up-circle" size={16} color="#22c55e" />
          <View style={styles.transferDetail}>
            <Text
              style={[styles.transferName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {transfer.playerIn}
            </Text>
            <Text
              style={[styles.transferCost, { color: colors.mutedForeground }]}
            >
              £{transfer.playerInCost.toFixed(1)}m
            </Text>
          </View>
        </View>
        <View style={styles.transferPlayer}>
          <Feather name="arrow-down-circle" size={16} color="#ef4444" />
          <View style={styles.transferDetail}>
            <Text
              style={[styles.transferName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {transfer.playerOut}
            </Text>
            <Text
              style={[styles.transferCost, { color: colors.mutedForeground }]}
            >
              £{transfer.playerOutCost.toFixed(1)}m
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderTransfersTab = () => {
    if (!managerData) return null;
    if (managerData.transfers.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Feather
            name="repeat"
            size={40}
            color={colors.mutedForeground}
          />
          <Text
            style={[styles.emptyText, { color: colors.mutedForeground }]}
          >
            No transfers yet
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.tabContent}>
        {managerData.transfers.map((t, i) => renderTransferItem(t, i))}
      </View>
    );
  };

  const renderLeagueItem = (league: FPLLeague) => (
    <View
      key={league.id}
      style={[
        styles.leagueCard,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.leagueName, { color: colors.foreground }]}>
        {league.name}
      </Text>
      <View style={styles.leagueMeta}>
        <View
          style={[styles.rankBadge, { backgroundColor: colors.secondary }]}
        >
          <Text
            style={[
              styles.rankText,
              { color: colors.secondaryForeground },
            ]}
          >
            Rank: {formatRank(league.entry_rank)}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderLeaguesTab = () => {
    if (!managerData) return null;
    if (managerData.leagues.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Feather
            name="award"
            size={40}
            color={colors.mutedForeground}
          />
          <Text
            style={[styles.emptyText, { color: colors.mutedForeground }]}
          >
            No leagues found
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.tabContent}>
        {managerData.leagues.map(renderLeagueItem)}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 8,
            paddingBottom:
              Platform.OS === "web" ? 34 + 84 : insets.bottom + 84,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>
          My Squad
        </Text>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={[styles.loadingText, { color: colors.mutedForeground }]}
            >
              Loading squad...
            </Text>
          </View>
        )}

        {isNotFound && (
          <View style={styles.errorContainer}>
            <Feather
              name="alert-circle"
              size={40}
              color={colors.mutedForeground}
            />
            <Text style={[styles.errorTitle, { color: colors.foreground }]}>
              Manager Not Found
            </Text>
            <Text
              style={[styles.errorMessage, { color: colors.mutedForeground }]}
            >
              Couldn't find that manager ID — check your FPL connection in
              Settings.
            </Text>
          </View>
        )}

        {isError && !isNotFound && (
          <View style={styles.errorContainer}>
            <Feather
              name="wifi-off"
              size={40}
              color={colors.mutedForeground}
            />
            <Text style={[styles.errorTitle, { color: colors.foreground }]}>
              Connection Error
            </Text>
            <Text
              style={[styles.errorMessage, { color: colors.mutedForeground }]}
            >
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
              <Text
                style={[
                  styles.retryButtonText,
                  { color: colors.primaryForeground },
                ]}
              >
                Try Again
              </Text>
            </Pressable>
          </View>
        )}

        {managerData && !isLoading && (
          <>
            {renderManagerHeader()}
            {renderTabBar()}
            {activeTab === "squad" && renderSquadTab()}
            {activeTab === "transfers" && renderTransfersTab()}
            {activeTab === "leagues" && renderLeaguesTab()}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  connectPrompt: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 22,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  errorMessage: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  managerHeader: {
    padding: 20,
    marginBottom: 16,
  },
  teamName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  managerName: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    opacity: 0.85,
  },
  statsGrid: {
    flexDirection: "row",
    marginTop: 16,
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  tabContent: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  gwIndicator: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginBottom: 8,
  },
  benchDivider: {
    height: 1,
    marginVertical: 12,
  },
  squadCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
  },
  squadCardLeft: {
    flex: 1,
    gap: 4,
  },
  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  squadPlayerName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  captainBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  captainText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  squadMeta: {
    flexDirection: "row",
    gap: 10,
  },
  positionText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  squadPrice: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  squadCardRight: {
    alignItems: "flex-end",
  },
  formBadge: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  transferCard: {
    padding: 14,
    borderWidth: 1,
  },
  gwLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  transferRow: {
    gap: 8,
  },
  transferPlayer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  transferDetail: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  transferName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  transferCost: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  leagueCard: {
    padding: 14,
    borderWidth: 1,
  },
  leagueName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  leagueMeta: {
    flexDirection: "row",
  },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rankText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
