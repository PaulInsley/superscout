import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { supabase } from "@/services/supabase";
import config from "@/constants/config";
import ChoosePersonaScreen, {
  PERSONAS,
} from "@/app/onboarding/ChoosePersonaScreen";
import type { Persona } from "@/app/onboarding/ChoosePersonaScreen";

const PERSONA_KEY = "superscout_persona";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [currentPersona, setCurrentPersona] = useState<Persona | null>(null);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);

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

  if (showPersonaPicker) {
    return (
      <ChoosePersonaScreen onNext={handlePersonaChange} isSettings />
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
            paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 84,
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
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
});
