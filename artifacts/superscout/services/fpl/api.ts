import { Platform } from "react-native";
import type {
  FPLBootstrapResponse,
  FPLManagerInfo,
  FPLPicksResponse,
  FPLTransfer,
  FPLPlayer,
  FPLFixture,
  FPLLiveResponse,
  NormalizedPlayer,
  ManagerData,
  SquadPlayer,
  NormalizedTransfer,
  CaptainCandidate,
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
    name: element.second_name,
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

function getLastFinishedGameweek(data: FPLBootstrapResponse): number | null {
  const finished = data.events.filter((e) => e.finished);
  if (finished.length === 0) return null;
  return Math.max(...finished.map((e) => e.id));
}

function buildPlayerMap(elements: FPLPlayer[]): Map<number, FPLPlayer> {
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

  console.log("[SuperScout] Fetching manager info:", url);
  const response = await fetch(url);
  if (!response.ok) {
    console.log("[SuperScout] Manager info error:", response.status);
    if (response.status === 404) {
      throw new Error("MANAGER_NOT_FOUND");
    }
    throw new Error(`FPL API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("[SuperScout] Manager info loaded:", {
    name: data.name,
    started_event: data.started_event,
    entered_events: data.entered_events,
    summary_overall_points: data.summary_overall_points,
    summary_overall_rank: data.summary_overall_rank,
  });
  return data;
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

  console.log("[SuperScout] Fetching picks:", url);
  const response = await fetch(url);
  if (!response.ok) {
    console.log("[SuperScout] Picks error:", response.status, "for GW", gameweek);
    throw new Error(`FPL API error: ${response.status}`);
  }

  const data = await response.json();
  console.log("[SuperScout] Picks loaded for GW", gameweek, "- picks count:", data.picks?.length);
  return data;
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

async function tryFetchPicks(
  managerId: number,
  gameweeksToTry: number[]
): Promise<{ picks: FPLPicksResponse; gameweek: number } | null> {
  for (const gw of gameweeksToTry) {
    try {
      const picks = await fetchPicks(managerId, gw);
      return { picks, gameweek: gw };
    } catch {
      console.log("[SuperScout] No picks for GW", gw, "- trying next...");
    }
  }
  return null;
}

export async function fetchFixtures(): Promise<FPLFixture[]> {
  const base = getBaseUrl();
  const url =
    Platform.OS === "web"
      ? `${base}/fixtures`
      : `${base}/fixtures/`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FPL API error: ${response.status}`);
  }
  return response.json();
}

export async function fetchLiveGameweek(event: number): Promise<FPLLiveResponse> {
  const base = getBaseUrl();
  const url =
    Platform.OS === "web"
      ? `${base}/event/${event}/live`
      : `${base}/event/${event}/live/`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FPL API error: ${response.status}`);
  }
  return response.json();
}

export function getActiveGameweek(data: FPLBootstrapResponse): {
  gameweek: number;
  deadlineTime: string;
  isActive: boolean;
} {
  const current = data.events.find((e) => e.is_current);
  if (current) {
    return { gameweek: current.id, deadlineTime: current.deadline_time, isActive: true };
  }
  const next = data.events.find((e) => e.is_next);
  if (next) {
    return { gameweek: next.id, deadlineTime: next.deadline_time, isActive: true };
  }
  const last = data.events.filter((e) => e.finished).sort((a, b) => b.id - a.id)[0];
  if (last) {
    return { gameweek: last.id, deadlineTime: last.deadline_time, isActive: false };
  }
  return { gameweek: 1, deadlineTime: "", isActive: false };
}

export interface CaptainCandidateResult {
  candidates: CaptainCandidate[];
  gameweek: number;
  deadlineTime: string;
  noSquadData?: boolean;
  deadlinePassed?: boolean;
  seasonNotStarted?: boolean;
  activeChip?: string | null;
  gwType?: "normal" | "bgw" | "dgw" | "bgw_dgw";
  blankTeams?: string[];
  doubleTeams?: string[];
  doubleTeamIds?: number[];
  currentCaptain?: string | null;
}

export async function fetchCaptainCandidates(
  managerId: number,
): Promise<CaptainCandidateResult> {
  const bootstrapData = await getBootstrapData();
  const currentEvent = bootstrapData.events.find((e) => e.is_current);
  const nextEvent = bootstrapData.events.find((e) => e.is_next);
  const anyFinished = bootstrapData.events.some((e) => e.finished);

  if (!currentEvent && !nextEvent && !anyFinished) {
    const gw1 = bootstrapData.events.find((e) => e.id === 1);
    return {
      candidates: [],
      gameweek: 1,
      deadlineTime: gw1?.deadline_time ?? "",
      seasonNotStarted: true,
    };
  }

  const { gameweek, deadlineTime, isActive } = getActiveGameweek(bootstrapData);

  if (!isActive) {
    return { candidates: [], gameweek, deadlineTime, noSquadData: true };
  }

  const isDeadlinePassed = currentEvent && !currentEvent.finished && new Date(currentEvent.deadline_time) < new Date();
  const targetGw = isDeadlinePassed && nextEvent ? nextEvent.id : gameweek;
  const targetDeadline = isDeadlinePassed && nextEvent ? nextEvent.deadline_time : deadlineTime;

  const playerMap = buildPlayerMap(bootstrapData.elements);
  const teamMap = new Map(bootstrapData.teams.map((t) => [t.id, t]));

  let fixtures: FPLFixture[];
  try {
    fixtures = await fetchFixtures();
  } catch {
    return { candidates: [], gameweek: targetGw, deadlineTime: targetDeadline, noSquadData: true };
  }

  const gwFixtures = fixtures.filter((f) => f.event === targetGw);

  const teamFixtureCount = new Map<number, number>();
  for (const f of gwFixtures) {
    teamFixtureCount.set(f.team_h, (teamFixtureCount.get(f.team_h) ?? 0) + 1);
    teamFixtureCount.set(f.team_a, (teamFixtureCount.get(f.team_a) ?? 0) + 1);
  }

  const blankTeamIds = new Set<number>();
  const doubleTeamIds = new Set<number>();
  for (const team of bootstrapData.teams) {
    const count = teamFixtureCount.get(team.id) ?? 0;
    if (count === 0) blankTeamIds.add(team.id);
    if (count >= 2) doubleTeamIds.add(team.id);
  }

  const blankTeams = bootstrapData.teams.filter((t) => blankTeamIds.has(t.id)).map((t) => t.short_name);
  const doubleTeams = bootstrapData.teams.filter((t) => doubleTeamIds.has(t.id)).map((t) => t.short_name);
  const hasBlanks = blankTeams.length > 0;
  const hasDoubles = doubleTeams.length > 0;
  let gwType: "normal" | "bgw" | "dgw" | "bgw_dgw" = "normal";
  if (hasBlanks && hasDoubles) gwType = "bgw_dgw";
  else if (hasBlanks) gwType = "bgw";
  else if (hasDoubles) gwType = "dgw";

  const picksResult = await tryFetchPicks(managerId, [gameweek, gameweek - 1]);
  if (!picksResult) {
    return {
      candidates: [],
      gameweek: targetGw,
      deadlineTime: targetDeadline,
      noSquadData: true,
    };
  }

  const activeChip = picksResult.picks.active_chip ?? null;

  let currentCaptain: string | null = null;
  if (isDeadlinePassed) {
    const captainPick = picksResult.picks.picks.find((p) => p.is_captain);
    if (captainPick) {
      const player = playerMap.get(captainPick.element);
      if (player) currentCaptain = player.second_name;
    }
  }

  const candidates: CaptainCandidate[] = [];

  for (const pick of picksResult.picks.picks) {
    const player = playerMap.get(pick.element);
    if (!player) continue;

    const team = teamMap.get(player.team);
    const playerFixtures = gwFixtures.filter(
      (f) => f.team_h === player.team || f.team_a === player.team,
    );

    if (playerFixtures.length === 0) continue;

    const fixture = playerFixtures[0];
    const isHome = fixture.team_h === player.team;
    const opponentId = isHome ? fixture.team_a : fixture.team_h;
    const opponentTeam = teamMap.get(opponentId);
    const fdr = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty;

    candidates.push({
      id: player.id,
      name: player.second_name,
      firstName: player.first_name,
      team: team?.short_name ?? "UNK",
      teamId: player.team,
      position: POSITION_MAP[player.element_type] ?? "UNK",
      form: player.form,
      totalPoints: player.total_points,
      ownershipPct: parseFloat(player.selected_by_percent) || 0,
      price: player.now_cost / 10,
      opponent: `${opponentTeam?.short_name ?? "UNK"} (${isHome ? "H" : "A"})`,
      isHome,
      fixtureDifficulty: fdr,
      status: player.status,
      chanceOfPlaying: player.chance_of_playing_next_round,
      pickPosition: pick.position,
      isBench: pick.position >= 12,
    });
  }

  const surnameCounts = new Map<string, number>();
  for (const c of candidates) {
    surnameCounts.set(c.name, (surnameCounts.get(c.name) ?? 0) + 1);
  }
  for (const c of candidates) {
    if ((surnameCounts.get(c.name) ?? 0) > 1 && c.firstName) {
      c.name = `${c.firstName.charAt(0)}. ${c.name}`;
    }
  }

  return {
    candidates,
    gameweek: targetGw,
    deadlineTime: targetDeadline,
    ...(isDeadlinePassed && { deadlinePassed: true, currentCaptain }),
    ...(activeChip && { activeChip }),
    ...(gwType !== "normal" && {
      gwType,
      blankTeams,
      doubleTeams,
      doubleTeamIds: [...doubleTeamIds],
    }),
  };
}

export async function fetchManagerData(
  managerId: number
): Promise<ManagerData> {
  const bootstrapData = await getBootstrapData();
  const currentGw = getCurrentGameweek(bootstrapData);
  const lastFinishedGw = getLastFinishedGameweek(bootstrapData);
  const playerMap = buildPlayerMap(bootstrapData.elements);

  console.log("[SuperScout] Detected gameweeks - current:", currentGw, "lastFinished:", lastFinishedGw);

  const managerInfo = await fetchManagerInfo(managerId);
  const transfersData = await fetchTransfers(managerId);

  const hasEnteredEvents =
    managerInfo.entered_events && managerInfo.entered_events.length > 0;
  const isNewManager = !hasEnteredEvents;

  console.log("[SuperScout] Manager started_event:", managerInfo.started_event,
    "entered_events:", managerInfo.entered_events?.length ?? 0,
    "isNewManager:", isNewManager);

  let picksResult: { picks: FPLPicksResponse; gameweek: number } | null = null;

  if (!isNewManager) {
    const gameweeksToTry: number[] = [];

    if (managerInfo.entered_events && managerInfo.entered_events.length > 0) {
      const sortedEvents = [...managerInfo.entered_events].sort((a, b) => b - a);
      const relevantEvents = sortedEvents.filter((gw) => gw <= currentGw);
      gameweeksToTry.push(...relevantEvents.slice(0, 3));
    }

    if (gameweeksToTry.length === 0) {
      gameweeksToTry.push(currentGw);
      if (lastFinishedGw && lastFinishedGw !== currentGw) {
        gameweeksToTry.push(lastFinishedGw);
      }
      if (currentGw > 1) {
        gameweeksToTry.push(currentGw - 1);
      }
    }

    const uniqueGws = [...new Set(gameweeksToTry)];
    console.log("[SuperScout] Gameweeks to try for picks:", uniqueGws);

    picksResult = await tryFetchPicks(managerId, uniqueGws);
  } else {
    console.log("[SuperScout] New manager - no gameweeks entered yet, skipping picks fetch");
  }

  let squad: SquadPlayer[] = [];
  if (picksResult) {
    console.log("[SuperScout] Successfully loaded picks for GW", picksResult.gameweek);
    squad = picksResult.picks.picks.map((pick) => {
      const player = playerMap.get(pick.element);
      return {
        id: pick.element,
        name: player
          ? player.second_name
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
  } else {
    console.log("[SuperScout] No picks data available for any gameweek");
  }

  const recentTransfers = transfersData.slice(-10).reverse();
  const transfers: NormalizedTransfer[] = recentTransfers.map((t) => {
    const playerIn = playerMap.get(t.element_in);
    const playerOut = playerMap.get(t.element_out);
    return {
      event: t.event,
      playerIn: playerIn
        ? playerIn.second_name
        : `Player ${t.element_in}`,
      playerInCost: t.element_in_cost / 10,
      playerOut: playerOut
        ? playerOut.second_name
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
    currentGwPoints: picksResult?.picks.entry_history.points ?? null,
    gameweekLoaded: picksResult?.gameweek ?? null,
    isNewManager,
    squad,
    transfers,
    leagues: managerInfo.leagues.classic,
  };
}
