import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { fetchTeamName } from "@/services/fpl";

interface Props {
  onNext: (managerId: number | null, teamName: string | null) => void;
}

export default function ConnectFPLScreen({ onNext }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [validatedId, setValidatedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    const id = Number(input.trim());
    if (!id || isNaN(id)) {
      setError("Please enter a valid number");
      return;
    }

    setLoading(true);
    setError(null);
    setTeamName(null);
    setValidatedId(null);

    const name = await fetchTeamName(id);
    setLoading(false);

    if (name) {
      setTeamName(name);
      setValidatedId(id);
    } else {
      setError("Couldn't find that manager ID — double-check the number");
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom + 32,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Connect Your FPL Team
        </Text>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Find it in the FPL app under Points {'>'} your name
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.input,
                borderRadius: colors.radius,
                color: colors.foreground,
              },
            ]}
            value={input}
            onChangeText={(t) => {
              setInput(t);
              setTeamName(null);
              setValidatedId(null);
              setError(null);
            }}
            placeholder="e.g. 13042160"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            returnKeyType="go"
            onSubmitEditing={handleLookup}
          />
          <Pressable
            onPress={handleLookup}
            disabled={!input.trim() || loading}
            style={({ pressed }) => [
              styles.lookupButton,
              {
                backgroundColor: input.trim()
                  ? colors.primary
                  : colors.muted,
                borderRadius: colors.radius,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text
                style={[
                  styles.lookupText,
                  {
                    color: input.trim()
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
                ]}
              >
                Find
              </Text>
            )}
          </Pressable>
        </View>

        {error && (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        )}

        {teamName && (
          <View
            style={[
              styles.confirmCard,
              {
                backgroundColor: colors.secondary,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="check-circle" size={20} color="#22c55e" />
            <Text
              style={[
                styles.confirmText,
                { color: colors.secondaryForeground },
              ]}
            >
              Found: {teamName} ✓
            </Text>
          </View>
        )}
      </View>

      <View style={styles.bottomButtons}>
        {teamName && validatedId && (
          <Pressable
            onPress={() => onNext(validatedId, teamName)}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text
              style={[styles.buttonText, { color: colors.primaryForeground }]}
            >
              That's my team
            </Text>
          </Pressable>
        )}
        <Pressable onPress={() => onNext(null, null)}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
            Skip for now
          </Text>
        </Pressable>
      </View>
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
    gap: 16,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  hint: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  textInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  lookupButton: {
    height: 48,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  lookupText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  confirmCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  confirmText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  bottomButtons: {
    gap: 16,
    alignItems: "center",
  },
  button: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  buttonText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  skipText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    paddingVertical: 8,
  },
});
