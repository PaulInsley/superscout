import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";

import WelcomeScreen from "./WelcomeScreen";
import ConnectFPLScreen from "./ConnectFPLScreen";
import VibeQuizScreen from "./VibeQuizScreen";
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
      AsyncStorage.setItem(MANAGER_ID_KEY, String(id)).catch((err: unknown) =>
        console.warn("[Onboarding] manager ID save failed:", err),
      );
      AsyncStorage.setItem(TEAM_NAME_KEY, name).catch((err: unknown) =>
        console.warn("[Onboarding] team name save failed:", err),
      );
    }
    setStep(2);
  };

  const [quizResult, setQuizResult] = useState<"expert" | "critic" | "fanboy" | null>(null);

  const handleQuizComplete = (v: "expert" | "critic" | "fanboy") => {
    setVibe(v);
    AsyncStorage.setItem(PERSONA_KEY, v).catch((err: unknown) =>
      console.warn("[Onboarding] persona save failed:", err),
    );
    setStep(3);
  };

  const handleTryAll = (quizVibe: "expert" | "critic" | "fanboy") => {
    setQuizResult(quizVibe);
    setStep(2.5);
  };

  const handleVibeSelect = (v: "expert" | "critic" | "fanboy") => {
    setVibe(v);
    AsyncStorage.setItem(PERSONA_KEY, v).catch((err: unknown) =>
      console.warn("[Onboarding] persona save failed:", err),
    );
    setStep(3);
  };

  const handleSignUpComplete = (userId: string) => {
    setAuthUserId(userId);
    setStep(4);
  };

  const handleSignInSkipToMain = async () => {
    try {
      const { getAuthenticatedUserId, loadUserProfile } = await import("@/services/auth");
      const userId = await getAuthenticatedUserId();
      if (userId) {
        await loadUserProfile(userId);
      }
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    } catch (err) {
      console.warn("[Onboarding] sign-in skip to main failed:", err);
    }
    onComplete();
  };

  const handleBeginnerCheck = (beginner: boolean) => {
    setIsBeginner(beginner);
    AsyncStorage.setItem(BEGINNER_KEY, beginner ? "true" : "false").catch((err: unknown) =>
      console.warn("[Onboarding] beginner flag save failed:", err),
    );
    if (beginner) {
      AsyncStorage.setItem("superscout_beginner_rounds", "0").catch((err: unknown) =>
        console.warn("[Onboarding] beginner rounds save failed:", err),
      );
      AsyncStorage.setItem("superscout_beginner_lessons", "").catch((err: unknown) =>
        console.warn("[Onboarding] beginner lessons save failed:", err),
      );
    }
    setStep(5);
  };

  const handleFinish = () => {
    AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true").catch((err: unknown) =>
      console.warn("[Onboarding] completion flag save failed:", err),
    );

    import("@/services/auth")
      .then(({ getAuthenticatedUserId }) => getAuthenticatedUserId())
      .then((userId) => {
        if (!userId) return;
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const apiBase = `https://${domain}/api`;
        return fetch(`${apiBase}/users/profile`, {
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
      })
      .catch((err: unknown) => console.warn("[Onboarding] profile sync failed:", err));

    onComplete();
  };

  return (
    <View style={styles.container}>
      {step === 0 && <WelcomeScreen onNext={() => setStep(1)} />}
      {step === 1 && <ConnectFPLScreen onNext={handleFPLConnect} />}
      {step === 2 && <VibeQuizScreen onComplete={handleQuizComplete} onTryAll={handleTryAll} />}
      {step === 2.5 && <ChooseVibeScreen onNext={handleVibeSelect} />}
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
        <YoureInScreen
          teamName={teamName}
          managerId={managerId}
          vibe={vibe}
          onFinish={handleFinish}
        />
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
