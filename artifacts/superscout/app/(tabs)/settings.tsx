import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useManagerId } from "@/hooks/useManagerId";
import { useSubscription } from "@/lib/revenuecat";
import { useBeginnerMode } from "@/hooks/useBeginnerMode";
import { supabase } from "@/services/supabase";
import { fetchManagerLeagues } from "@/services/fpl/api";
import config from "@/constants/config";
import ChooseVibeScreen, {
  VIBES,
} from "@/app/onboarding/ChooseVibeScreen";
import ConnectFPLScreen from "@/app/onboarding/ConnectFPLScreen";
import Paywall from "@/components/Paywall";
import ProBadge from "@/components/ProBadge";
import { FeedbackModal } from "@/components/FeedbackButton";
import { ONBOARDING_COMPLETE_KEY } from "@/app/onboarding/OnboardingFlow";
import type { Vibe } from "@/app/onboarding/ChooseVibeScreen";
import type { FPLLeague } from "@/services/fpl/types";

const PERSONA_KEY = "superscout_persona";

function getApiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return `https://${domain}/api`;
}

interface SavedLeague {
  id: string;
  mini_league_id: string;
  mini_league_name: string;
  league_type: string;
  current_rank: number | null;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isPro, subscriptionType, devSimulatePro, setDevSimulatePro } = useSubscription();
  const [currentVibe, setCurrentVibe] = useState<Vibe | null>(null);
  const [showVibePicker, setShowVibePicker] = useState(false);
  const [showFPLConnect, setShowFPLConnect] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const { managerId, teamName, setManager } = useManagerId();
  const beginner = useBeginnerMode();

  const [availableLeagues, setAvailableLeagues] = useState<FPLLeague[]>([]);
  const [savedLeagues, setSavedLeagues] = useState<SavedLeague[]>([]);
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<Set<number>>(new Set());
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  const [leaguesSaving, setLeaguesSaving] = useState(false);
  const [showLeaguePicker, setShowLeaguePicker] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PERSONA_KEY)
      .then((val) => {
        if (val === "expert" || val === "critic" || val === "fanboy") {
          setCurrentVibe(val);
        }
      })
      .catch(() => {});
  }, []);

  const loadSavedLeagues = useCallback(async () => {
    try {
      let userId = "00000000-0000-0000-0000-000000000000";
      try { const { data: { user } } = await supabase.auth.getUser(); if (user?.id) userId = user.id; } catch {}
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/banter/leagues/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSavedLeagues(data.leagues ?? []);
        setSelectedLeagueIds(new Set((data.leagues ?? []).map((l: SavedLeague) => Number(l.mini_league_id))));
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (managerId) {
      loadSavedLeagues();
    }
  }, [managerId, loadSavedLeagues]);

  const openLeaguePicker = useCallback(async () => {
    if (!managerId) return;
    setShowLeaguePicker(true);
    setLeaguesLoading(true);
    try {
      const leagues = await fetchManagerLeagues(managerId);
      setAvailableLeagues(leagues);
    } catch {
      setAvailableLeagues([]);
    } finally {
      setLeaguesLoading(false);
    }
  }, [managerId]);

  const toggleLeague = useCallback((leagueId: number) => {
    setSelectedLeagueIds((prev) => {
      const next = new Set(prev);
      if (next.has(leagueId)) {
        next.delete(leagueId);
      } else if (next.size < 3) {
        next.add(leagueId);
      }
      return next;
    });
  }, []);

  const saveLeagues = useCallback(async () => {
    setLeaguesSaving(true);
    try {
      let userId = "00000000-0000-0000-0000-000000000000";
      try { const { data: { user } } = await supabase.auth.getUser(); if (user?.id) userId = user.id; } catch {}

      const leaguesToSave = availableLeagues
        .filter((l) => selectedLeagueIds.has(l.id))
        .map((l) => ({
          id: l.id,
          name: l.name,
          type: l.league_type === "x" ? "h2h" : "classic",
          rank: l.entry_rank,
        }));

      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/banter/leagues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, leagues: leaguesToSave }),
      });

      if (res.ok) {
        await loadSavedLeagues();
        setShowLeaguePicker(false);
      }
    } catch {} finally {
      setLeaguesSaving(false);
    }
  }, [availableLeagues, selectedLeagueIds, loadSavedLeagues]);

  const handleVibeChange = (v: Vibe) => {
    setCurrentVibe(v);
    setShowVibePicker(false);

    AsyncStorage.setItem(PERSONA_KEY, v).catch(() => {});

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (user) {
          supabase
            .from("users")
            .update({ default_persona: v })
            .eq("id", user.id);
        }
      })
      .catch(() => {});
  };

  const handleFPLConnect = async (
    id: number | null,
    name: string | null,
  ) => {
    if (id && name) {
      await setManager(id, name);
    }
    setShowFPLConnect(false);
  };

  if (showLeaguePicker) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.fplConnectHeader,
            { paddingTop: Platform.OS === "web" ? 67 : insets.top },
          ]}
        >
          <Pressable
            onPress={() => setShowLeaguePicker(false)}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.screenTitle, { color: colors.foreground, marginBottom: 0, flex: 1 }]}>
            Select Leagues
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.leaguePickerHint, { color: colors.mutedForeground }]}>
            Choose up to 3 mini-leagues for banter generation
          </Text>

          {leaguesLoading && (
            <View style={styles.leagueLoadingContainer}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[styles.settingValue, { color: colors.mutedForeground, marginTop: 8 }]}>
                Loading your leagues...
              </Text>
            </View>
          )}

          {!leaguesLoading && availableLeagues.length === 0 && (
            <View style={[styles.emptyLeagueCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Feather name="info" size={24} color={colors.mutedForeground} />
              <Text style={[styles.settingLabel, { color: colors.foreground, marginTop: 8 }]}>
                No leagues found
              </Text>
              <Text style={[styles.settingValue, { color: colors.mutedForeground, marginTop: 4 }]}>
                Join a mini-league on the FPL website first
              </Text>
            </View>
          )}

          {!leaguesLoading && availableLeagues.map((league) => {
            const isSelected = selectedLeagueIds.has(league.id);
            const isDisabled = !isSelected && selectedLeagueIds.size >= 3;
            return (
              <Pressable
                key={league.id}
                onPress={() => !isDisabled && toggleLeague(league.id)}
                style={({ pressed }) => [
                  styles.leagueRow,
                  {
                    backgroundColor: isSelected ? colors.accent + "15" : colors.card,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.7 : isDisabled ? 0.5 : 1,
                  },
                ]}
              >
                <View style={styles.leagueRowLeft}>
                  <View
                    style={[
                      styles.leagueCheck,
                      {
                        backgroundColor: isSelected ? colors.accent : "transparent",
                        borderColor: isSelected ? colors.accent : colors.mutedForeground,
                      },
                    ]}
                  >
                    {isSelected && <Feather name="check" size={14} color="#1a472a" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: colors.foreground }]} numberOfLines={1}>
                      {league.name}
                    </Text>
                    <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>
                      Rank {league.entry_rank} · {league.league_type === "x" ? "H2H" : "Classic"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {!leaguesLoading && availableLeagues.length > 0 && (
          <View style={[styles.saveLeagueBar, { paddingBottom: insets.bottom + 70, backgroundColor: colors.background }]}>
            <Pressable
              onPress={saveLeagues}
              disabled={leaguesSaving || selectedLeagueIds.size === 0}
              style={({ pressed }) => [
                styles.saveLeagueButton,
                {
                  backgroundColor: selectedLeagueIds.size === 0 ? colors.border : colors.accent,
                  opacity: pressed ? 0.8 : leaguesSaving ? 0.6 : 1,
                },
              ]}
            >
              {leaguesSaving ? (
                <ActivityIndicator color="#1a472a" size="small" />
              ) : (
                <Text style={styles.saveLeagueText}>
                  Save {selectedLeagueIds.size} League{selectedLeagueIds.size !== 1 ? "s" : ""}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  if (showVibePicker) {
    return (
      <ChooseVibeScreen
        onNext={handleVibeChange}
        onCancel={() => setShowVibePicker(false)}
        isSettings
      />
    );
  }

  if (showFPLConnect) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.fplConnectHeader,
            {
              paddingTop: Platform.OS === "web" ? 67 : insets.top,
            },
          ]}
        >
          <Pressable
            onPress={() => setShowFPLConnect(false)}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <ConnectFPLScreen onNext={handleFPLConnect} />
      </View>
    );
  }

  const vibeLabel =
    VIBES.find((p) => p.key === currentVibe)?.name ?? "Not set";

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
          Settings
        </Text>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { color: colors.mutedForeground }]}
          >
            FPL Account
          </Text>

          <Pressable
            onPress={() => setShowFPLConnect(true)}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.settingLeft}>
              <Feather
                name={managerId ? "check-circle" : "link"}
                size={18}
                color={managerId ? "#22c55e" : colors.foreground}
              />
              <View>
                <Text
                  style={[styles.settingLabel, { color: colors.foreground }]}
                >
                  {managerId ? teamName ?? "Connected" : "Connect your FPL Team"}
                </Text>
                <Text
                  style={[
                    styles.settingValue,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {managerId
                    ? `Manager ID: ${managerId}`
                    : "Tap to search or enter your ID"}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.changeText,
                { color: managerId ? colors.accent : colors.mutedForeground },
              ]}
            >
              {managerId ? "Change" : ""}
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { color: colors.mutedForeground }]}
          >
            Vibe
          </Text>

          <Pressable
            onPress={() => {
              if (isPro) {
                setShowVibePicker(true);
              } else {
                setShowPaywall(true);
              }
            }}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.settingLeft}>
              <Feather name="mic" size={18} color={colors.foreground} />
              <View>
                <Text
                  style={[styles.settingLabel, { color: colors.foreground }]}
                >
                  Change your Vibe
                </Text>
                <Text
                  style={[
                    styles.settingValue,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {isPro ? vibeLabel : "Expert (free tier)"}
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              {!isPro && <ProBadge />}
              <Feather
                name="chevron-right"
                size={18}
                color={colors.mutedForeground}
              />
            </View>
          </Pressable>
        </View>

        {managerId && (
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.card,
                borderRadius: colors.radius,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[styles.sectionTitle, { color: colors.mutedForeground }]}
            >
              Banter Leagues
            </Text>

            <Pressable
              onPress={openLeaguePicker}
              style={({ pressed }) => [
                styles.settingRow,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={styles.settingLeft}>
                <Feather
                  name="message-circle"
                  size={18}
                  color={savedLeagues.length > 0 ? "#22c55e" : colors.foreground}
                />
                <View>
                  <Text
                    style={[styles.settingLabel, { color: colors.foreground }]}
                  >
                    {savedLeagues.length > 0
                      ? `${savedLeagues.length} League${savedLeagues.length > 1 ? "s" : ""} Connected`
                      : "Connect Mini-Leagues"}
                  </Text>
                  <Text
                    style={[
                      styles.settingValue,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {savedLeagues.length > 0
                      ? savedLeagues.map((l) => l.mini_league_name).join(", ")
                      : "Select leagues for banter generation"}
                  </Text>
                </View>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
          </View>
        )}

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { color: colors.mutedForeground }]}
          >
            Coaching Mode
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Feather name="book-open" size={18} color={colors.accent} />
              <View>
                <Text
                  style={[styles.settingLabel, { color: colors.foreground }]}
                >
                  Beginner Coaching
                </Text>
                <Text
                  style={[
                    styles.settingValue,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {beginner.isBeginner
                    ? `${beginner.roundsCompleted} of 4 lessons completed`
                    : "Completed"}
                </Text>
              </View>
            </View>
            <Switch
              value={beginner.isBeginner}
              onValueChange={(val) => beginner.setBeginnerFlag(val)}
              trackColor={{ false: "#3e3e5e", true: colors.accent }}
              thumbColor="#ffffff"
            />
          </View>

          {!beginner.isBeginner && (
            <>
              <View style={[styles.legalDivider, { backgroundColor: colors.border }]} />
              <Pressable
                onPress={() => beginner.resetCoaching()}
                style={({ pressed }) => [
                  styles.settingRow,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={styles.settingLeft}>
                  <Feather name="rotate-ccw" size={18} color={colors.mutedForeground} />
                  <View>
                    <Text
                      style={[styles.settingLabel, { color: colors.foreground }]}
                    >
                      Restart Coaching
                    </Text>
                    <Text
                      style={[
                        styles.settingValue,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Start the beginner lessons from scratch
                    </Text>
                  </View>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </>
          )}
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { color: colors.mutedForeground }]}
          >
            Subscription
          </Text>

          {isPro ? (
            <View style={styles.aboutRow}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>
                {subscriptionType === "season_pass" ? "Season Pass" : "Pro Monthly"}
              </Text>
              <View style={[styles.activeBadge, { backgroundColor: "#22c55e20" }]}>
                <Text style={[styles.activeBadgeText, { color: "#22c55e" }]}>Active</Text>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setShowPaywall(true)}
              style={({ pressed }) => [
                styles.settingRow,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={styles.settingLeft}>
                <Feather name="zap" size={18} color="#4338ca" />
                <View>
                  <Text
                    style={[styles.settingLabel, { color: colors.foreground }]}
                  >
                    Upgrade to Pro
                  </Text>
                  <Text
                    style={[
                      styles.settingValue,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Unlock all features
                  </Text>
                </View>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
          )}
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { color: colors.mutedForeground }]}
          >
            Feedback
          </Text>

          <Pressable
            onPress={() => setShowFeedback(true)}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.settingLeft}>
              <Feather name="message-circle" size={18} color={colors.accent} />
              <View>
                <Text
                  style={[styles.settingLabel, { color: colors.foreground }]}
                >
                  Send Feedback
                </Text>
                <Text
                  style={[
                    styles.settingValue,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Bug reports, feature requests, vibe feedback
                </Text>
              </View>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { color: colors.mutedForeground }]}
          >
            Legal
          </Text>

          <Pressable
            onPress={() => Linking.openURL("https://superscout.pro/privacy")}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.settingLeft}>
              <Feather name="shield" size={18} color={colors.foreground} />
              <Text
                style={[styles.settingLabel, { color: colors.foreground }]}
              >
                Privacy Policy
              </Text>
            </View>
            <Feather
              name="external-link"
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>

          <View style={[styles.legalDivider, { backgroundColor: colors.border }]} />

          <Pressable
            onPress={() => Linking.openURL("https://superscout.pro/terms")}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.settingLeft}>
              <Feather name="file-text" size={18} color={colors.foreground} />
              <Text
                style={[styles.settingLabel, { color: colors.foreground }]}
              >
                Terms of Service
              </Text>
            </View>
            <Feather
              name="external-link"
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { color: colors.mutedForeground }]}
          >
            About
          </Text>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.foreground }]}>
              {config.brandName}
            </Text>
            <Text
              style={[styles.aboutValue, { color: colors.mutedForeground }]}
            >
              Phase 1
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderRadius: colors.radius,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { color: colors.mutedForeground }]}
          >
            Developer
          </Text>

          {__DEV__ && (
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Feather name="unlock" size={18} color="#8b5cf6" />
                <View>
                  <Text
                    style={[styles.settingLabel, { color: colors.foreground }]}
                  >
                    Dev Mode: Simulate Pro
                  </Text>
                  <Text
                    style={[styles.settingValue, { color: colors.mutedForeground }]}
                  >
                    {devSimulatePro ? "All Pro features unlocked" : "Free tier active"}
                  </Text>
                </View>
              </View>
              <Switch
                value={devSimulatePro}
                onValueChange={setDevSimulatePro}
                trackColor={{ false: "#3e3e5e", true: "#8b5cf6" }}
                thumbColor="#ffffff"
              />
            </View>
          )}

          <Pressable
            onPress={async () => {
              await AsyncStorage.multiRemove([
                ONBOARDING_COMPLETE_KEY,
                "superscout_manager_id",
                "superscout_team_name",
                PERSONA_KEY,
                "superscout_is_beginner",
                "superscout_beginner_rounds",
                "superscout_beginner_lessons",
              ]);
              if (Platform.OS === "web") {
                window.location.reload();
              }
            }}
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            <View style={styles.settingRowInner}>
              <Feather
                name="refresh-cw"
                size={18}
                color={colors.mutedForeground}
                style={styles.settingIcon}
              />
              <Text
                style={[styles.settingLabel, { color: colors.foreground }]}
              >
                Reset Onboarding
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>
      </ScrollView>

      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
      <FeedbackModal visible={showFeedback} onClose={() => setShowFeedback(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  section: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingVertical: 8,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  settingValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  changeText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginLeft: 8,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  aboutLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  aboutValue: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
  },
  settingRowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingIcon: {
    width: 20,
  },
  legalDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  fplConnectHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
  },
  leaguePickerHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  leagueLoadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyLeagueCard: {
    padding: 24,
    borderWidth: 1,
    alignItems: "center",
  },
  leagueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  leagueRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  leagueCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  saveLeagueBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  saveLeagueButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  saveLeagueText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1a472a",
  },
});
