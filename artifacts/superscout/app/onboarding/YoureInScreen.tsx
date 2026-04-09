import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import config from "@/constants/config";

interface Props {
  teamName: string | null;
  onFinish: () => void;
}

export default function YoureInScreen({ teamName, onFinish }: Props) {
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
        <Feather name="check-circle" size={64} color={colors.accent} />
        <Text style={[styles.heading, { color: colors.primaryForeground }]}>
          {teamName ? teamName : `Welcome to ${config.brandName}`}
        </Text>
        <Text style={[styles.subtext, { color: colors.primaryForeground }]}>
          Your first recommendation is ready.
        </Text>
      </View>

      <Pressable
        onPress={onFinish}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.primary }]}>
          See my squad
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
    gap: 16,
  },
  heading: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtext: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    opacity: 0.9,
    textAlign: "center",
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
