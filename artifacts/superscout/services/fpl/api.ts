import { Platform } from "react-native";
import type {
  FPLBootstrapResponse,
  FPLManagerInfo,
  FPLPicksResponse,
  FPLTransfer,
  FPLPlayer,
  NormalizedPlayer,
  ManagerData,
  SquadPlayer,
  NormalizedTransfer,
} from "./types";

const FPL_DIRECT_URL = "https://fantasy.premierleague.com/api";

function getBaseUrl(): string {
  if (Platform.OS === "web") {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return `https://${domain}/api/fpl`;
  }
  return FPL_DIRECT_URL;
}

const POSITION_MAP: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

let cachedBootstrap: FPLBootstrapResponse | null = null;

async function getBootstrapData(): Promise<FPLBootstrapResponse> {
  if (cachedBootstrap) return cachedBootstrap;

  const base = getBaseUrl();
  const url =
    Platform.OS === "web"
      ? `${base}/bootstrap-static`
      : `${base}/bootstrap-static/`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FPL API error: ${response.status}`);
  }

  cachedBootstrap = await response.json();
  return cachedBootstrap!;
}

export function clearBootstrapCache(): void {
  cachedBootstrap = null;
}

export async function fetchPlayers(): Promise<NormalizedPlayer[]> {
  const data = await getBootstrapData();

  const players: NormalizedPlayer[] = data.elements.map((element) => ({
    id: element.id,
    name: `${element.first_name} ${element.second_name}`,
    price: element.now_cost / 10,
    form: element.form,
  }));

  players.sort((a, b) => b.price - a.price);

  return players;
}

function getCurrentGameweek(data: FPLBootstrapResponse): number {
  const current = data.events.find((e) => e.is_current);
  if (current) return current.id;

  const next = data.events.find((e) => e.is_next);
  if (next && next.id > 1) return next.id - 1;

  return 1;
}

function buildPlayerMap(
  elements: FPLPlayer[]
): Map<number, FPLPlayer> {
  const map = new Map<number, FPLPlayer>();
  for (const el of elements) {
    map.set(el.id, el);
  }
  return map;
}

async function fetchManagerInfo(managerId: number): Promise<FPLManagerInfo> {
  const base = getBaseUrl();
  const url =
    Platform.OS === "web"
      ? `${base}/entry/${managerId}`
      : `${base}/entry/${managerId}/`;

  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("MANAGER_NOT_FOUND");
    }
    throw new Error(`FPL API error: ${response.status}`);
  }

  return response.json();
}

async function fetchPicks(
  managerId: number,
  gameweek: number
): Promise<FPLPicksResponse> {
  const base = getBaseUrl();
  const url =
    Platform.OS === "web"
      ? `${base}/entry/${managerId}/event/${gameweek}/picks`
      : `${base}/entry/${managerId}/event/${gameweek}/picks/`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FPL API error: ${response.status}`);
  }

  return response.json();
}

async function fetchTransfers(managerId: number): Promise<FPLTransfer[]> {
  const base = getBaseUrl();
  const url =
    Platform.OS === "web"
      ? `${base}/entry/${managerId}/transfers`
      : `${base}/entry/${managerId}/transfers/`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FPL API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchManagerData(
  managerId: number
): Promise<ManagerData> {
  const bootstrapData = await getBootstrapData();
  const currentGw = getCurrentGameweek(bootstrapData);
  const playerMap = buildPlayerMap(bootstrapData.elements);

  const managerInfo = await fetchManagerInfo(managerId);
  const transfersData = await fetchTransfers(managerId);

  let picksData: FPLPicksResponse | null = null;
  try {
    picksData = await fetchPicks(managerId, currentGw);
  } catch {
    // Manager may not have picks for this gameweek (new manager, etc.)
  }

  let squad: SquadPlayer[] = [];
  if (picksData) {
    squad = picksData.picks.map((pick) => {
      const player = playerMap.get(pick.element);
      return {
        id: pick.element,
        name: player
          ? `${player.first_name} ${player.second_name}`
          : `Player ${pick.element}`,
        position: player
          ? (POSITION_MAP[player.element_type] ?? "UNK")
          : "UNK",
        price: player ? player.now_cost / 10 : 0,
        form: player ? player.form : "0.0",
        isCaptain: pick.is_captain,
        isViceCaptain: pick.is_vice_captain,
        isBench: pick.position >= 12,
        pickPosition: pick.position,
      };
    });

    squad.sort((a, b) => a.pickPosition - b.pickPosition);
  }

  const recentTransfers = transfersData.slice(-10).reverse();
  const transfers: NormalizedTransfer[] = recentTransfers.map((t) => {
    const playerIn = playerMap.get(t.element_in);
    const playerOut = playerMap.get(t.element_out);
    return {
      event: t.event,
      playerIn: playerIn
        ? `${playerIn.first_name} ${playerIn.second_name}`
        : `Player ${t.element_in}`,
      playerInCost: t.element_in_cost / 10,
      playerOut: playerOut
        ? `${playerOut.first_name} ${playerOut.second_name}`
        : `Player ${t.element_out}`,
      playerOutCost: t.element_out_cost / 10,
      time: t.time,
    };
  });

  return {
    teamName: managerInfo.name,
    managerName: `${managerInfo.player_first_name} ${managerInfo.player_last_name}`,
    overallPoints: managerInfo.summary_overall_points,
    overallRank: managerInfo.summary_overall_rank,
    currentGwPoints: picksData?.entry_history.points ?? null,
    squad,
    transfers,
    leagues: managerInfo.leagues.classic,
  };
}
