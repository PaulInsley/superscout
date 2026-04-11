import React, { useState, useCallback } from "react";
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
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/services/supabase";

const CATEGORIES = [
  { key: "bug", label: "Bug" },
  { key: "feature_request", label: "Feature request" },
  { key: "vibe_feedback", label: "Vibe feedback" },
  { key: "other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["key"];

interface FeedbackButtonProps {
  color?: string;
  accentColor?: string;
}

export function FeedbackModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<Category>("bug");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      let userId = "00000000-0000-0000-0000-000000000000";
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) userId = user.id;
      } catch {}

      await supabase.from("feedback_responses").insert({
        user_id: userId,
        feedback_type: "persistent",
        category,
        frustration_text: text.trim(),
      });

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setText("");
        setCategory("bug");
        onClose();
      }, 1800);
    } catch (err) {
      console.error("[SuperScout] Feedback submit error:", err);
    }
    setSubmitting(false);
  }, [category, text, onClose]);

  const handleClose = useCallback(() => {
    if (!submitted) {
      setText("");
      setCategory("bug");
    }
    onClose();
  }, [onClose, submitted]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.modal}>
          {submitted ? (
            <View style={styles.successContainer}>
              <Feather name="check-circle" size={40} color="#00ff87" />
              <Text style={styles.successText}>
                Thanks! Your feedback helps SuperScout improve.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Send Feedback</Text>
                <Pressable onPress={handleClose} hitSlop={12}>
                  <Feather name="x" size={22} color="#888" />
                </Pressable>
              </View>

              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.key}
                    onPress={() => setCategory(cat.key)}
                    style={[
                      styles.categoryChip,
                      category === cat.key && styles.categoryChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        category === cat.key && styles.categoryTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Your feedback</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  value={text}
                  onChangeText={(t) => setText(t.slice(0, 500))}
                  placeholder="Tell us what's on your mind..."
                  placeholderTextColor="#555"
                  multiline
                  maxLength={500}
                />
                <Text style={styles.charCount}>{text.length}/500</Text>
              </View>

              <Pressable
                style={[
                  styles.submitButton,
                  !text.trim() && styles.submitDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!text.trim() || submitting}
              >
                <Text style={styles.submitText}>
                  {submitting ? "Sending..." : "Submit"}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function FeedbackButton({
  color = "#ccc",
  accentColor,
}: FeedbackButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setShowModal(true)}
        style={({ pressed }) => [
          styles.iconButton,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        hitSlop={8}
      >
        <Feather name="message-circle" size={20} color={accentColor ?? color} />
      </Pressable>
      <FeedbackModal
        visible={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    padding: 4,
  },
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
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ccc",
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1a1a2e",
    borderWidth: 1,
    borderColor: "#2a2a3e",
  },
  categoryChipActive: {
    backgroundColor: "#00ff8720",
    borderColor: "#00ff87",
  },
  categoryText: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  categoryTextActive: {
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
    minHeight: 100,
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
  successContainer: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 16,
  },
  successText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ccc",
    textAlign: "center",
    lineHeight: 22,
  },
});
