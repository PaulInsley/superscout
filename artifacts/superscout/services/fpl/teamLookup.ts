import { Platform } from "react-native";

const FPL_DIRECT_URL = "https://fantasy.premierleague.com/api";

function getBaseUrl(): string {
  if (Platform.OS === "web") {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return `https://${domain}/api/fpl`;
  }
  return FPL_DIRECT_URL;
}

function getServerBaseUrl(): string {
  if (Platform.OS === "web") {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return `https://${domain}/api/fpl`;
  }
  return "https://superscout.pro/api/fpl";
}

export async function fetchTeamName(
  managerId: number,
): Promise<string | null> {
  try {
    const base = getBaseUrl();
    const url =
      Platform.OS === "web"
        ? `${base}/entry/${managerId}`
        : `${base}/entry/${managerId}/`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return data.name ?? null;
  } catch {
    return null;
  }
}

export interface SearchResult {
  manager_id: number;
  team_name: string;
  manager_name: string;
  rank: number;
  total_points: number;
}

export async function searchTeams(
  query: string,
  leagueId?: string,
): Promise<SearchResult[]> {
  try {
    const base = getServerBaseUrl();
    let url = `${base}/search?q=${encodeURIComponent(query)}`;
    if (leagueId) {
      url += `&league=${encodeURIComponent(leagueId)}`;
    }

    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}
