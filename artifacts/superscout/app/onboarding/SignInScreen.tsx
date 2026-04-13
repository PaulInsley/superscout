import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { signIn, resetPassword } from "@/services/auth";

interface Props {
  onSignInSuccess: () => void;
  onGoToSignUp: () => void;
}

export default function SignInScreen({ onSignInSuccess, onGoToSignUp }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPassword = password.length >= 8;
  const canSubmit = isValidEmail && isValidPassword && !loading;

  const handleResetPassword = async () => {
    if (!isValidEmail || resetLoading) return;
    setResetLoading(true);
    setError(null);
    const result = await resetPassword(email.trim().toLowerCase());
    if (result.error) {
      setError(result.error);
      setResetLoading(false);
      return;
    }
    setResetSent(true);
    setResetLoading(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    const result = await signIn(email.trim().toLowerCase(), password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    if (result.userId) {
      onSignInSuccess();
      return;
    }

    setError("Something went wrong. Please try again.");
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          backgroundColor: colors.primary,
          paddingBottom: insets.bottom + 32,
          paddingTop: insets.top + 16,
        },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        {resetSent ? (
          <View style={styles.headerArea}>
            <Feather name="mail" size={48} color={colors.accent} />
            <Text style={[styles.title, { color: colors.primaryForeground }]}>
              Check your email
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              We sent a password reset link to {email.trim().toLowerCase()}.
              Tap the link to set a new password, then come back and sign in.
            </Text>
            <Pressable
              style={[styles.submitButton, { backgroundColor: colors.accent, marginTop: 24 }]}
              onPress={() => {
                setResetSent(false);
                setError(null);
                setPassword("");
              }}
            >
              <Text style={[styles.submitText, { color: colors.primary }]}>
                Back to Sign In
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.headerArea}>
              <Feather name="shield" size={40} color={colors.accent} />
              <Text style={[styles.title, { color: colors.primaryForeground }]}>
                Welcome back
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Sign in to access your saved data
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Email
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.card,
                      borderColor: email && !isValidEmail ? "#ef4444" : colors.border,
                    },
                  ]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Password
                </Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        color: colors.foreground,
                        backgroundColor: colors.card,
                        borderColor:
                          password && !isValidPassword ? "#ef4444" : colors.border,
                      },
                    ]}
                    placeholder="Min 8 characters"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                    editable={!loading}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    hitSlop={8}
                  >
                    <Feather
                      name={showPassword ? "eye-off" : "eye"}
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </View>
                {password.length > 0 && password.length < 8 && (
                  <Text style={styles.hint}>At least 8 characters</Text>
                )}
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Feather name="alert-circle" size={14} color="#ef4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Pressable
                style={[
                  styles.submitButton,
                  { backgroundColor: canSubmit ? colors.accent : colors.border },
                ]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    style={[
                      styles.submitText,
                      { color: canSubmit ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    Sign In
                  </Text>
                )}
              </Pressable>

              <Pressable onPress={handleResetPassword} disabled={resetLoading || !isValidEmail}>
                <Text style={[styles.forgotText, { color: isValidEmail ? colors.accent : colors.mutedForeground }]}>
                  {resetLoading ? "Sending..." : "Forgot password?"}
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={onGoToSignUp} style={styles.toggleRow}>
              <Text style={[styles.toggleText, { color: colors.mutedForeground }]}>
                {"Don't have an account? "}
              </Text>
              <Text style={[styles.toggleLink, { color: colors.accent }]}>
                Sign Up
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  headerArea: {
    alignItems: "center",
    marginBottom: 32,
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  passwordRow: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: "absolute",
    right: 14,
    top: 14,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#ef4444",
    marginLeft: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ef444420",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#ef4444",
    flex: 1,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  toggleLink: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  forgotText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 12,
  },
});
