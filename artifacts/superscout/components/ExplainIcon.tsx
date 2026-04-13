import { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface ExplainIconProps {
  tipText: string;
  isBeginner: boolean;
}

export default function ExplainIcon({ tipText, isBeginner }: ExplainIconProps) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);

  if (isBeginner) return null;

  return (
    <>
      <Pressable onPress={() => setVisible(true)} hitSlop={8} style={styles.iconButton}>
        <Feather name="help-circle" size={14} color={colors.mutedForeground} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View
            style={[
              styles.tooltip,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.tooltipHeader}>
              <Feather name="book-open" size={14} color="#818CF8" />
              <Text style={[styles.tooltipLabel, { color: "#818CF8" }]}>Coach</Text>
            </View>
            <Text style={[styles.tooltipText, { color: colors.foreground }]}>{tipText}</Text>
            <Pressable
              onPress={() => setVisible(false)}
              style={[styles.closeButton, { backgroundColor: colors.muted }]}
            >
              <Text style={[styles.closeText, { color: colors.foreground }]}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    padding: 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  tooltip: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  tooltipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  tooltipLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tooltipText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  closeButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
