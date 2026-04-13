import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { getStreakMessage, type VibeType } from "@/config/streaks/streakMessages";
import { getSportConfig } from "@/config/sports/sportConfig";

const PERSONA_KEY = "superscout_persona";

interface StreakDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  currentStreak: number;
  longestStreak: number;
  shieldAvailable: boolean;
  shieldUsedGw: number | null;
  sport?: string;
}

export default function StreakDetailSheet({
  visible,
  onClose,
  currentStreak,
  longestStreak,
  shieldAvailable,
  shieldUsedGw,
  sport = "fpl",
}: StreakDetailSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const sportConfig = getSportConfig(sport);
  const [vibe, setVibe] = useState<VibeType>("expert");

  useEffect(() => {
    AsyncStorage.getItem(PERSONA_KEY).then((val) => {
      if (val === "expert" || val === "critic" || val === "fanboy") {
        setVibe(val);
      }
    });
  }, [visible]);

  const message = getStreakMessage(vibe, currentStreak);

  const shieldStatus = shieldAvailable
    ? "Available"
    : shieldUsedGw !== null
      ? `Used (GW${shieldUsedGw})`
      : currentStreak < 5
        ? "Locked (reach 5 to unlock)"
        : "Not yet earned";

  const shieldColor = shieldAvailable ? "#f59e0b" : "#666";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close streak details" accessibilityRole="button">
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={{ fontSize: 40 }}>🔥</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Your Streak</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.background }]}>
              <Text style={[styles.statValue, { color: "#f97316" }]}>{currentStreak}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Current</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.background }]}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{longestStreak}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Personal Best
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.shieldRow,
              { backgroundColor: colors.background, borderRadius: colors.radius },
            ]}
          >
            <Feather
              name={shieldAvailable ? "shield" : "shield-off"}
              size={20}
              color={shieldColor}
            />
            <View style={styles.shieldInfo}>
              <Text style={[styles.shieldTitle, { color: colors.foreground }]}>Streak Shield</Text>
              <Text style={[styles.shieldStatus, { color: shieldColor }]}>{shieldStatus}</Text>
            </View>
          </View>

          <Text style={[styles.shieldExplainer, { color: colors.mutedForeground }]}>
            The Streak Shield saves your streak if you miss exactly one {sportConfig.roundName}.
            Earn it by reaching a 5-{sportConfig.roundName} streak.
          </Text>

          {currentStreak > 0 && message ? (
            <View
              style={[
                styles.messageBox,
                { backgroundColor: colors.background, borderRadius: colors.radius },
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  {
                    color: colors.foreground,
                    fontStyle: vibe === "critic" ? "italic" : "normal",
                  },
                ]}
              >
                "{message}"
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.closeText, { color: colors.primaryForeground }]}>Close</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#666",
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  shieldRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    marginBottom: 8,
  },
  shieldInfo: {
    flex: 1,
  },
  shieldTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  shieldStatus: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  shieldExplainer: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  messageBox: {
    padding: 14,
    marginBottom: 16,
  },
  messageText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  closeButton: {
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  closeText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
