import { Platform } from "react-native";

const FPL_DIRECT_URL = "https://fantasy.premierleague.com/api";

function getBaseUrl(): string {
  if (Platform.OS === "web") {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return `https://${domain}/api/fpl`;
  }
  return FPL_DIRECT_URL;
}

export async function fetchTeamName(managerId: number): Promise<string | null> {
  try {
    const base = getBaseUrl();
    const url =
      Platform.OS === "web" ? `${base}/entry/${managerId}` : `${base}/entry/${managerId}/`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return data.name ?? null;
  } catch (err) {
    console.warn("[teamLookup] failed:", err);
    return null;
  }
}
