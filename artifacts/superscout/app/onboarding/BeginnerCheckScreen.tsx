import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface Props {
  onNext: (isBeginner: boolean) => void;
}

export default function BeginnerCheckScreen({ onNext }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 32,
        },
      ]}
    >
      <View style={styles.content}>
        <Feather name="book-open" size={40} color={colors.accent} />

        <Text style={[styles.title, { color: colors.foreground }]}>
          Is this your first season of FPL?
        </Text>

        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          No worries — SuperScout will coach you through the basics over your
          first few gameweeks. Same app, same features, just with your coach
          explaining things as you go.
        </Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          onPress={() => onNext(true)}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: colors.accent,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text style={[styles.primaryButtonText, { color: colors.primary }]}>
            Yes, I'm new
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onNext(false)}
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text
            style={[styles.secondaryButtonText, { color: colors.foreground }]}
          >
            Nah, I know the game
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  content: {
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  buttons: {
    gap: 12,
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  secondaryButton: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
});
