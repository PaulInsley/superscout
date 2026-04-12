import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ConfettiCannon from "react-native-confetti-cannon";
import ViewShot from "react-native-view-shot";

import { useColors } from "@/hooks/useColors";
import {
  getMilestoneMessage,
  getMilestoneTitle,
  type VibeType,
} from "@/config/streaks/streakMessages";
import { getSportConfig } from "@/config/sports/sportConfig";
import config from "@/constants/config";

const PERSONA_KEY = "superscout_persona";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface MilestoneCelebrationProps {
  milestone: number;
  currentStreak: number;
  sport?: string;
  onDismiss: () => void;
}

export default function MilestoneCelebration({
  milestone,
  currentStreak,
  sport = "fpl",
  onDismiss,
}: MilestoneCelebrationProps) {
  const colors = useColors();
  const sportConfig = getSportConfig(sport);
  const [vibe, setVibe] = useState<VibeType>("expert");
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    AsyncStorage.getItem(PERSONA_KEY).then((val) => {
      if (val === "expert" || val === "critic" || val === "fanboy") {
        setVibe(val);
      }
    });
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, fadeAnim]);

  const title = getMilestoneTitle(milestone, sportConfig);
  const message = getMilestoneMessage(milestone, vibe);

  const getBadgeEmoji = () => {
    if (milestone >= 38) return "🏆";
    if (milestone >= 20) return "⭐";
    if (milestone >= 10) return "🌟";
    return "🔥";
  };

  const handleShare = async () => {
    try {
      if (viewShotRef.current) {
        const uri = await (viewShotRef.current as any).capture();
        if (Platform.OS === "web") {
          const link = document.createElement("a");
          link.href = uri;
          link.download = `superscout-streak-${milestone}.png`;
          link.click();
        } else {
          await Share.share({
            message: `${config.brandName} streak: ${currentStreak} ${sportConfig.roundNamePlural}! ${getBadgeEmoji()}`,
            url: uri,
          });
        }
      }
    } catch {}
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <ConfettiCannon
          count={150}
          origin={{ x: SCREEN_WIDTH / 2, y: -10 }}
          fadeOut
          explosionSpeed={350}
          fallSpeed={3000}
          autoStart
        />

        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderRadius: colors.radius + 8,
              },
            ]}
          >
            <Text style={styles.badgeEmoji}>{getBadgeEmoji()}</Text>

            <Text style={[styles.milestoneTitle, { color: "#f97316" }]}>
              {title}
            </Text>

            <Text style={[styles.streakCount, { color: colors.foreground }]}>
              {currentStreak} {sportConfig.roundNamePlural} strong
            </Text>

            <View
              style={[
                styles.messageBox,
                { backgroundColor: colors.background, borderRadius: colors.radius },
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  {
                    color: colors.foreground,
                    fontStyle: vibe === "critic" ? "italic" : "normal",
                  },
                ]}
              >
                "{message}"
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.shareButton,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather name="share-2" size={16} color={colors.primaryForeground} />
                <Text style={[styles.shareText, { color: colors.primaryForeground }]}>
                  Share
                </Text>
              </Pressable>

              <Pressable
                onPress={onDismiss}
                style={({ pressed }) => [
                  styles.dismissButton,
                  {
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.dismissText, { color: colors.foreground }]}>
                  Keep Going
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        <View style={styles.offscreen}>
          <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1 }}>
            <View style={styles.shareCard}>
              <Text style={styles.shareCardBrand}>{config.brandName}</Text>
              <Text style={styles.shareCardEmoji}>{getBadgeEmoji()}</Text>
              <Text style={styles.shareCardTitle}>{title}</Text>
              <Text style={styles.shareCardStreak}>
                {currentStreak} {sportConfig.roundNamePlural} streak
              </Text>
            </View>
          </ViewShot>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 380,
  },
  card: {
    padding: 28,
    alignItems: "center",
  },
  badgeEmoji: {
    fontSize: 64,
    marginBottom: 12,
  },
  milestoneTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  streakCount: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    marginBottom: 20,
  },
  messageBox: {
    padding: 14,
    marginBottom: 24,
    width: "100%",
  },
  messageText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  shareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  shareText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  dismissButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderWidth: 1,
  },
  dismissText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  offscreen: {
    position: "absolute",
    left: -9999,
    top: -9999,
  },
  shareCard: {
    width: 1080,
    height: 1080,
    backgroundColor: "#0D0D1A",
    alignItems: "center",
    justifyContent: "center",
    padding: 80,
  },
  shareCardBrand: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: "#00ff87",
    marginBottom: 40,
  },
  shareCardEmoji: {
    fontSize: 120,
    marginBottom: 30,
  },
  shareCardTitle: {
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    color: "#f97316",
    textAlign: "center",
    marginBottom: 20,
  },
  shareCardStreak: {
    fontSize: 36,
    fontFamily: "Inter_500Medium",
    color: "#fff",
  },
});
