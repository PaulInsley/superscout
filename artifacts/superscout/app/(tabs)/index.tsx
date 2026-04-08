import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
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

import { useColors } from "@/hooks/useColors";
import { fetchPlayers } from "@/services/fpl";
import type { NormalizedPlayer } from "@/services/fpl";
import config from "@/constants/config";

export default function PlayersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

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
            paddingTop: Platform.OS === "web" ? 67 + 16 : 16,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {config.brandName}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
          {players?.length ?? 0} players
        </Text>
      </View>
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
});
