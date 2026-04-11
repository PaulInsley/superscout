import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import { View, StyleSheet } from "react-native";

import { supabase } from "@/services/supabase";
import WelcomeScreen from "./WelcomeScreen";
import ConnectFPLScreen from "./ConnectFPLScreen";
import ChooseVibeScreen from "./ChooseVibeScreen";
import WhatWeDoScreen from "./WhatWeDoScreen";
import YoureInScreen from "./YoureInScreen";

import { MANAGER_ID_KEY, TEAM_NAME_KEY } from "@/hooks/useManagerId";

const ONBOARDING_COMPLETE_KEY = "superscout_onboarding_complete";
const PERSONA_KEY = "superscout_persona";

interface Props {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [managerId, setManagerId] = useState<number | null>(null);
  const [vibe, setVibe] = useState<"expert" | "critic" | "fanboy" | null>(null);

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

  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    } catch {
      console.error("[Onboarding] Failed to save completion state to AsyncStorage");
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const updates: Record<string, unknown> = {
          onboarding_completed: true,
        };
        if (vibe) updates.default_persona = vibe;
        if (managerId) updates.fpl_manager_id = String(managerId);

        await supabase
          .from("users")
          .update(updates)
          .eq("id", user.id);
      }
    } catch {
      console.error("[Onboarding] Failed to update Supabase user — auth not yet configured");
    }

    onComplete();
  };

  return (
    <View style={styles.container}>
      {step === 0 && <WelcomeScreen onNext={() => setStep(1)} />}
      {step === 1 && <ConnectFPLScreen onNext={handleFPLConnect} />}
      {step === 2 && <ChooseVibeScreen onNext={handleVibeSelect} />}
      {step === 3 && <WhatWeDoScreen onNext={() => setStep(4)} />}
      {step === 4 && (
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
