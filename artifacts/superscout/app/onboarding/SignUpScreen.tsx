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
import { signUp, signIn, resetPassword } from "@/services/auth";

function getApiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return `https://${domain}/api`;
}

interface Props {
  managerId: number | null;
  vibe: string | null;
  onSignUpComplete: (userId: string) => void;
  onSkipToMain: () => void;
}

export default function SignUpScreen({ managerId, vibe, onSignUpComplete, onSkipToMain }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [isSignIn, setIsSignIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPassword = password.length >= 8;
  const canSubmit = isValidEmail && isValidPassword && !loading && (isSignIn || ageConfirmed);

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

    if (isSignIn) {
      const result = await signIn(email.trim().toLowerCase(), password);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      if (result.userId) {
        onSkipToMain();
        return;
      }
    } else {
      const result = await signUp(email.trim().toLowerCase(), password);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      if (result.userId) {
        try {
          const apiBase = getApiBaseUrl();
          const profileRes = await fetch(`${apiBase}/users/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: result.userId,
              email: email.trim().toLowerCase(),
              fpl_manager_id: managerId ? String(managerId) : undefined,
              default_persona: vibe || undefined,
            }),
          });
          if (!profileRes.ok) {
            const errData = await profileRes.json().catch(() => ({}));
            console.error("[SuperScout] User profile creation failed:", errData.error);
          }
        } catch (e: any) {
          console.error("[SuperScout] User profile request failed:", e?.message);
        }

        if (result.needsVerification) {
          setVerificationSent(true);
          setLoading(false);
          return;
        }

        onSignUpComplete(result.userId);
        return;
      }
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
        {verificationSent || resetSent ? (
          <View style={styles.headerArea}>
            <Feather name="mail" size={48} color={colors.accent} />
            <Text style={[styles.title, { color: colors.primaryForeground }]}>
              Check your email
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {resetSent
                ? `We sent a password reset link to ${email.trim().toLowerCase()}. Tap the link to set a new password, then come back and sign in.`
                : `We sent a verification link to ${email.trim().toLowerCase()}. Tap the link, then come back and sign in.`}
            </Text>
            <Pressable
              style={[styles.submitButton, { backgroundColor: colors.accent, marginTop: 24 }]}
              onPress={() => {
                setVerificationSent(false);
                setResetSent(false);
                setIsSignIn(true);
                setError(null);
                setPassword("");
              }}
              accessibilityLabel="Sign in"
              accessibilityRole="button"
            >
              <Text style={[styles.submitText, { color: colors.primary }]}>Sign In</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.headerArea}>
              <Feather name="shield" size={40} color={colors.accent} />
              <Text style={[styles.title, { color: colors.primaryForeground }]}>
                {isSignIn ? "Welcome back" : "Create your account"}
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {isSignIn
                  ? "Sign in to access your saved data"
                  : "Your decisions, streaks, and reports stay with you"}
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
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
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        color: colors.foreground,
                        backgroundColor: colors.card,
                        borderColor: password && !isValidPassword ? "#ef4444" : colors.border,
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
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    accessibilityRole="button"
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

              {!isSignIn && (
                <Pressable
                  onPress={() => setAgeConfirmed(!ageConfirmed)}
                  style={styles.ageRow}
                  accessibilityLabel="Confirm age 13 or older"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ageConfirmed }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: ageConfirmed ? colors.accent : colors.border,
                        backgroundColor: ageConfirmed ? colors.accent : "transparent",
                      },
                    ]}
                  >
                    {ageConfirmed && <Feather name="check" size={14} color={colors.primary} />}
                  </View>
                  <Text style={[styles.ageText, { color: colors.mutedForeground }]}>
                    I confirm I am 13 years of age or older
                  </Text>
                </Pressable>
              )}

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
                accessibilityLabel={isSignIn ? "Sign in" : "Create account"}
                accessibilityRole="button"
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
                    {isSignIn ? "Sign In" : "Create Account"}
                  </Text>
                )}
              </Pressable>

              {isSignIn && (
                <Pressable onPress={handleResetPassword} disabled={resetLoading || !isValidEmail} accessibilityLabel="Forgot password" accessibilityRole="button">
                  <Text
                    style={[
                      styles.forgotText,
                      { color: isValidEmail ? colors.accent : colors.mutedForeground },
                    ]}
                  >
                    {resetLoading ? "Sending..." : "Forgot password?"}
                  </Text>
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={() => {
                setIsSignIn(!isSignIn);
                setError(null);
              }}
              style={styles.toggleRow}
              accessibilityLabel={isSignIn ? "Switch to sign up" : "Switch to sign in"}
              accessibilityRole="button"
            >
              <Text style={[styles.toggleText, { color: colors.mutedForeground }]}>
                {isSignIn ? "Don't have an account? " : "Already have an account? "}
              </Text>
              <Text style={[styles.toggleLink, { color: colors.accent }]}>
                {isSignIn ? "Sign Up" : "Sign In"}
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
  ageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ageText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
});
