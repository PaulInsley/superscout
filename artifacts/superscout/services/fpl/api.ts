import { Platform } from "react-native";
import type { FPLBootstrapResponse, NormalizedPlayer } from "./types";

const FPL_DIRECT_URL = "https://fantasy.premierleague.com/api";

function getBootstrapUrl(): string {
  if (Platform.OS === "web") {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return `https://${domain}/api/fpl/bootstrap-static`;
  }
  return `${FPL_DIRECT_URL}/bootstrap-static/`;
}

export async function fetchPlayers(): Promise<NormalizedPlayer[]> {
  const url = getBootstrapUrl();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`FPL API error: ${response.status}`);
  }

  const data: FPLBootstrapResponse = await response.json();

  const players: NormalizedPlayer[] = data.elements.map((element) => ({
    id: element.id,
    name: `${element.first_name} ${element.second_name}`,
    price: element.now_cost / 10,
    form: element.form,
  }));

  players.sort((a, b) => b.price - a.price);

  return players;
}
