import React, { useState, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { fetchTeamName } from "@/services/fpl";
import { supabase } from "@/services/supabase";

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
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleLookup = useCallback(async () => {
    const id = Number(input.trim());
    if (!id || isNaN(id)) {
      setError("Please enter a valid number");
      return;
    }

    Keyboard.dismiss();
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
      setError("Couldn't find that Manager ID — double-check the number");
    }
  }, [input]);

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

        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Enter your FPL Manager ID to get started
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
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
              <ActivityIndicator
                size="small"
                color={colors.primaryForeground}
              />
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

        {teamName && validatedId && (
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
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.confirmText,
                  { color: colors.secondaryForeground },
                ]}
              >
                {teamName}
              </Text>
              <Text
                style={[styles.confirmId, { color: colors.mutedForeground }]}
              >
                Manager ID: {validatedId}
              </Text>
            </View>
          </View>
        )}

        <View
          style={[
            styles.helpCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Text style={[styles.helpTitle, { color: colors.foreground }]}>
            How to find your Manager ID
          </Text>
          <View style={styles.helpSteps}>
            <View style={styles.helpStep}>
              <View
                style={[
                  styles.stepNumber,
                  { backgroundColor: colors.accent + "20" },
                ]}
              >
                <Text style={[styles.stepNumberText, { color: colors.accent }]}>
                  1
                </Text>
              </View>
              <Text
                style={[styles.helpStepText, { color: colors.mutedForeground }]}
              >
                Open the FPL website or app
              </Text>
            </View>
            <View style={styles.helpStep}>
              <View
                style={[
                  styles.stepNumber,
                  { backgroundColor: colors.accent + "20" },
                ]}
              >
                <Text style={[styles.stepNumberText, { color: colors.accent }]}>
                  2
                </Text>
              </View>
              <Text
                style={[styles.helpStepText, { color: colors.mutedForeground }]}
              >
                Go to the Points tab and tap your team name
              </Text>
            </View>
            <View style={styles.helpStep}>
              <View
                style={[
                  styles.stepNumber,
                  { backgroundColor: colors.accent + "20" },
                ]}
              >
                <Text style={[styles.stepNumberText, { color: colors.accent }]}>
                  3
                </Text>
              </View>
              <Text
                style={[styles.helpStepText, { color: colors.mutedForeground }]}
              >
                The number in the URL is your Manager ID
              </Text>
            </View>
          </View>
          <Text style={[styles.helpExample, { color: colors.mutedForeground }]}>
            fantasy.premierleague.com/entry/
            <Text style={{ color: colors.accent, fontFamily: "Inter_700Bold" }}>
              13042160
            </Text>
            /event/1
          </Text>
        </View>
      </View>

      <View style={styles.bottomButtons}>
        <Pressable
          onPress={() => setPrivacyAccepted(!privacyAccepted)}
          style={styles.checkboxRow}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: privacyAccepted ? colors.accent : colors.mutedForeground,
                backgroundColor: privacyAccepted ? colors.accent : "transparent",
              },
            ]}
          >
            {privacyAccepted && (
              <Feather name="check" size={14} color={colors.primary} />
            )}
          </View>
          <Text style={[styles.checkboxText, { color: colors.mutedForeground }]}>
            I agree to the{" "}
            <Text
              style={{ color: colors.accent, textDecorationLine: "underline" }}
              onPress={() => Linking.openURL("https://superscout.pro/privacy")}
            >
              Privacy Policy
            </Text>
            {" "}and{" "}
            <Text
              style={{ color: colors.accent, textDecorationLine: "underline" }}
              onPress={() => Linking.openURL("https://superscout.pro/terms")}
            >
              Terms of Service
            </Text>
          </Text>
        </Pressable>

        {teamName && validatedId && (
          <Pressable
            onPress={() => {
              supabase
                .from("consent_events")
                .insert({ consent_type: "privacy_accepted", consent_given: true })
                .then(() => {})
                .catch(() => {});
              onNext(validatedId, teamName);
            }}
            disabled={!privacyAccepted}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: privacyAccepted ? colors.primary : colors.muted,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text
              style={[styles.buttonText, { color: privacyAccepted ? colors.primaryForeground : colors.mutedForeground }]}
            >
              That's my team
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            if (privacyAccepted) {
              supabase
                .from("consent_events")
                .insert({ consent_type: "privacy_accepted", consent_given: true })
                .then(() => {})
                .catch(() => {});
            }
            onNext(null, null);
          }}
          disabled={!privacyAccepted}
        >
          <Text style={[styles.skipText, { color: privacyAccepted ? colors.mutedForeground : colors.muted }]}>
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
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
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
  },
  confirmId: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  helpCard: {
    padding: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  helpTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
  },
  helpSteps: {
    gap: 10,
    marginBottom: 12,
  },
  helpStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  helpStepText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 20,
  },
  helpExample: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
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
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    flex: 1,
  },
});
