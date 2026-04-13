import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

interface StreakBadgeProps {
  currentStreak: number;
  shieldAvailable: boolean;
  shieldUsedGw?: number | null;
  onPress?: () => void;
  size?: "small" | "large";
}

function getFlameColor(streak: number): string {
  if (streak <= 0) return "#666";
  if (streak <= 4) return "#f97316";
  if (streak <= 9) return "#fb923c";
  return "#fbbf24";
}

function getFlameSize(streak: number, baseSize: "small" | "large"): number {
  const base = baseSize === "large" ? 28 : 20;
  if (streak <= 0) return base;
  if (streak <= 4) return base;
  if (streak <= 9) return base + 4;
  return base + 6;
}

export default function StreakBadge({
  currentStreak,
  shieldAvailable,
  shieldUsedGw,
  onPress,
  size = "small",
}: StreakBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentStreak >= 20) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }

    if (currentStreak >= 10) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      glowAnim.setValue(0);
    }
  }, [currentStreak, pulseAnim, glowAnim]);

  const flameColor = getFlameColor(currentStreak);
  const flameSize = getFlameSize(currentStreak, size);
  const isLarge = size === "large";

  return (
    <Pressable onPress={onPress} accessibilityLabel={`Streak: ${currentStreak} days`} accessibilityRole="button" style={styles.container}>
      <Animated.View style={[styles.flameWrapper, { transform: [{ scale: pulseAnim }] }]}>
        {currentStreak >= 10 && (
          <Animated.View
            style={[
              styles.glow,
              {
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 0.5],
                }),
                backgroundColor: flameColor,
                width: flameSize + 16,
                height: flameSize + 16,
                borderRadius: (flameSize + 16) / 2,
              },
            ]}
          />
        )}
        <Text style={{ fontSize: flameSize }}>{currentStreak <= 0 ? "🔥" : "🔥"}</Text>
      </Animated.View>

      {currentStreak > 0 && (
        <Text
          style={[
            styles.count,
            {
              fontSize: isLarge ? 20 : 16,
              color: currentStreak <= 0 ? "#666" : "#fff",
              fontFamily: "Inter_700Bold",
            },
          ]}
        >
          {currentStreak}
        </Text>
      )}

      {(shieldAvailable || shieldUsedGw !== null) && (
        <View style={styles.shieldIcon}>
          <Feather
            name={shieldAvailable ? "shield" : "shield-off"}
            size={isLarge ? 16 : 12}
            color={shieldAvailable ? "#f59e0b" : "#666"}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  flameWrapper: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  glow: {
    position: "absolute",
  },
  count: {
    marginLeft: 2,
  },
  shieldIcon: {
    marginLeft: 2,
  },
});
