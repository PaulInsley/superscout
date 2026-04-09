import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Persona = "expert" | "critic" | "fanboy";

interface PersonaCard {
  key: Persona;
  name: string;
  description: string;
  example: string;
}

const PERSONAS: PersonaCard[] = [
  {
    key: "expert",
    name: "The Expert",
    description: "Measured, data-driven, always weighing the probabilities.",
    example:
      "Haaland carries the highest floor this week. City's xG against this defence averages 2.1 over the last four meetings. The ownership risk of not captaining him is as real as the risk of a blank.",
  },
  {
    key: "critic",
    name: "The Critic",
    description: "Sharp, honest, not afraid to tell you when you're wrong.",
    example:
      "City at home against that defence. If you don't captain Haaland here I genuinely cannot help you. This is the least interesting captain decision of the gameweek.",
  },
  {
    key: "fanboy",
    name: "The Fanboy",
    description: "Passionate, excitable, lives for the big differential pick.",
    example:
      "HAALAND. HOME. AGAINST THAT DEFENCE. The xG numbers are basically a cheat code right now and I need you to be excited about this because I absolutely am. This is the pick!!",
  },
];

interface Props {
  onNext: (persona: Persona) => void;
}

export default function ChoosePersonaScreen({ onNext }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Persona | null>(null);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingBottom: insets.bottom + 32,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          Choose Your Persona
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          How do you want your AI coach to talk to you?
        </Text>

        {PERSONAS.map((p) => {
          const isSelected = selected === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => setSelected(p.key)}
              style={[
                styles.card,
                {
                  backgroundColor: isSelected ? colors.secondary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text
                style={[
                  styles.personaName,
                  {
                    color: isSelected
                      ? colors.primary
                      : colors.foreground,
                  },
                ]}
              >
                {p.name}
              </Text>
              <Text
                style={[
                  styles.personaDesc,
                  { color: colors.mutedForeground },
                ]}
              >
                {p.description}
              </Text>
              <View
                style={[
                  styles.exampleBox,
                  {
                    backgroundColor: isSelected
                      ? colors.background
                      : colors.muted,
                    borderRadius: colors.radius - 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.exampleText,
                    { color: colors.foreground },
                  ]}
                >
                  "{p.example}"
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.bottomArea}>
        <Pressable
          onPress={() => selected && onNext(selected)}
          disabled={!selected}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: selected ? colors.primary : colors.muted,
              opacity: pressed && selected ? 0.9 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              {
                color: selected
                  ? colors.primaryForeground
                  : colors.mutedForeground,
              },
            ]}
          >
            This is my vibe
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  card: {
    padding: 16,
    borderWidth: 2,
    marginBottom: 14,
  },
  personaName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  personaDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
  },
  exampleBox: {
    padding: 12,
  },
  exampleText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    fontStyle: "italic",
  },
  bottomArea: {
    paddingBottom: 0,
  },
  button: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
});
