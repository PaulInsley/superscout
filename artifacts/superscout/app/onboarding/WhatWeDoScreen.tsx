import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const BULLETS: { icon: keyof typeof Feather.glyphMap; text: string }[] = [
  {
    icon: "layers",
    text: "Gives you 3\u20135 options per decision, not just one answer",
  },
  {
    icon: "git-branch",
    text: "Tracks your decisions and shows what would have happened",
  },
  {
    icon: "trending-up",
    text: "Learns how you play and gets sharper over time",
  },
];

interface Props {
  onNext: () => void;
}

export default function WhatWeDoScreen({ onNext }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom + 32,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          What SuperScout Does
        </Text>

        {BULLETS.map((b, i) => (
          <View key={i} style={styles.bulletRow}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Feather name={b.icon} size={20} color={colors.primary} />
            </View>
            <Text style={[styles.bulletText, { color: colors.foreground }]}>
              {b.text}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onNext}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Text
          style={[styles.buttonText, { color: colors.primaryForeground }]}
        >
          Got it, let's play
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  content: {
    gap: 28,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    lineHeight: 23,
  },
  button: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
});
