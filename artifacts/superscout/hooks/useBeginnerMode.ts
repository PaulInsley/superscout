import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthenticatedUserId } from "@/services/auth";
import type { LessonKey } from "@/lib/coachingLessons";

const BEGINNER_KEY = "superscout_is_beginner";
const ROUNDS_KEY = "superscout_beginner_rounds";
const LESSONS_KEY = "superscout_beginner_lessons";

interface BeginnerState {
  isBeginner: boolean;
  roundsCompleted: number;
  lessonsSeen: LessonKey[];
  loading: boolean;
}

export function useBeginnerMode() {
  const [state, setState] = useState<BeginnerState>({
    isBeginner: false,
    roundsCompleted: 0,
    lessonsSeen: [],
    loading: true,
  });

  useEffect(() => {
    loadState();
  }, []);

  const loadState = async () => {
    try {
      const [beginner, rounds, lessons] = await AsyncStorage.multiGet([
        BEGINNER_KEY,
        ROUNDS_KEY,
        LESSONS_KEY,
      ]);

      const isBeginner = beginner[1] === "true";
      const roundsCompleted = parseInt(rounds[1] ?? "0", 10) || 0;
      const lessonsSeen = lessons[1]
        ? (lessons[1].split(",").filter(Boolean) as LessonKey[])
        : [];

      setState({ isBeginner, roundsCompleted, lessonsSeen, loading: false });
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const setBeginnerFlag = useCallback(async (value: boolean) => {
    await AsyncStorage.setItem(BEGINNER_KEY, value ? "true" : "false");
    if (value) {
      await AsyncStorage.setItem(ROUNDS_KEY, "0");
      await AsyncStorage.setItem(LESSONS_KEY, "");
      setState({
        isBeginner: true,
        roundsCompleted: 0,
        lessonsSeen: [],
        loading: false,
      });
    } else {
      setState((prev) => ({ ...prev, isBeginner: false }));
    }

    try {
      const userId = await getAuthenticatedUserId();
      if (userId) {
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        await fetch(`https://${domain}/api/users/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            is_beginner: value,
            ...(value ? { beginner_rounds_completed: 0, beginner_lessons_seen: "" } : {}),
          }),
        });
      }
    } catch {}
  }, []);

  const dismissLesson = useCallback(
    async (lessonKey: LessonKey) => {
      const newLessons = [...state.lessonsSeen, lessonKey];
      const newRounds = state.roundsCompleted + 1;
      const isGraduating = newRounds >= 4;

      await AsyncStorage.setItem(ROUNDS_KEY, String(newRounds));
      await AsyncStorage.setItem(LESSONS_KEY, newLessons.join(","));

      setState((prev) => ({
        ...prev,
        roundsCompleted: newRounds,
        lessonsSeen: newLessons,
        isBeginner: !isGraduating ? prev.isBeginner : prev.isBeginner,
      }));

      try {
        const userId = await getAuthenticatedUserId();
        if (userId) {
          const domain = process.env.EXPO_PUBLIC_DOMAIN;
          await fetch(`https://${domain}/api/users/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId,
              beginner_rounds_completed: newRounds,
              beginner_lessons_seen: newLessons.join(","),
            }),
          });
        }
      } catch {}

      return isGraduating;
    },
    [state.lessonsSeen, state.roundsCompleted],
  );

  const graduate = useCallback(async () => {
    await AsyncStorage.setItem(BEGINNER_KEY, "false");
    setState((prev) => ({ ...prev, isBeginner: false }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("users")
          .update({ is_beginner: false })
          .eq("id", user.id);
      }
    } catch {}
  }, []);

  const resetCoaching = useCallback(async () => {
    await AsyncStorage.setItem(BEGINNER_KEY, "true");
    await AsyncStorage.setItem(ROUNDS_KEY, "0");
    await AsyncStorage.setItem(LESSONS_KEY, "");
    setState({
      isBeginner: true,
      roundsCompleted: 0,
      lessonsSeen: [],
      loading: false,
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("users")
          .update({
            is_beginner: true,
            beginner_rounds_completed: 0,
            beginner_lessons_seen: "",
          })
          .eq("id", user.id);
      }
    } catch {}
  }, []);

  const getNextLesson = useCallback(
    (screen: "captain" | "transfers") => {
      if (!state.isBeginner || state.roundsCompleted >= 4) return null;

      const { COACHING_LESSONS } = require("@/lib/coachingLessons");
      const seen = state.lessonsSeen;

      for (const lesson of COACHING_LESSONS) {
        if (seen.includes(lesson.key)) continue;

        if (lesson.key === "captain" && screen === "captain") return lesson;
        if (lesson.key === "transfers" && screen === "transfers") return lesson;

        if (lesson.key === "fixtures") {
          if (seen.includes("captain") && seen.includes("transfers")) {
            if (lesson.screen === "either" || lesson.screen === screen) return lesson;
          }
        }

        if (lesson.key === "ownership") {
          if (seen.includes("captain") && seen.includes("transfers") && seen.includes("fixtures")) {
            if (lesson.screen === "either" || lesson.screen === screen) return lesson;
          }
        }
      }

      return null;
    },
    [state.isBeginner, state.roundsCompleted, state.lessonsSeen],
  );

  return {
    ...state,
    setBeginnerFlag,
    dismissLesson,
    graduate,
    resetCoaching,
    getNextLesson,
  };
}
