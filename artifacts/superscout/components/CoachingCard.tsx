import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface CoachingCardProps {
  headline: string;
  body: string;
  onDismiss: () => void;
  isGraduation?: boolean;
}

export default function CoachingCard({
  headline,
  body,
  onDismiss,
  isGraduation,
}: CoachingCardProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isGraduation ? "#22c55e10" : "#818CF810",
          borderColor: isGraduation ? "#22c55e40" : "#818CF840",
        },
      ]}
    >
      <View style={styles.labelRow}>
        <Feather
          name={isGraduation ? "award" : "book-open"}
          size={14}
          color={isGraduation ? "#22c55e" : "#818CF8"}
        />
        <Text style={[styles.label, { color: isGraduation ? "#22c55e" : "#818CF8" }]}>
          {isGraduation ? "Congratulations" : "Coach"}
        </Text>
      </View>

      <Text style={[styles.headline, { color: colors.foreground }]}>{headline}</Text>

      <Text style={[styles.body, { color: colors.foreground }]}>{body}</Text>

      <Pressable
        onPress={onDismiss}
        style={({ pressed }) => [
          styles.dismissButton,
          {
            backgroundColor: isGraduation ? "#22c55e20" : "#818CF820",
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[styles.dismissText, { color: isGraduation ? "#22c55e" : "#818CF8" }]}>
          Got it
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headline: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  dismissButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
