import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface ProBadgeProps {
  size?: "small" | "medium";
}

export default function ProBadge({ size = "small" }: ProBadgeProps) {
  const isSmall = size === "small";
  return (
    <View style={[styles.badge, isSmall ? styles.badgeSmall : styles.badgeMedium]} accessibilityElementsHidden={true}>
      <Text style={[styles.text, isSmall ? styles.textSmall : styles.textMedium]}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: "#4338ca",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeSmall: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeMedium: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    color: "#ffffff",
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  textSmall: {
    fontSize: 9,
  },
  textMedium: {
    fontSize: 11,
  },
});
