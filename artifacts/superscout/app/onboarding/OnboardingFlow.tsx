import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";

import WelcomeScreen from "./WelcomeScreen";
import ConnectFPLScreen from "./ConnectFPLScreen";
import ChooseVibeScreen from "./ChooseVibeScreen";
import SignUpScreen from "./SignUpScreen";
import BeginnerCheckScreen from "./BeginnerCheckScreen";
import WhatWeDoScreen from "./WhatWeDoScreen";
import YoureInScreen from "./YoureInScreen";

import { MANAGER_ID_KEY, TEAM_NAME_KEY } from "@/hooks/useManagerId";

const ONBOARDING_COMPLETE_KEY = "superscout_onboarding_complete";
const PERSONA_KEY = "superscout_persona";
const BEGINNER_KEY = "superscout_is_beginner";

interface Props {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [managerId, setManagerId] = useState<number | null>(null);
  const [vibe, setVibe] = useState<"expert" | "critic" | "fanboy" | null>(null);
  const [isBeginner, setIsBeginner] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const handleFPLConnect = (id: number | null, name: string | null) => {
    if (id && name) {
      setTeamName(name);
      setManagerId(id);
      AsyncStorage.setItem(MANAGER_ID_KEY, String(id)).catch(() => {});
      AsyncStorage.setItem(TEAM_NAME_KEY, name).catch(() => {});
    }
    setStep(2);
  };

  const handleVibeSelect = (v: "expert" | "critic" | "fanboy") => {
    setVibe(v);
    AsyncStorage.setItem(PERSONA_KEY, v).catch(() => {});
    setStep(3);
  };

  const handleSignUpComplete = (userId: string) => {
    setAuthUserId(userId);
    setStep(4);
  };

  const handleSignInSkipToMain = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    } catch {}
    onComplete();
  };

  const handleBeginnerCheck = (beginner: boolean) => {
    setIsBeginner(beginner);
    AsyncStorage.setItem(BEGINNER_KEY, beginner ? "true" : "false").catch(() => {});
    if (beginner) {
      AsyncStorage.setItem("superscout_beginner_rounds", "0").catch(() => {});
      AsyncStorage.setItem("superscout_beginner_lessons", "").catch(() => {});
    }
    setStep(5);
  };

  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    } catch {
      console.error("[Onboarding] Failed to save completion state to AsyncStorage");
    }

    try {
      const { getAuthenticatedUserId } = await import("@/services/auth");
      const userId = await getAuthenticatedUserId();
      if (userId) {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const apiBase = `https://${domain}/api`;
        await fetch(`${apiBase}/users/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            onboarding_completed: true,
            is_beginner: isBeginner,
            default_persona: vibe || undefined,
            fpl_manager_id: managerId ? String(managerId) : undefined,
            beginner_rounds_completed: isBeginner ? 0 : undefined,
            beginner_lessons_seen: isBeginner ? "" : undefined,
          }),
        });
      }
    } catch {
      console.error("[Onboarding] Failed to update user profile via API");
    }

    onComplete();
  };

  return (
    <View style={styles.container}>
      {step === 0 && <WelcomeScreen onNext={() => setStep(1)} />}
      {step === 1 && <ConnectFPLScreen onNext={handleFPLConnect} />}
      {step === 2 && <ChooseVibeScreen onNext={handleVibeSelect} />}
      {step === 3 && (
        <SignUpScreen
          managerId={managerId}
          vibe={vibe}
          onSignUpComplete={handleSignUpComplete}
          onSkipToMain={handleSignInSkipToMain}
        />
      )}
      {step === 4 && <BeginnerCheckScreen onNext={handleBeginnerCheck} />}
      {step === 5 && <WhatWeDoScreen onNext={() => setStep(6)} />}
      {step === 6 && (
        <YoureInScreen teamName={teamName} onFinish={handleFinish} />
      )}
    </View>
  );
}

export { ONBOARDING_COMPLETE_KEY };

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
