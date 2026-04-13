import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  onEnable: () => void;
  onSkip: () => void;
}

const NOTIFICATION_TYPES = [
  {
    icon: "alarm-outline" as const,
    label: "Deadline reminders",
    detail: "2 hours before each gameweek deadline",
  },
  {
    icon: "trophy-outline" as const,
    label: "Results updates",
    detail: "Monday morning after all matches",
  },
  {
    icon: "trending-down-outline" as const,
    label: "Price change alerts",
    detail: "When your players may drop in price",
  },
  {
    icon: "flame-outline" as const,
    label: "Streak reminders",
    detail: "When your streak is at risk",
  },
];

export default function NotificationConsentScreen({ onEnable, onSkip }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="notifications" size={48} color="#00ff87" />
      </View>

      <Text style={styles.heading}>Stay in the game</Text>
      <Text style={styles.subheading}>SuperScout sends you:</Text>

      <View style={styles.list}>
        {NOTIFICATION_TYPES.map((item) => (
          <View key={item.label} style={styles.listItem}>
            <Ionicons name={item.icon} size={22} color="#00ff87" style={styles.listIcon} />
            <View style={styles.listText}>
              <Text style={styles.listLabel}>{item.label}</Text>
              <Text style={styles.listDetail}>{item.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.cap}>
        Maximum 3 notifications per gameweek.{"\n"}
        You can control each type in Settings.
      </Text>

      <View style={styles.actions}>
        <Pressable style={styles.enableButton} onPress={onEnable} accessibilityLabel="Enable notifications" accessibilityRole="button">
          <Ionicons
            name="notifications-outline"
            size={20}
            color="#1a472a"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.enableText}>Enable notifications</Text>
        </Pressable>

        <Pressable style={styles.skipButton} onPress={onSkip} accessibilityLabel="Skip notifications" accessibilityRole="button">
          <Text style={styles.skipText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d1117",
    paddingHorizontal: 28,
    justifyContent: "center",
  },
  iconContainer: {
    alignSelf: "center",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 255, 135, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
  },
  subheading: {
    fontSize: 16,
    color: "#8b949e",
    textAlign: "center",
    marginBottom: 24,
  },
  list: {
    marginBottom: 20,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  listIcon: {
    marginTop: 2,
    marginRight: 14,
    width: 22,
  },
  listText: {
    flex: 1,
  },
  listLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 2,
  },
  listDetail: {
    fontSize: 14,
    color: "#8b949e",
  },
  cap: {
    fontSize: 13,
    color: "#6e7681",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 32,
  },
  actions: {
    alignItems: "center",
  },
  enableButton: {
    flexDirection: "row",
    backgroundColor: "#00ff87",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 16,
  },
  enableText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a472a",
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
    color: "#8b949e",
  },
});
