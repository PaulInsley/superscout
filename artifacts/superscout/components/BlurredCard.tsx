import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface BlurredCardProps {
  onPress: () => void;
}

export default function BlurredCard({ onPress }: BlurredCardProps) {
  const colors = useColors();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.blurOverlay}>
          <View style={styles.placeholderRow}>
            <View style={[styles.placeholderCircle, { backgroundColor: colors.border }]} />
            <View style={styles.placeholderLines}>
              <View style={[styles.placeholderLine, { backgroundColor: colors.border, width: "60%" }]} />
              <View style={[styles.placeholderLine, { backgroundColor: colors.border, width: "40%" }]} />
            </View>
          </View>
          <View style={styles.placeholderBars}>
            <View style={[styles.placeholderBar, { backgroundColor: colors.border }]} />
            <View style={[styles.placeholderBar, { backgroundColor: colors.border, width: "70%" }]} />
          </View>
        </View>

        <View style={styles.overlay}>
          <Feather name="lock" size={16} color={colors.mutedForeground} />
          <Text style={[styles.overlayText, { color: colors.mutedForeground }]}>
            See all options with Pro
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
    position: "relative",
  },
  blurOverlay: {
    padding: 16,
    opacity: 0.3,
  },
  placeholderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  placeholderCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  placeholderLines: {
    flex: 1,
    gap: 6,
  },
  placeholderLine: {
    height: 10,
    borderRadius: 5,
  },
  placeholderBars: {
    gap: 6,
  },
  placeholderBar: {
    height: 8,
    borderRadius: 4,
    width: "90%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  overlayText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
