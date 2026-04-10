import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useManagerId } from "@/hooks/useManagerId";
import { supabase } from "@/services/supabase";
import config from "@/constants/config";
import ChoosePersonaScreen, {
  PERSONAS,
} from "@/app/onboarding/ChoosePersonaScreen";
import ConnectFPLScreen from "@/app/onboarding/ConnectFPLScreen";
import { ONBOARDING_COMPLETE_KEY } from "@/app/onboarding/OnboardingFlow";
import type { Persona } from "@/app/onboarding/ChoosePersonaScreen";

const PERSONA_KEY = "superscout_persona";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [currentPersona, setCurrentPersona] = useState<Persona | null>(null);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [showFPLConnect, setShowFPLConnect] = useState(false);
  const { managerId, teamName, setManager } = useManagerId();

  useEffect(() => {
    AsyncStorage.getItem(PERSONA_KEY)
      .then((val) => {
        if (val === "expert" || val === "critic" || val === "fanboy") {
          setCurrentPersona(val);
        }
      })
      .catch(() => {});
  }, []);

  const handlePersonaChange = (persona: Persona) => {
    setCurrentPersona(persona);
    setShowPersonaPicker(false);

    AsyncStorage.setItem(PERSONA_KEY, persona).catch(() => {});

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (user) {
          supabase
            .from("users")
            .update({ default_persona: persona })
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

  if (showPersonaPicker) {
    return (
      <ChoosePersonaScreen
        onNext={handlePersonaChange}
        onCancel={() => setShowPersonaPicker(false)}
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

  const personaLabel =
    PERSONAS.find((p) => p.key === currentPersona)?.name ?? "Not set";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Platform.OS === "web" ? 67 + 16 : 16,
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
            onPress={() => setShowPersonaPicker(true)}
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
                  {personaLabel}
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
          <Pressable
            onPress={async () => {
              await AsyncStorage.multiRemove([
                ONBOARDING_COMPLETE_KEY,
                "superscout_manager_id",
                "superscout_team_name",
                PERSONA_KEY,
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
  fplConnectHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
  },
});
