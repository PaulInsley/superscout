import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  Share,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthenticatedUserId } from "@/services/auth";
import { useFocusEffect } from "expo-router";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";

import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useManagerId } from "@/hooks/useManagerId";
import { useSubscription } from "@/lib/revenuecat";
import SquadCard from "@/components/SquadCard";
import PulseCheck from "@/components/PulseCheck";
import ProgressLoadingIndicator from "@/components/ProgressLoadingIndicator";
import { trackStreakActivity } from "@/services/streaks/trackActivity";

interface CardPlayer {
  id: number;
  webName: string;
  position: string;
  points: number;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isAutoSubIn?: boolean;
  isAutoSubOut?: boolean;
}

interface SquadCardData {
  cardId: string | null;
  teamName: string;
  gameweek: number;
  formation: string;
  starters: CardPlayer[];
  bench: CardPlayer[];
  totalPoints: number;
  benchPoints: number;
  overallRank: number;
  rankChange: number | null;
  rankDirection: "up" | "down" | "same" | "new";
  gwAverage: number | null;
  quipText: string;
  vibe: string;
}

function mapActivityTypeToPlatform(activityType?: string | null): string {
  if (!activityType) return "other";
  const at = activityType.toLowerCase();
  console.log("[SuperScout] Share activityType:", activityType);
  if (at.includes("com.apple.uikit.activity.message") || at === "com.apple.uikit.activity.message") return "imessage";
  if (at.includes("whatsapp")) return "whatsapp";
  if (at.includes("twitter") || at.includes("com.atebits") || at.includes("x.com")) return "twitter";
  if (at.includes("instagram")) return "instagram";
  if (at.includes("facebook")) return "facebook";
  if (at.includes("copytopasteboard") || at.includes("com.apple.uikit.activity.copytopasteboard")) return "clipboard";
  return "other";
}

function getApiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return `https://${domain}/api`;
}

export default function CardScreen() {
  const colors = useColors();
  const { managerId, teamName, loading: managerLoading } = useManagerId();
  const { isPro } = useSubscription();
  const [vibe, setVibe] = useState<"expert" | "critic" | "fanboy">("expert");
  const [cardData, setCardData] = useState<SquadCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>("squad");
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"error" | "info">("error");
  const [saving, setSaving] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [regenCooldown, setRegenCooldown] = useState(0);
  const regenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    if (cardData && cardData.gameweek > 0) {
      const timer = setTimeout(() => setShowPulse(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [cardData]);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("superscout_persona").then(stored => {
        const validVibes = ["expert", "critic", "fanboy"] as const;
        if (stored && validVibes.includes(stored as typeof validVibes[number])) {
          const effectiveVibe = isPro ? stored : "expert";
          if (effectiveVibe !== vibe) {
            setVibe(effectiveVibe as "expert" | "critic" | "fanboy");
            setCardData(null);
          }
        }
      });
    }, [vibe, isPro])
  );

  const startRegenCooldown = useCallback(() => {
    if (regenTimerRef.current) clearInterval(regenTimerRef.current);
    setRegenCooldown(60);
    regenTimerRef.current = setInterval(() => {
      setRegenCooldown((prev) => {
        if (prev <= 1) {
          if (regenTimerRef.current) clearInterval(regenTimerRef.current);
          regenTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (regenTimerRef.current) clearInterval(regenTimerRef.current);
    };
  }, []);

  const generateCard = useCallback(async () => {
    if (!managerId) return;

    setLoading(true);
    setError(null);
    setErrorType("error");
    setCardData(null);
    setLoadingStage("squad");

    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    stageTimers.push(setTimeout(() => setLoadingStage("rules"), 1000));
    stageTimers.push(setTimeout(() => setLoadingStage("ai"), 2500));

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/squad-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager_id: managerId, vibe }),
      });

      stageTimers.forEach(clearTimeout);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.error === "gameweek_not_finished") {
          const gwNum = data.gameweek ?? "";
          setErrorType("info");
          setError(`GW${gwNum} is still in progress — your Squad Card will be ready once all matches are finished.`);
        } else if (data.error === "no_finished_gameweek") {
          setErrorType("info");
          setError("No completed gameweeks yet — your first Squad Card will be ready after GW1.");
        } else if (data.error === "no_picks") {
          setError("No squad data found for this gameweek. Make sure you have an active FPL team.");
        } else {
          setError("FPL data is temporarily unavailable. Try again in a few minutes.");
        }
        setLoading(false);
        return;
      }

      setLoadingStage("validating");
      const data: SquadCardData = await response.json();

      setTimeout(() => {
        setLoadingStage("done");
        setTimeout(() => {
          if (!isPro) {
            setCardData({ ...data, quipText: "" });
          } else {
            setCardData(data);
          }
          setLoading(false);
          trackStreakActivity();
          startRegenCooldown();
        }, 400);
      }, 300);
    } catch (err) {
      stageTimers.forEach(clearTimeout);
      console.error("[SuperScout] Squad card error:", err);
      setError("FPL data is temporarily unavailable. Try again in a few minutes.");
      setLoading(false);
    }
  }, [managerId, vibe]);

  const captureCard = useCallback(async (): Promise<string | null> => {
    if (!viewShotRef.current?.capture) return null;
    try {
      const uri = await viewShotRef.current.capture();
      return uri;
    } catch (err) {
      console.error("[SuperScout] Capture error:", err);
      return null;
    }
  }, []);

  const handleShare = useCallback(async () => {
    const uri = await captureCard();
    if (!uri) {
      Alert.alert("Error", "Could not capture the card image. Try again.");
      return;
    }

    let didShare = false;
    let platform = "other";

    try {
      if (Platform.OS === "ios") {
        const result = await Share.share({ url: uri });
        if (result.action === Share.sharedAction) {
          didShare = true;
          platform = mapActivityTypeToPlatform(result.activityType);
        }
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: "image/png",
            UTI: "public.png",
            dialogTitle: "Share your Squad Card",
          });
          didShare = true;
          platform = "other";
        } else {
          Alert.alert("Sharing not available", "Sharing is not supported on this device.");
        }
      }
    } catch (err) {
      console.error("[SuperScout] Share error:", err);
    }

    if (didShare && cardData) {
      try {
        const baseUrl = getApiBaseUrl();
        const userId = await getAuthenticatedUserId();
        if (userId) {
          await fetch(`${baseUrl}/squad-card/share`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              card_id: cardData.cardId,
              gameweek: cardData.gameweek,
              platform,
              user_id: userId,
            }),
          });
        }
      } catch {}
    }
  }, [captureCard, cardData]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const uri = await captureCard();
    if (!uri) {
      Alert.alert("Error", "Could not capture the card image.");
      setSaving(false);
      return;
    }

    try {
      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.href = uri;
        link.download = `superscout-gw${cardData?.gameweek ?? ""}.png`;
        link.click();
        Alert.alert("Saved", "Card image downloaded.");
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Please allow access to your photo library to save the card.");
          setSaving(false);
          return;
        }

        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert("Saved!", "Card saved to your photo library.");
      }
    } catch (err) {
      console.error("[SuperScout] Save error:", err);
      Alert.alert("Error", "Could not save the card. Try again.");
    }
    setSaving(false);
  }, [captureCard, cardData]);

  const noManager = !managerLoading && !managerId;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Squad Card</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Your gameweek results, ready to share
        </Text>
      </View>

      {noManager && !cardData && (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyIcon, { color: colors.mutedForeground }]}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Connect your FPL account</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Set up your Manager ID in Settings to generate your squad card.
          </Text>
        </View>
      )}

      {!noManager && !cardData && !loading && !error && (
        <Pressable
          style={[styles.generateButton, { backgroundColor: colors.primary }]}
          onPress={generateCard}
        >
          <Text style={[styles.generateButtonText, { color: colors.primaryForeground }]}>
            Generate My Card
          </Text>
        </Pressable>
      )}

      {loading && (
        <ProgressLoadingIndicator
          vibe={vibe}
          currentStage={loadingStage}
          variant="captain"
        />
      )}

      {error && (
        <View style={[styles.errorCard, {
          backgroundColor: errorType === "info" ? "#3b82f610" : colors.card,
          borderColor: errorType === "info" ? "#3b82f640" : colors.border,
        }]}>
          {errorType === "info" && (
            <Feather name="clock" size={32} color="#3b82f6" style={{ marginBottom: 8 }} />
          )}
          <Text style={[styles.errorText, { color: errorType === "info" ? "#3b82f6" : colors.destructive }]}>{error}</Text>
          <Pressable
            style={[styles.retryButton, { borderColor: errorType === "info" ? "#3b82f640" : colors.border }]}
            onPress={generateCard}
          >
            <Text style={[styles.retryText, { color: colors.foreground }]}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {cardData && (
        <>
          <View style={styles.offscreen}>
            <ViewShot
              ref={viewShotRef}
              options={{
                format: "png",
                quality: 1,
              }}
            >
              <SquadCard {...cardData} captureMode={true} />
            </ViewShot>
          </View>

          <View style={styles.cardPreview}>
            <SquadCard {...cardData} captureMode={false} />
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.shareButton, { backgroundColor: "#00ff87" }]}
              onPress={handleShare}
            >
              <Text style={styles.shareButtonText}>Share</Text>
            </Pressable>
            <Pressable
              style={[styles.saveButton, { borderColor: colors.border }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.foreground }]}>Save to Photos</Text>
              )}
            </Pressable>
          </View>

          <Pressable
            style={[styles.generateRealButton, { backgroundColor: colors.primary, opacity: regenCooldown > 0 ? 0.5 : 1 }]}
            onPress={generateCard}
            disabled={regenCooldown > 0}
          >
            <Text style={[styles.generateButtonText, { color: colors.primaryForeground }]}>
              {regenCooldown > 0 ? `Regenerate Card (${regenCooldown}s)` : "Regenerate Card"}
            </Text>
          </Pressable>
        </>
      )}

      <PulseCheck
        gameweek={cardData?.gameweek ?? 0}
        visible={showPulse}
        onDismiss={() => setShowPulse(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: "absolute",
    left: -9999,
    top: -9999,
    opacity: 0,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  generateButton: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: "700",
  },
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  retryButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardPreview: {
    alignItems: "center",
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  shareButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  shareButtonText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f1923",
  },
  saveButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: "700",
  },
  generateRealButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
});
