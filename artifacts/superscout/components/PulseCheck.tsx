import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/services/supabase";
import { getAuthenticatedUserId } from "@/services/auth";

const PULSE_STORAGE_PREFIX = "superscout_pulse_gw_";

const BEST_FEATURE_OPTIONS = [
  "Captain advice",
  "Transfer advice",
  "Vibe commentary",
  "Squad Card",
  "Streak",
  "Other",
] as const;

interface PulseCheckProps {
  gameweek: number;
  visible: boolean;
  onDismiss: () => void;
}

export default function PulseCheck({ gameweek, visible, onDismiss }: PulseCheckProps) {
  const [rating, setRating] = useState(0);
  const [bestFeature, setBestFeature] = useState<string | null>(null);
  const [frustration, setFrustration] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadyPulsed, setAlreadyPulsed] = useState(false);

  useEffect(() => {
    if (gameweek > 0) {
      AsyncStorage.getItem(`${PULSE_STORAGE_PREFIX}${gameweek}`).then((val) => {
        if (val === "done") setAlreadyPulsed(true);
      });
    }
  }, [gameweek]);

  const markPulsed = useCallback(async () => {
    await AsyncStorage.setItem(`${PULSE_STORAGE_PREFIX}${gameweek}`, "done");
    setAlreadyPulsed(true);
  }, [gameweek]);

  const handleSubmit = useCallback(async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      const userId = await getAuthenticatedUserId();
      if (!userId) {
        setSubmitting(false);
        return;
      }

      await supabase.from("feedback_responses").insert({
        user_id: userId,
        gameweek,
        usefulness_score: rating,
        best_feature: bestFeature,
        frustration_text: frustration.trim() || null,
        feedback_type: "pulse",
      });
    } catch (err) {
      console.error("[SuperScout] Pulse submit error:", err);
    }
    await markPulsed();
    setSubmitting(false);
    onDismiss();
  }, [rating, bestFeature, frustration, gameweek, markPulsed, onDismiss]);

  const handleSkip = useCallback(async () => {
    await markPulsed();
    onDismiss();
  }, [markPulsed, onDismiss]);

  if (alreadyPulsed || !visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleSkip} />
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>GW{gameweek} Pulse Check</Text>
            <Pressable onPress={handleSkip} hitSlop={12}>
              <Feather name="x" size={22} color="#888" />
            </Pressable>
          </View>

          <Text style={styles.question}>How useful was SuperScout this gameweek?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)} hitSlop={8}>
                <Feather
                  name="star"
                  size={36}
                  color={star <= rating ? "#00ff87" : "#333"}
                  style={star <= rating ? styles.starFilled : undefined}
                />
              </Pressable>
            ))}
          </View>

          <Text style={styles.question}>What was the best thing?</Text>
          <View style={styles.optionsGrid}>
            {BEST_FEATURE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setBestFeature(bestFeature === option ? null : option)}
                style={[styles.optionChip, bestFeature === option && styles.optionChipActive]}
              >
                <Text
                  style={[styles.optionText, bestFeature === option && styles.optionTextActive]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.question}>Anything frustrating?</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={frustration}
              onChangeText={(t) => setFrustration(t.slice(0, 280))}
              placeholder="Optional — max 280 characters"
              placeholderTextColor="#555"
              multiline
              maxLength={280}
            />
            <Text style={styles.charCount}>{frustration.length}/280</Text>
          </View>

          <Pressable
            style={[styles.submitButton, rating === 0 && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={rating === 0 || submitting}
          >
            <Text style={styles.submitText}>{submitting ? "Sending..." : "Submit"}</Text>
          </Pressable>

          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modal: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#0D0D1A",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1f1f2e",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  question: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ccc",
    marginBottom: 10,
    marginTop: 4,
  },
  starsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    justifyContent: "center",
  },
  starFilled: {
    opacity: 1,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1a1a2e",
    borderWidth: 1,
    borderColor: "#2a2a3e",
  },
  optionChipActive: {
    backgroundColor: "#00ff8720",
    borderColor: "#00ff87",
  },
  optionText: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  optionTextActive: {
    color: "#00ff87",
  },
  inputWrapper: {
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: "#1a1a2e",
    borderRadius: 10,
    padding: 12,
    color: "#e0e0e0",
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#2a2a3e",
  },
  charCount: {
    fontSize: 11,
    color: "#555",
    textAlign: "right",
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: "#00ff87",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0D0D1A",
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  skipText: {
    fontSize: 14,
    color: "#666",
  },
});
