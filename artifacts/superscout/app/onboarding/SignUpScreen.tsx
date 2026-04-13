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
import { signUp, signIn } from "@/services/auth";

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

export default function SignUpScreen({
  managerId,
  vibe,
  onSignUpComplete,
  onSkipToMain,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [isSignIn, setIsSignIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPassword = password.length >= 8;
  const canSubmit = isValidEmail && isValidPassword && !loading;

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
        {verificationSent ? (
          <View style={styles.headerArea}>
            <Feather name="mail" size={48} color={colors.accent} />
            <Text style={[styles.title, { color: colors.primaryForeground }]}>
              Check your email
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              We sent a verification link to {email.trim().toLowerCase()}. Tap the link, then come back and sign in.
            </Text>
            <Pressable
              style={[styles.submitButton, { backgroundColor: colors.accent, marginTop: 24 }]}
              onPress={() => {
                setVerificationSent(false);
                setIsSignIn(true);
                setError(null);
                setPassword("");
              }}
            >
              <Text style={[styles.submitText, { color: colors.primary }]}>
                Sign In
              </Text>
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
                {isSignIn ? "Sign In" : "Create Account"}
              </Text>
            )}
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            setIsSignIn(!isSignIn);
            setError(null);
          }}
          style={styles.toggleRow}
        >
          <Text style={[styles.toggleText, { color: colors.mutedForeground }]}>
            {isSignIn
              ? "Don't have an account? "
              : "Already have an account? "}
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
});
