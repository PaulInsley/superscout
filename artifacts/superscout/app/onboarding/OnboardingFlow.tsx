import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet } from "react-native";

import WelcomeScreen from "./WelcomeScreen";
import ConnectFPLScreen from "./ConnectFPLScreen";
import VibeQuizScreen from "./VibeQuizScreen";
import ChooseVibeScreen from "./ChooseVibeScreen";
import SignUpScreen from "./SignUpScreen";
import BeginnerCheckScreen from "./BeginnerCheckScreen";
import YoureInScreen from "./YoureInScreen";

import { MANAGER_ID_KEY, TEAM_NAME_KEY } from "@/hooks/useManagerId";
import { fetchCaptainCandidates } from "@/services/fpl/api";
import type { CaptainRecommendation } from "@/services/fpl/types";

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

  const [prefetchedRecs, setPrefetchedRecs] = useState<CaptainRecommendation[] | null>(null);
  const [prefetchLoading, setPrefetchLoading] = useState(false);
  const [prefetchError, setPrefetchError] = useState(false);
  const prefetchStartedRef = useRef(false);

  useEffect(() => {
    if (step !== 3 || !managerId || !vibe || prefetchStartedRef.current) return;
    prefetchStartedRef.current = true;
    setPrefetchLoading(true);
    setPrefetchError(false);

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 20000);

    (async () => {
      try {
        const result = await fetchCaptainCandidates(managerId);
        if (controller.signal.aborted) return;
        if (!result.candidates.length) throw new Error("No candidates available");

        const persona = vibe || "expert";
        const squadSummary = result.candidates
          .map(
            (c) =>
              `- ${c.name} (${c.position}, ${c.team}) | Pos: ${c.pickPosition}${c.isBench ? " [BENCH]" : ""} | Form: ${c.form} | Total Pts: ${c.totalPoints} | Ownership: ${c.ownershipPct}% | Price: £${c.price}m | vs ${c.opponent} | FDR: ${c.fixtureDifficulty} | Status: ${c.status}${c.chanceOfPlaying !== null && c.chanceOfPlaying < 100 ? ` (${c.chanceOfPlaying}% chance)` : ""}`,
          )
          .join("\n");

        const context = `GAMEWEEK: ${result.gameweek}
DEADLINE: ${result.deadlineTime}
VIBE: ${persona}

SQUAD (15 players — positions 1-11 = starting XI, 12-15 = bench):
${squadSummary}

You are generating captain recommendations for this FPL manager. Analyse their squad and upcoming fixtures. Return exactly 3 captain options. For each option provide: the player name, their team, the opponent and whether it is home or away, an expected points estimate, a confidence level (one of: BANKER, CALCULATED_RISK, or BOLD_PUNT), the player's ownership percentage, one clear upside sentence, one clear risk sentence, a persona-voiced one-liner making the case for this pick, and whether this is the SuperScout Pick (exactly one must be true).

You MUST respond with valid JSON only — no markdown, no preamble, no backticks. Use this exact JSON structure:
{
  "gameweek": ${result.gameweek},
  "recommendations": [
    {
      "player_name": "Player Name",
      "team": "Team Short Name",
      "opponent": "OPP (H/A)",
      "expected_points": 8,
      "confidence": "BANKER",
      "ownership_pct": 50,
      "ownership_context": "One short sentence about what this ownership means for rank",
      "upside": "One sentence",
      "risk": "One sentence",
      "case": "Persona one-liner",
      "is_superscout_pick": true
    }
  ]
}`;

        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const apiBase = `https://${domain}/api`;

        const captainRes = await fetch(`${apiBase}/captain-picks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vibe: persona, context }),
          signal: controller.signal,
        });
        if (!captainRes.ok) throw new Error(`Captain HTTP ${captainRes.status}`);
        const data = await captainRes.json();
        if (controller.signal.aborted) return;

        const picks = data?.recommendations ?? data?.picks ?? [];
        if (picks.length > 0) {
          setPrefetchedRecs(picks);
        } else {
          setPrefetchError(true);
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          console.warn("[Onboarding] captain prefetch failed:", err);
          setPrefetchError(true);
        }
      } finally {
        clearTimeout(timeout);
        if (!controller.signal.aborted) {
          setPrefetchLoading(false);
        }
      }
    })();

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [step, managerId, vibe]);

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
      {step === 5 && (
        <YoureInScreen
          teamName={teamName}
          managerId={managerId}
          vibe={vibe}
          onFinish={handleFinish}
          prefetchedRecs={prefetchedRecs}
          prefetchLoading={prefetchLoading}
          prefetchError={prefetchError}
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
