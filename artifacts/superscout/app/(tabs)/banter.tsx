import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { useManagerId } from "@/hooks/useManagerId";
import { useSubscription } from "@/lib/revenuecat";
import { supabase } from "@/services/supabase";
import BanterCard from "@/components/BanterCard";
import type { BanterCardData } from "@/components/BanterCard";
import BlurredCard from "@/components/BlurredCard";
import Paywall from "@/components/Paywall";
import ProgressLoadingIndicator from "@/components/ProgressLoadingIndicator";

const PERSONA_KEY = "superscout_persona";
const MIN_LOADING_MS = 3000;

function getApiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return `https://${domain}/api`;
}

export default function BanterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { managerId, loading: managerLoading } = useManagerId();
  const { isPro } = useSubscription();

  const [banterCards, setBanterCards] = useState<BanterCardData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState("leagues");
  const [noLeagues, setNoLeagues] = useState(false);
  const [vibe, setVibe] = useState<"expert" | "critic" | "fanboy">("expert");
  const [showPaywall, setShowPaywall] = useState(false);

  const autoLoadedVibeRef = useRef<string | null>(null);
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (noLeagues) {
        setNoLeagues(false);
        autoLoadedVibeRef.current = null;
      }

      AsyncStorage.getItem(PERSONA_KEY)
        .then((persona) => {
          if (
            persona === "expert" ||
            persona === "critic" ||
            persona === "fanboy"
          ) {
            const effectiveVibe = isPro ? persona : "expert";
            setVibe((prev) => {
              if (prev !== effectiveVibe) {
                setBanterCards(null);
                setError(null);
                autoLoadedVibeRef.current = null;
              }
              return effectiveVibe as "expert" | "critic" | "fanboy";
            });
          }
        })
        .catch(() => {});
    }, [isPro, noLeagues]),
  );

  const clearStageTimers = useCallback(() => {
    if (stageTimerRef.current) {
      clearTimeout(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  }, []);

  const fetchBanter = useCallback(async () => {
    if (!managerId) return;
    if (loading) return;

    setLoading(true);
    setError(null);
    setBanterCards(null);
    setNoLeagues(false);
    setLoadingStage("leagues");

    const loadStart = Date.now();

    stageTimerRef.current = setTimeout(() => {
      setLoadingStage("rivals");
      stageTimerRef.current = setTimeout(() => {
        setLoadingStage("squads");
        stageTimerRef.current = setTimeout(() => {
          setLoadingStage("banter_ai");
        }, 1500);
      }, 1200);
    }, 800);

    try {
      const apiBase = getApiBaseUrl();
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const res = await fetch(
        `${apiBase}/banter/current?user_id=${userId}&vibe=${vibe}`,
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error ?? `Server error: ${res.status}`,
        );
      }

      const data = await res.json();

      if (data.no_leagues) {
        clearStageTimers();
        setNoLeagues(true);
        setLoading(false);
        return;
      }

      const elapsed = Date.now() - loadStart;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);

      clearStageTimers();
      setLoadingStage("banter_done");

      await new Promise((r) => setTimeout(r, remaining));

      setBanterCards(data.banter_cards ?? []);
    } catch (err: any) {
      clearStageTimers();
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [managerId, vibe, loading, clearStageTimers]);

  useEffect(() => {
    if (
      managerId &&
      !managerLoading &&
      !loading &&
      !banterCards &&
      !error &&
      !noLeagues &&
      autoLoadedVibeRef.current !== vibe
    ) {
      autoLoadedVibeRef.current = vibe;
      fetchBanter();
    }
  }, [managerId, managerLoading, vibe, loading, banterCards, error, noLeagues]);

  const handleShare = async (card: BanterCardData) => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;

      const apiBase = getApiBaseUrl();
      await fetch(`${apiBase}/squad-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          card_type: "banter",
          card_data: {
            rival_team_name: card.rival_team_name,
            headline: card.headline,
            share_line: card.share_line,
            league_name: card.league_name,
          },
          shared_via: Platform.OS === "web" ? "clipboard" : "share_sheet",
        }),
      }).catch(() => {});
    } catch {}
  };

  if (managerLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!managerId) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <Feather name="link" size={48} color={colors.mutedForeground} />
        <Text
          style={[
            styles.emptyTitle,
            { color: colors.foreground, marginTop: 16 },
          ]}
        >
          Connect Your FPL Team
        </Text>
        <Text
          style={[styles.emptySubtitle, { color: colors.mutedForeground }]}
        >
          Head to Settings and link your FPL account to unlock banter.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 + 16 : insets.top + 8,
            paddingBottom:
              Platform.OS === "web" ? 34 + 84 : insets.bottom + 84,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>
          Banter
        </Text>
        <Text
          style={[styles.screenSubtitle, { color: colors.mutedForeground }]}
        >
          Ammunition for your group chat
        </Text>

        {loading && (
          <ProgressLoadingIndicator
            vibe={vibe}
            currentStage={loadingStage}
            variant="banter"
          />
        )}

        {noLeagues && !loading && (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather
              name="users"
              size={40}
              color={colors.mutedForeground}
            />
            <Text
              style={[
                styles.emptyTitle,
                { color: colors.foreground, marginTop: 12 },
              ]}
            >
              No Leagues Connected
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: colors.mutedForeground },
              ]}
            >
              Connect your mini-leagues in Settings to start generating banter
              against your rivals.
            </Text>
          </View>
        )}

        {error && !loading && (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="alert-circle" size={40} color="#E84C4C" />
            <Text
              style={[
                styles.emptyTitle,
                { color: colors.foreground, marginTop: 12 },
              ]}
            >
              Something went wrong
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: colors.mutedForeground },
              ]}
            >
              {error}
            </Text>
            <Pressable
              onPress={() => {
                autoLoadedVibeRef.current = null;
                fetchBanter();
              }}
              style={[styles.retryButton, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {banterCards && !loading && banterCards.length === 0 && (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather
              name="message-circle"
              size={40}
              color={colors.mutedForeground}
            />
            <Text
              style={[
                styles.emptyTitle,
                { color: colors.foreground, marginTop: 12 },
              ]}
            >
              No Banter Yet
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: colors.mutedForeground },
              ]}
            >
              Make sure your leagues have active members and try again after the
              gameweek starts.
            </Text>
          </View>
        )}

        {banterCards &&
          !loading &&
          banterCards.map((card, i) => {
            if (!isPro && i >= 1) {
              if (i === 1) {
                return (
                  <BlurredCard
                    key={`blurred-${i}`}
                    onPress={() => setShowPaywall(true)}
                  />
                );
              }
              return null;
            }
            return (
              <BanterCard
                key={`${card.rival_team_name}-${i}`}
                card={card}
                onShare={handleShare}
              />
            );
          })}
      </ScrollView>

      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  screenSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  emptyCard: {
    padding: 32,
    borderWidth: 1,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#1a472a",
  },
});
