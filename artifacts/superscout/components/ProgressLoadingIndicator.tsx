import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type Vibe = "expert" | "critic" | "fanboy";

const VIBE_NAMES: Record<Vibe, string> = {
  expert: "Expert",
  critic: "Sarcastic Critic",
  fanboy: "Fanboy",
};

const STAGE_MESSAGES: Record<string, Record<Vibe, string>> = {
  squad: {
    expert: "Pulling your latest squad data from the FPL servers...",
    critic: "Let's have a look at what you're working with...",
    fanboy: "LOADING YOUR SQUAD — let's see the TEAM!!",
  },
  analyse_fixtures: {
    expert: "Analysing fixture difficulty ratings...",
    critic: "Finding the weak links in your squad...",
    fanboy: "SCANNING FOR ABSOLUTE BARGAINS...",
  },
  analyse_form: {
    expert: "Comparing expected points projections...",
    critic: "Checking which of your picks are actually justified...",
    fanboy: "Looking for your next GAME-CHANGER...",
  },
  analyse_differentials: {
    expert: "Evaluating ownership differentials...",
    critic: "Preparing some uncomfortable truths...",
    fanboy: "Getting HYPED about your options...",
  },
  market: {
    expert: "Scanning 500+ players, filtering by form and fixtures...",
    critic: "Trawling through every available player. You're welcome.",
    fanboy: "Scanning the ENTIRE transfer market for GEMS!! 🔥",
  },
  rules: {
    expert: "Validating budget constraints and squad rules...",
    critic: "Checking you haven't already blown the budget...",
    fanboy: "Making sure everything is LEGIT and WITHIN BUDGET!!",
  },
  ai: {
    expert: "Running multi-factor analysis across your options...",
    critic: "Thinking. Something you should try more often...",
    fanboy: "Your analyst is COOKING something SPECIAL!! 🚀",
  },
  ai_deep: {
    expert: "Evaluating fixture swings and ownership differentials...",
    critic: "Still thinking. Good things take time. Usually.",
    fanboy: "ALMOST THERE — the HYPE is BUILDING!!",
  },
  validating: {
    expert: "Cross-checking recommendations against FPL rules...",
    critic: "Making sure the AI didn't suggest anything ridiculous...",
    fanboy: "Running the FINAL CHECKS — nearly DONE!!",
  },
  done: {
    expert: "Analysis complete.",
    critic: "Right. Here's what I've got.",
    fanboy: "DONE!! Let's GO!!",
  },
  leagues: {
    expert: "Fetching your mini-league standings...",
    critic: "Let's see who you're up against...",
    fanboy: "LOADING THE LEAGUE TABLE — time for BANTER!!",
  },
  rivals: {
    expert: "Identifying your closest rivals...",
    critic: "Finding someone worth mocking...",
    fanboy: "SCOUTING YOUR RIVALS' SQUADS!!",
  },
  squads: {
    expert: "Comparing squad compositions and differentials...",
    critic: "Examining their questionable life choices...",
    fanboy: "Spotting the KEY DIFFERENCES!!",
  },
  banter_ai: {
    expert: "Crafting your banter cards...",
    critic: "Preparing some absolute devastation...",
    fanboy: "Your analyst is COOKING up some HEAT!! 🔥",
  },
  banter_done: {
    expert: "Banter cards ready.",
    critic: "Ammunition loaded.",
    fanboy: "BANTER LOCKED AND LOADED!! 🚀",
  },
};

export interface ProgressStage {
  key: string;
  label: string;
  targetPercent: number;
}

const TRANSFER_STAGES: ProgressStage[] = [
  { key: "squad", label: "Loading your squad", targetPercent: 10 },
  { key: "analyse_fixtures", label: "Analysing fixtures", targetPercent: 25 },
  { key: "analyse_form", label: "Evaluating form", targetPercent: 40 },
  { key: "analyse_differentials", label: "Checking differentials", targetPercent: 55 },
  { key: "market", label: "Scanning the transfer market", targetPercent: 65 },
  { key: "rules", label: "Checking rules and budget", targetPercent: 75 },
  { key: "ai", label: "Analysing options", targetPercent: 85 },
  { key: "ai_deep", label: "Analysing options", targetPercent: 92 },
  { key: "validating", label: "Validating recommendations", targetPercent: 97 },
  { key: "done", label: "Done!", targetPercent: 100 },
];

const CAPTAIN_STAGES: ProgressStage[] = [
  { key: "squad", label: "Loading your squad", targetPercent: 15 },
  { key: "analyse_fixtures", label: "Analysing fixtures", targetPercent: 35 },
  { key: "analyse_form", label: "Evaluating form", targetPercent: 55 },
  { key: "analyse_differentials", label: "Checking differentials", targetPercent: 70 },
  { key: "ai", label: "Analysing options", targetPercent: 85 },
  { key: "ai_deep", label: "Analysing options", targetPercent: 92 },
  { key: "validating", label: "Ranking captain picks", targetPercent: 97 },
  { key: "done", label: "Done!", targetPercent: 100 },
];

const BANTER_STAGES: ProgressStage[] = [
  { key: "leagues", label: "Loading leagues", targetPercent: 15 },
  { key: "rivals", label: "Finding rivals", targetPercent: 35 },
  { key: "squads", label: "Comparing squads", targetPercent: 55 },
  { key: "banter_ai", label: "Generating banter", targetPercent: 85 },
  { key: "banter_done", label: "Done!", targetPercent: 100 },
];

interface Props {
  vibe: Vibe;
  currentStage: string;
  variant?: "transfer" | "captain" | "banter";
}

export default function ProgressLoadingIndicator({
  vibe,
  currentStage,
  variant = "transfer",
}: Props) {
  const colors = useColors();
  const stages =
    variant === "banter" ? BANTER_STAGES : variant === "captain" ? CAPTAIN_STAGES : TRANSFER_STAGES;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const widthAnim = useRef(new Animated.Value(0)).current;
  const [prevStage, setPrevStage] = useState(currentStage);

  const currentStageIndex = stages.findIndex((s) => s.key === currentStage);
  const stageObj = stages[currentStageIndex] ?? stages[0];
  const targetPercent = stageObj.targetPercent;

  useEffect(() => {
    const isAiStage = currentStage === "ai" || currentStage === "ai_deep";
    const duration = isAiStage ? 15000 : 800;

    Animated.timing(widthAnim, {
      toValue: targetPercent,
      duration,
      useNativeDriver: false,
    }).start();
  }, [targetPercent, currentStage]);

  useEffect(() => {
    if (currentStage !== prevStage) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
      setPrevStage(currentStage);
    }
  }, [currentStage, prevStage]);

  const stageMessage = STAGE_MESSAGES[currentStage]?.[vibe] ?? STAGE_MESSAGES.ai[vibe];

  const vibeName = VIBE_NAMES[vibe];
  const stageLabel =
    currentStage === "ai" || currentStage === "ai_deep"
      ? `Your ${vibeName} is analysing options...`
      : stageObj.label;

  const barWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>
      <View style={styles.stageRow}>
        <Text style={[styles.stageLabel, { color: colors.foreground }]}>{stageLabel}</Text>
      </View>

      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[styles.barFill, { backgroundColor: colors.accent, width: barWidth }]}
        />
      </View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={[styles.vibeMessage, { color: colors.mutedForeground }]}>{stageMessage}</Text>
      </Animated.View>
    </View>
  );
}

export { TRANSFER_STAGES, CAPTAIN_STAGES, BANTER_STAGES };

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    paddingHorizontal: 8,
    gap: 16,
    alignItems: "center",
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stageLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  barTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  vibeMessage: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    minHeight: 20,
    paddingHorizontal: 8,
  },
});
