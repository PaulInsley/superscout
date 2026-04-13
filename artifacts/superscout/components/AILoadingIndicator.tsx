import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type Vibe = "expert" | "critic" | "fanboy";

const LOADING_MESSAGES: Record<Vibe, string[]> = {
  expert: [
    "Analysing 500+ players against your squad...",
    "Cross-referencing fixture difficulty ratings...",
    "Calculating sell prices and budget impact...",
    "Evaluating form trends over the last 4 gameweeks...",
    "Weighing ownership risk vs reward...",
    "Running final projections...",
  ],
  critic: [
    "Looking at your squad... this might take a minute...",
    "Running the numbers. Try not to panic.",
    "Honestly, some of these picks are interesting choices...",
    "Cross-checking your decisions against common sense...",
    "Almost done. The suspense is killing you, I can tell.",
    "Right. Let's see what we're working with here...",
  ],
  fanboy: [
    "CRUNCHING THE NUMBERS FOR YOU!!",
    "Scanning the ENTIRE player pool!!",
    "This is going to be GOOD — hang tight!!",
    "Finding those DIFFERENTIAL GEMS!! 🔥",
    "Almost there — the HYPE is building!!",
    "BRO this analysis is going to be FIRE!! 🚀",
  ],
};

const CYCLE_INTERVAL = 3500;

interface Props {
  vibe: Vibe;
  label?: string;
}

export default function AILoadingIndicator({ vibe, label }: Props) {
  const colors = useColors();
  const messages = LOADING_MESSAGES[vibe] ?? LOADING_MESSAGES.expert;
  const [messageIndex, setMessageIndex] = useState(0);
  const [fadeAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setMessageIndex((prev) => (prev + 1) % messages.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, CYCLE_INTERVAL);

    return () => clearInterval(interval);
  }, [messages.length, fadeAnim]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
      {label && <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>}
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={[styles.message, { color: colors.mutedForeground }]}>
          {messages[messageIndex]}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 14,
  },
  label: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  message: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    minHeight: 20,
    paddingHorizontal: 16,
  },
});
