import React, { useState, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Vibe = "expert" | "critic" | "fanboy";

interface QuizQuestion {
  question: string;
  options: { label: string; vibe: Vibe }[];
}

const QUESTIONS: QuizQuestion[] = [
  {
    question: "Your captain blanks on 2 points. What do you want to hear?",
    options: [
      { label: "Here's why the data still supported that pick", vibe: "expert" },
      { label: "I told you that was a terrible idea", vibe: "critic" },
      { label: "Forget that — look at this differential for next week!", vibe: "fanboy" },
    ],
  },
  {
    question: "It's 2 hours before the deadline. You have one free transfer. What's your style?",
    options: [
      { label: "Show me the xG data and let me decide", vibe: "expert" },
      { label: "Tell me who NOT to pick — I'll figure out the rest", vibe: "critic" },
      { label: "Who's the exciting punt this week?", vibe: "fanboy" },
    ],
  },
  {
    question: "You just had your best ever gameweek. What do you want?",
    options: [
      { label: "A breakdown of which decisions drove the score", vibe: "expert" },
      { label: "Yeah but here's why you'll probably mess it up next week", vibe: "critic" },
      { label: "LET'S GOOO! Now let's push for top 10k!", vibe: "fanboy" },
    ],
  },
];

const VIBE_DETAILS: Record<Vibe, { name: string; emoji: string; preview: string }> = {
  expert: {
    name: "The Expert",
    emoji: "📊",
    preview: "Measured, data-driven, always weighing the probabilities.",
  },
  critic: {
    name: "The Sarcastic Critic",
    emoji: "🎭",
    preview: "Sharp, honest, not afraid to tell you when you're wrong.",
  },
  fanboy: {
    name: "The OTT Fanboy",
    emoji: "🔥",
    preview: "Passionate, excitable, lives for the big differential pick.",
  },
};

interface Props {
  onComplete: (vibe: Vibe) => void;
  onTryAll: (quizResult: Vibe) => void;
}

export default function VibeQuizScreen({ onComplete, onTryAll }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Vibe[]>([]);
  const [result, setResult] = useState<Vibe | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const animateTransition = (callback: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      callback();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const calculateResult = (allAnswers: Vibe[]): Vibe => {
    const counts: Record<Vibe, number> = { expert: 0, critic: 0, fanboy: 0 };
    allAnswers.forEach((v) => counts[v]++);
    if (counts.expert === counts.critic && counts.critic === counts.fanboy) return "expert";
    return (Object.entries(counts) as [Vibe, number][]).sort((a, b) => b[1] - a[1])[0][0];
  };

  const handleAnswer = (vibe: Vibe) => {
    const newAnswers = [...answers, vibe];
    setAnswers(newAnswers);

    if (questionIndex < QUESTIONS.length - 1) {
      animateTransition(() => setQuestionIndex(questionIndex + 1));
    } else {
      const winningVibe = calculateResult(newAnswers);
      animateTransition(() => {
        setResult(winningVibe);
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  if (result) {
    const details = VIBE_DETAILS[result];
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + 40 },
        ]}
      >
        <Animated.View style={[styles.revealContent, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.revealEmoji}>{details.emoji}</Text>
          <Text style={[styles.revealTitle, { color: colors.foreground }]}>
            You're {details.name}
          </Text>
          <Text style={[styles.revealPreview, { color: colors.mutedForeground }]}>
            {details.preview}
          </Text>
          <Text style={[styles.changeAnytime, { color: colors.mutedForeground }]}>
            You can change this anytime in Settings
          </Text>
        </Animated.View>

        <View style={[styles.revealButtons, { paddingBottom: insets.bottom + 24 }]}>
          <Pressable
            onPress={() => onTryAll(result)}
            accessibilityLabel="Try all three vibes"
            accessibilityRole="button"
            style={[
              styles.tryAllButton,
              { borderColor: colors.primary, borderRadius: colors.radius },
            ]}
          >
            <Feather name="repeat" size={16} color={colors.primary} />
            <Text style={[styles.tryAllText, { color: colors.primary }]}>Try all three</Text>
          </Pressable>

          <Pressable
            onPress={() => onComplete(result)}
            accessibilityLabel={`Continue with ${details.name}`}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.continueButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
                borderRadius: 14,
              },
            ]}
          >
            <Text style={[styles.continueText, { color: colors.primaryForeground }]}>
              Continue with {details.name}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const currentQuestion = QUESTIONS[questionIndex];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 40 },
      ]}
    >
      <View style={styles.progressRow}>
        {QUESTIONS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              {
                backgroundColor: i <= questionIndex ? colors.primary : colors.border,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
        {questionIndex + 1} of {QUESTIONS.length}
      </Text>

      <Animated.View style={[styles.questionContent, { opacity: fadeAnim }]}>
        <Text style={[styles.questionText, { color: colors.foreground }]}>
          {currentQuestion.question}
        </Text>

        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option, i) => (
            <Pressable
              key={i}
              onPress={() => handleAnswer(option.vibe)}
              accessibilityLabel={option.label}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.optionCard,
                {
                  backgroundColor: pressed ? colors.secondary : colors.card,
                  borderColor: pressed ? colors.primary : colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text style={[styles.optionText, { color: colors.foreground }]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginBottom: 32,
  },
  questionContent: {
    flex: 1,
  },
  questionText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    lineHeight: 30,
    marginBottom: 32,
  },
  optionsContainer: {
    gap: 14,
  },
  optionCard: {
    padding: 20,
    borderWidth: 2,
  },
  optionText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    lineHeight: 23,
  },
  revealContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  revealEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  revealTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  revealPreview: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: 16,
  },
  changeAnytime: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
  revealButtons: {
    gap: 12,
  },
  tryAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderWidth: 1.5,
  },
  tryAllText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  continueButton: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
});
