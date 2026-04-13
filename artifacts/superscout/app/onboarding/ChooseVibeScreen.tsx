import React, { useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export type Vibe = "expert" | "critic" | "fanboy";

interface VibeCard {
  key: Vibe;
  name: string;
  description: string;
  example: string;
}

export const VIBES: VibeCard[] = [
  {
    key: "expert",
    name: "The Expert",
    description: "Measured, data-driven, always weighing the probabilities.",
    example:
      "Haaland at home. City\u2019s expected goals against this defence averages 2.1 over the last four meetings. If he hauls and you\u2019ve captained someone else, that\u2019s your mini-league gone in a week.",
  },
  {
    key: "critic",
    name: "The Sarcastic Critic",
    description: "Sharp, honest, not afraid to tell you when you're wrong.",
    example:
      "City at home against that defence. You could captain Haaland, or you could pick someone else and spend the week explaining yourself in the group chat. Entirely your call.",
  },
  {
    key: "fanboy",
    name: "The OTT Fanboy",
    description: "Passionate, excitable, lives for the big differential pick.",
    example:
      "HAALAND. HOME. BRO. The numbers are literally a cheat code right now \u2014 this fixture is COOKED for defenders. If you\u2019re not doubling up on this I don\u2019t know what to tell you. Main character energy only!! \uD83D\uDD25",
  },
];

interface Props {
  onNext: (vibe: Vibe) => void;
  onCancel?: () => void;
  isSettings?: boolean;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const CAROUSEL_ITEM_WIDTH = SCREEN_WIDTH - 48;

export default function ChooseVibeScreen({ onNext, onCancel, isSettings }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Vibe | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleCarouselScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / CAROUSEL_ITEM_WIDTH);
    if (idx >= 0 && idx < VIBES.length) {
      setCarouselIndex(idx);
    }
  };

  const goToSlide = (idx: number) => {
    flatListRef.current?.scrollToIndex({ index: idx, animated: true });
    setCarouselIndex(idx);
  };

  const renderCardView = () => (
    <View style={styles.cardViewContainer}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isSettings && onCancel && (
          <Pressable onPress={onCancel} accessibilityLabel="Go back" accessibilityRole="button" style={styles.backButton}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
            <Text style={[styles.backText, { color: colors.foreground }]}>Back</Text>
          </Pressable>
        )}
        <Text style={[styles.title, { color: colors.foreground }]}>Choose Your Vibe</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          How do you want your AI coach to sound?
        </Text>
        <Pressable
          onPress={() => setPreviewMode(true)}
          accessibilityLabel="Try all three vibes"
          accessibilityRole="button"
          style={[
            styles.tryAllButton,
            {
              borderColor: colors.primary,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name="repeat" size={16} color={colors.primary} />
          <Text style={[styles.tryAllText, { color: colors.primary }]}>Try all three</Text>
        </Pressable>

        {VIBES.map((p) => {
          const isSelected = selected === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => setSelected(p.key)}
              accessibilityLabel={`Select ${p.name} vibe`}
              accessibilityRole="button"
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
                  styles.vibeName,
                  {
                    color: isSelected ? colors.primary : colors.foreground,
                  },
                ]}
              >
                {p.name}
              </Text>
              <Text style={[styles.vibeDesc, { color: colors.mutedForeground }]}>
                {p.description}
              </Text>
              <View
                style={[
                  styles.exampleBox,
                  {
                    backgroundColor: isSelected ? colors.background : colors.muted,
                    borderRadius: colors.radius - 2,
                  },
                ]}
              >
                <Text style={[styles.exampleText, { color: colors.foreground }]}>
                  "{p.example}"
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.floatingButtonContainer,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {selected && !isSettings && (
          <Text style={[styles.changeAnytime, { color: colors.mutedForeground }]}>
            You can change this anytime in Settings
          </Text>
        )}
        <Pressable
          onPress={() => selected && onNext(selected)}
          disabled={!selected}
          accessibilityLabel={isSettings ? "Save vibe" : "This is my vibe"}
          accessibilityRole="button"
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
                color: selected ? colors.primaryForeground : colors.mutedForeground,
              },
            ]}
          >
            {isSettings ? "Save vibe" : "This is my vibe"}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderCarouselView = () => {
    const current = VIBES[carouselIndex];
    return (
      <View style={styles.carouselContainer}>
        <View style={styles.carouselHeader}>
          <Pressable onPress={() => setPreviewMode(false)} accessibilityLabel="Go back" accessibilityRole="button">
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground, flex: 1, textAlign: "center" }]}>
            Compare Vibes
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={[styles.scenarioLabel, { color: colors.mutedForeground }]}>
          Scenario: "Who should I captain this week?"
        </Text>

        <FlatList
          ref={flatListRef}
          data={VIBES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleCarouselScroll}
          keyExtractor={(item) => item.key}
          getItemLayout={(_data, index) => ({
            length: CAROUSEL_ITEM_WIDTH,
            offset: CAROUSEL_ITEM_WIDTH * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={[styles.carouselSlide, { width: CAROUSEL_ITEM_WIDTH }]}>
              <View
                style={[
                  styles.carouselCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Text style={[styles.carouselVibeName, { color: colors.primary }]}>
                  {item.name}
                </Text>
                <Text style={[styles.carouselVibeDesc, { color: colors.mutedForeground }]}>
                  {item.description}
                </Text>
                <View
                  style={[
                    styles.carouselExampleBox,
                    {
                      backgroundColor: colors.muted,
                      borderRadius: colors.radius - 2,
                    },
                  ]}
                >
                  <Text style={[styles.carouselExampleText, { color: colors.foreground }]}>
                    "{item.example}"
                  </Text>
                </View>
              </View>
            </View>
          )}
        />

        <View style={styles.dots}>
          {VIBES.map((p, i) => (
            <Pressable key={p.key} onPress={() => goToSlide(i)} accessibilityLabel={`Go to ${p.name}`} accessibilityRole="button">
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === carouselIndex ? colors.primary : colors.border,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.carouselBottom}>
          <Pressable
            onPress={() => onNext(current.key)}
            accessibilityLabel={`Choose ${current.name}`}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
              Choose this one
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingBottom: 0,
          paddingTop: isSettings ? 20 : 80,
        },
      ]}
    >
      {previewMode ? renderCarouselView() : renderCardView()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  cardViewContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  floatingButtonContainer: {
    paddingTop: 12,
    paddingHorizontal: 0,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  tryAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  tryAllText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  changeAnytime: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 8,
  },
  card: {
    padding: 16,
    borderWidth: 2,
    marginBottom: 14,
  },
  vibeName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  vibeDesc: {
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
  carouselContainer: {
    flex: 1,
  },
  carouselHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  scenarioLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    fontStyle: "italic",
    marginBottom: 16,
    textAlign: "center",
  },
  carouselSlide: {
    justifyContent: "center",
  },
  carouselCard: {
    padding: 20,
    borderWidth: 1,
    marginHorizontal: 0,
  },
  carouselVibeName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  carouselVibeDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  carouselExampleBox: {
    padding: 16,
  },
  carouselExampleText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    fontStyle: "italic",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  carouselBottom: {
    marginTop: "auto",
    paddingTop: 12,
  },
});
