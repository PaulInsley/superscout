import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import ChoiceCard from "@/components/ChoiceCard";
import ProgressLoadingIndicator from "@/components/ProgressLoadingIndicator";
import type { CaptainRecommendation } from "@/services/fpl/types";

type Vibe = "expert" | "critic" | "fanboy";

interface Props {
  teamName: string | null;
  managerId: number | null;
  vibe: Vibe | null;
  onFinish: () => void;
  prefetchedRecs: CaptainRecommendation[] | null;
  prefetchLoading: boolean;
  prefetchError: boolean;
}

const FALLBACK_MESSAGES: Record<Vibe, string> = {
  expert:
    "Your squad data is loaded and ready. Head to Captain Picks for a full analysis of your best options this gameweek.",
  critic:
    "Couldn't get your first pick ready in time — not ideal, but don't worry. Your Captain Picks are waiting inside. Try not to overthink it.",
  fanboy:
    "We couldn't load your first pick just yet, but your Captain Picks are READY AND WAITING inside!! Let's GO!!",
};

const LOADING_STAGES: Record<Vibe, string> = {
  expert: "Analysing your squad and fixtures...",
  critic: "Having a look at what you're working with...",
  fanboy: "SCANNING YOUR SQUAD — this is going to be GOOD!!",
};

export default function YoureInScreen({
  teamName,
  managerId,
  vibe,
  onFinish,
  prefetchedRecs,
  prefetchLoading,
  prefetchError,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const effectiveVibe: Vibe = vibe || "expert";

  const [loadingStage, setLoadingStage] = useState<string>("squad");
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!prefetchLoading) {
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
      return;
    }

    setLoadingStage("squad");
    stageTimerRef.current = setTimeout(() => {
      setLoadingStage("analyse_fixtures");
      stageTimerRef.current = setTimeout(() => {
        setLoadingStage("analyse_form");
        stageTimerRef.current = setTimeout(() => {
          setLoadingStage("analyse_differentials");
          stageTimerRef.current = setTimeout(() => {
            setLoadingStage("ai");
            stageTimerRef.current = setTimeout(() => {
              setLoadingStage("ai_deep");
            }, 8000);
          }, 1200);
        }, 800);
      }, 700);
    }, 600);

    return () => {
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current);
    };
  }, [prefetchLoading]);

  const hasRecs = prefetchedRecs && prefetchedRecs.length > 0;
  const showFallback = prefetchError || (!prefetchLoading && !hasRecs);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            {hasRecs
              ? "Your first captain pick"
              : prefetchLoading
                ? teamName || "Analysing your squad"
                : teamName || "You're all set"}
          </Text>
          <Text style={[styles.subtext, { color: colors.mutedForeground }]}>
            {hasRecs
              ? "Here's what SuperScout thinks about your captain options this gameweek."
              : prefetchLoading
                ? LOADING_STAGES[effectiveVibe]
                : showFallback
                  ? FALLBACK_MESSAGES[effectiveVibe]
                  : ""}
          </Text>
        </View>

        {prefetchLoading && (
          <ProgressLoadingIndicator
            vibe={effectiveVibe}
            currentStage={loadingStage}
            variant="captain"
          />
        )}

        {hasRecs && (
          <View style={styles.cardsContainer}>
            {prefetchedRecs!.map((rec) => (
              <ChoiceCard
                key={rec.player_name}
                recommendation={rec}
                isBeginner={false}
                vibe={effectiveVibe}
              />
            ))}
          </View>
        )}

        {showFallback && (
          <View style={styles.fallbackContainer}>
            <View style={[styles.fallbackCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="zap" size={32} color={colors.accent} />
              <Text style={[styles.fallbackTitle, { color: colors.foreground }]}>
                Captain Picks ready inside
              </Text>
              <Text style={[styles.fallbackBody, { color: colors.mutedForeground }]}>
                Your full analysis with 3 ranked options is waiting on the Captain Picker tab.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Pressable
          onPress={onFinish}
          accessibilityLabel={hasRecs ? "Let's go" : "Go to Captain Picks"}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: colors.primary }]}>
            {hasRecs ? "Let's go" : "Go to Captain Picks"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
    gap: 8,
  },
  heading: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  subtext: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  cardsContainer: {
    gap: 4,
  },
  fallbackContainer: {
    marginTop: 16,
  },
  fallbackCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  fallbackTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  fallbackBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  button: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
});
