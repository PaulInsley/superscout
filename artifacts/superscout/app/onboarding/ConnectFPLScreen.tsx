import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { fetchTeamName, searchTeams } from "@/services/fpl";
import type { SearchResult } from "@/services/fpl";

interface Props {
  onNext: (managerId: number | null, teamName: string | null) => void;
}

type Mode = "search" | "id";

export default function ConnectFPLScreen({ onNext }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("search");

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [validatedId, setValidatedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [showLeagueField, setShowLeagueField] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [needsLeague, setNeedsLeague] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetState = useCallback(() => {
    setTeamName(null);
    setValidatedId(null);
    setError(null);
    setSearchResults([]);
    setHasSearched(false);
    setNeedsLeague(false);
    setSearchQuery("");
    setInput("");
    setLeagueId("");
    setShowLeagueField(false);
  }, []);

  const handleModeToggle = useCallback(
    (newMode: Mode) => {
      resetState();
      setMode(newMode);
    },
    [resetState],
  );

  const handleLookup = async () => {
    const id = Number(input.trim());
    if (!id || isNaN(id)) {
      setError("Please enter a valid number");
      return;
    }

    setLoading(true);
    setError(null);
    setTeamName(null);
    setValidatedId(null);

    const name = await fetchTeamName(id);
    setLoading(false);

    if (name) {
      setTeamName(name);
      setValidatedId(id);
    } else {
      setError("Couldn't find that manager ID — double-check the number");
    }
  };

  const doSearch = useCallback(
    async (q: string, league: string) => {
      setSearching(true);
      setHasSearched(true);
      setNeedsLeague(false);
      setTeamName(null);
      setValidatedId(null);

      const response = await searchTeams(q, league || undefined);
      setSearchResults(response.results);
      setNeedsLeague(response.needs_league ?? false);
      setSearching(false);
    },
    [],
  );

  useEffect(() => {
    if (mode !== "search") return;

    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      setNeedsLeague(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      doSearch(q, leagueId.trim());
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, mode, leagueId, doSearch]);

  const handleSelectResult = useCallback((result: SearchResult) => {
    setValidatedId(result.manager_id);
    setTeamName(result.team_name);
    setSearchResults([]);
  }, []);

  const renderSearchResult = useCallback(
    ({ item }: { item: SearchResult }) => (
      <Pressable
        onPress={() => handleSelectResult(item)}
        style={({ pressed }) => [
          styles.resultItem,
          {
            backgroundColor: pressed ? colors.secondary : colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.resultTeamName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {item.team_name}
          </Text>
          <Text
            style={[styles.resultManagerName, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {item.manager_name}
          </Text>
        </View>
        <View style={styles.resultMeta}>
          {item.rank > 0 && (
            <Text style={[styles.resultRank, { color: colors.mutedForeground }]}>
              #{item.rank.toLocaleString()}
            </Text>
          )}
          {item.total_points > 0 && (
            <Text style={[styles.resultPoints, { color: colors.accent }]}>
              {item.total_points.toLocaleString()} pts
            </Text>
          )}
        </View>
      </Pressable>
    ),
    [colors, handleSelectResult],
  );

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
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Connect Your FPL Team
        </Text>

        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => handleModeToggle("search")}
            style={[
              styles.modeButton,
              {
                backgroundColor:
                  mode === "search" ? colors.accent + "20" : "transparent",
                borderColor: mode === "search" ? colors.accent : colors.border,
              },
            ]}
          >
            <Feather
              name="search"
              size={14}
              color={mode === "search" ? colors.accent : colors.mutedForeground}
            />
            <Text
              style={[
                styles.modeButtonText,
                {
                  color:
                    mode === "search" ? colors.accent : colors.mutedForeground,
                },
              ]}
            >
              Search by name
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleModeToggle("id")}
            style={[
              styles.modeButton,
              {
                backgroundColor:
                  mode === "id" ? colors.accent + "20" : "transparent",
                borderColor: mode === "id" ? colors.accent : colors.border,
              },
            ]}
          >
            <Feather
              name="hash"
              size={14}
              color={mode === "id" ? colors.accent : colors.mutedForeground}
            />
            <Text
              style={[
                styles.modeButtonText,
                {
                  color:
                    mode === "id" ? colors.accent : colors.mutedForeground,
                },
              ]}
            >
              Enter ID
            </Text>
          </Pressable>
        </View>

        {mode === "id" ? (
          <>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Find it in the FPL app under Points {'>'} your name
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.input,
                    borderRadius: colors.radius,
                    color: colors.foreground,
                  },
                ]}
                value={input}
                onChangeText={(t) => {
                  setInput(t);
                  setTeamName(null);
                  setValidatedId(null);
                  setError(null);
                }}
                placeholder="e.g. 13042160"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                returnKeyType="go"
                onSubmitEditing={handleLookup}
              />
              <Pressable
                onPress={handleLookup}
                disabled={!input.trim() || loading}
                style={({ pressed }) => [
                  styles.lookupButton,
                  {
                    backgroundColor: input.trim()
                      ? colors.primary
                      : colors.muted,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primaryForeground}
                  />
                ) : (
                  <Text
                    style={[
                      styles.lookupText,
                      {
                        color: input.trim()
                          ? colors.primaryForeground
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    Find
                  </Text>
                )}
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Enter your team name or manager name
            </Text>

            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.input,
                  borderRadius: colors.radius,
                  color: colors.foreground,
                },
              ]}
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                setTeamName(null);
                setValidatedId(null);
                setError(null);
              }}
              placeholder="e.g. Superscouters or Paul Insley"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              returnKeyType="search"
            />

            {showLeagueField && (
              <View style={styles.leagueRow}>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                  Mini-league ID
                </Text>
                <TextInput
                  style={[
                    styles.leagueInput,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.input,
                      borderRadius: colors.radius,
                      color: colors.foreground,
                    },
                  ]}
                  value={leagueId}
                  onChangeText={(t) => {
                    setLeagueId(t);
                    setNeedsLeague(false);
                  }}
                  placeholder="e.g. 620"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                />
                <Text
                  style={[
                    styles.leagueHint,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Find it in the FPL app under Leagues {'>'} tap your league
                </Text>
              </View>
            )}

            {searching && (
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text
                  style={[
                    styles.searchingText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Searching...
                </Text>
              </View>
            )}

            {!searching &&
              needsLeague &&
              !showLeagueField &&
              searchQuery.trim().length >= 2 && (
                <View
                  style={[
                    styles.needsLeagueCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Feather name="info" size={16} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.needsLeagueText,
                        { color: colors.foreground },
                      ]}
                    >
                      The FPL API requires a mini-league to search by name.
                      Enter a league ID to find your team, or switch to Enter ID
                      if you know your manager number.
                    </Text>
                    <Pressable
                      onPress={() => setShowLeagueField(true)}
                      style={styles.addLeagueLink}
                    >
                      <Text
                        style={[
                          styles.addLeagueLinkText,
                          { color: colors.accent },
                        ]}
                      >
                        Add mini-league ID
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

            {!searching &&
              hasSearched &&
              !needsLeague &&
              searchResults.length === 0 &&
              !validatedId && (
                <View style={styles.noResults}>
                  <Text
                    style={[
                      styles.noResultsText,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    No teams found. Check the spelling, or try switching to
                    Enter ID.
                  </Text>
                </View>
              )}

            {searchResults.length > 0 && !validatedId && (
              <>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => String(item.manager_id)}
                  renderItem={renderSearchResult}
                  style={styles.resultsList}
                  keyboardShouldPersistTaps="handled"
                />
                {!showLeagueField && (
                  <Pressable
                    onPress={() => setShowLeagueField(true)}
                    style={styles.narrowLink}
                  >
                    <Text
                      style={[
                        styles.narrowLinkText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Search within a mini-league instead
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </>
        )}

        {error && (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        )}

        {teamName && validatedId && (
          <View
            style={[
              styles.confirmCard,
              {
                backgroundColor: colors.secondary,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="check-circle" size={20} color="#22c55e" />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.confirmText,
                  { color: colors.secondaryForeground },
                ]}
              >
                {teamName}
              </Text>
              <Text
                style={[styles.confirmId, { color: colors.mutedForeground }]}
              >
                Manager ID: {validatedId}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.bottomButtons}>
        {teamName && validatedId && (
          <Pressable
            onPress={() => onNext(validatedId, teamName)}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Text
              style={[styles.buttonText, { color: colors.primaryForeground }]}
            >
              That's my team
            </Text>
          </Pressable>
        )}
        <Pressable onPress={() => onNext(null, null)}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
            Skip for now
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  content: {
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  modeToggle: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  modeButtonText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  hint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
  },
  textInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  searchInput: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  leagueRow: {
    gap: 4,
  },
  leagueInput: {
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  leagueHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginTop: 4,
  },
  lookupButton: {
    height: 48,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  lookupText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  searchingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  searchingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  needsLeagueCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  needsLeagueText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  addLeagueLink: {
    marginTop: 8,
  },
  addLeagueLinkText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  noResults: {
    paddingVertical: 12,
  },
  noResultsText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  resultsList: {
    maxHeight: 200,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  resultTeamName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  resultManagerName: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  resultMeta: {
    alignItems: "flex-end",
    marginLeft: 12,
  },
  resultRank: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  resultPoints: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  narrowLink: {
    alignItems: "center",
    paddingVertical: 4,
  },
  narrowLinkText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "underline",
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  confirmCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  confirmText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  confirmId: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  bottomButtons: {
    gap: 16,
    alignItems: "center",
  },
  button: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  buttonText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  skipText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    paddingVertical: 8,
  },
});
