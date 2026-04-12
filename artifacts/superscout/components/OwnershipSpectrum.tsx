import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface OwnershipSpectrumProps {
  ownershipPct: number;
  ownershipContext: string;
}

export default function OwnershipSpectrum({ ownershipPct, ownershipContext }: OwnershipSpectrumProps) {
  const colors = useColors();

  const raw = 100 - ownershipPct;
  const dotPosition = Math.min(95, Math.max(5, raw));

  return (
    <View style={[styles.container, { backgroundColor: colors.muted }]}>
      <View style={styles.labelsRow}>
        <Text style={[styles.label, { color: colors.primary + "99" }]}>With the crowd</Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Against the crowd</Text>
      </View>

      <View style={styles.trackWrapper}>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <View style={[styles.trackGradientLeft, { backgroundColor: colors.primary + "30" }]} />
        </View>
        <View
          style={[
            styles.dot,
            {
              left: `${dotPosition}%`,
              backgroundColor: colors.primary,
              borderColor: "#ffffff",
              shadowColor: "#000000",
            },
          ]}
        />
      </View>

      <Text style={[styles.contextText, { color: colors.mutedForeground }]}>
        {ownershipContext}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  labelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  trackWrapper: {
    height: 16,
    justifyContent: "center",
    marginBottom: 8,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  trackGradientLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "50%",
    borderRadius: 3,
  },
  dot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    marginLeft: -8,
    top: 0,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  contextText: {
    fontSize: 12.5,
    lineHeight: 17,
    fontStyle: "italic",
  },
});
