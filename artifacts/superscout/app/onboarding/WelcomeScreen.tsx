import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import config from "@/constants/config";

interface Props {
  onNext: () => void;
}

export default function WelcomeScreen({ onNext }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.primary, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.logoArea}>
          <View style={[styles.logoCircle, { backgroundColor: colors.accent }]}>
            <Text style={[styles.logoText, { color: colors.primary }]}>SS</Text>
          </View>
          <Text style={[styles.brandName, { color: colors.primaryForeground }]}>
            {config.brandName}
          </Text>
        </View>
        <Text style={[styles.tagline, { color: colors.primaryForeground }]}>
          Your AI fantasy football coach.{"\n"}Three personalities. Smarter
          decisions.
        </Text>
      </View>
      <Pressable
        onPress={onNext}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.primary }]}>
          Let's go
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  brandName: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
  },
  tagline: {
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 26,
    opacity: 0.9,
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
