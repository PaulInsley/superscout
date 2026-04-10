import React, { useState, useCallback, useRef } from "react";
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
import { useFocusEffect } from "expo-router";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";

import { useColors } from "@/hooks/useColors";
import { useManagerId } from "@/hooks/useManagerId";
import SquadCard from "@/components/SquadCard";
import ProgressLoadingIndicator from "@/components/ProgressLoadingIndicator";

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
  const [vibe, setVibe] = useState<"expert" | "critic" | "fanboy">("expert");
  const [cardData, setCardData] = useState<SquadCardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>("squad");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("superscout_persona").then(stored => {
        const validVibes = ["expert", "critic", "fanboy"] as const;
        if (stored && validVibes.includes(stored as typeof validVibes[number]) && stored !== vibe) {
          setVibe(stored as "expert" | "critic" | "fanboy");
          setCardData(null);
        }
      });
    }, [vibe])
  );

  const generateCard = useCallback(async () => {
    if (!managerId) return;

    setLoading(true);
    setError(null);
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
          setError("This gameweek isn't finished yet. Come back after the last match to see your full results.");
        } else if (data.error === "no_picks") {
          setError("No squad data found for this gameweek. Did you forget to set your team?");
        } else if (data.error === "no_finished_gameweek") {
          setError("The season hasn't started yet — no finished gameweeks to build a card from.");
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
          setCardData(data);
          setLoading(false);
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
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          UTI: "public.png",
          dialogTitle: "Share your Squad Card",
        });
        didShare = true;
        platform = "other";
      } else if (Platform.OS === "ios") {
        const result = await Share.share({ url: uri });
        if (result.action === Share.sharedAction) {
          didShare = true;
          platform = mapActivityTypeToPlatform(result.activityType);
        }
      } else {
        Alert.alert("Sharing not available", "Sharing is not supported on this device.");
      }
    } catch (err) {
      console.error("[SuperScout] Share error:", err);
    }

    if (didShare && cardData) {
      try {
        const baseUrl = getApiBaseUrl();
        await fetch(`${baseUrl}/squad-card/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            card_id: cardData.cardId,
            gameweek: cardData.gameweek,
            platform,
          }),
        });
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
        <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          <Pressable
            style={[styles.retryButton, { borderColor: colors.border }]}
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
            style={[styles.generateRealButton, { backgroundColor: colors.primary }]}
            onPress={generateCard}
          >
            <Text style={[styles.generateButtonText, { color: colors.primaryForeground }]}>
              Regenerate Card
            </Text>
          </Pressable>
        </>
      )}
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
