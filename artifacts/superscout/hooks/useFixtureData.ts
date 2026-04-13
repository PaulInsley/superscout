import { useState, useEffect } from "react";
import { getBootstrapData, fetchFixtures } from "@/services/fpl/api";
import type { FPLTeam, FPLFixture } from "@/services/fpl/types";

export interface FixtureInfo {
  opponentShortName: string;
  isHome: boolean;
  fdr: number;
  event: number;
}

interface FixtureDataState {
  teams: Map<number, FPLTeam>;
  teamsByShortName: Map<string, FPLTeam>;
  fixtures: FPLFixture[];
  currentEvent: number;
  loaded: boolean;
}

let sharedState: FixtureDataState | null = null;
let loadingPromise: Promise<FixtureDataState> | null = null;

async function loadFixtureData(): Promise<FixtureDataState> {
  const [bootstrap, fixtures] = await Promise.all([getBootstrapData(), fetchFixtures()]);

  const teams = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const teamsByShortName = new Map(bootstrap.teams.map((t) => [t.short_name.toUpperCase(), t]));

  const currentEventObj = bootstrap.events.find((e) => e.is_current);
  const nextEventObj = bootstrap.events.find((e) => e.is_next);
  const currentEvent = (nextEventObj ?? currentEventObj)?.id ?? 1;

  return { teams, teamsByShortName, fixtures, currentEvent, loaded: true };
}

export function getUpcomingFixtures(
  teamShortName: string,
  state: FixtureDataState,
  count: number = 5,
): FixtureInfo[] {
  const team = state.teamsByShortName.get(teamShortName.toUpperCase());
  if (!team) return [];

  const teamId = team.id;
  const upcoming = state.fixtures
    .filter(
      (f) =>
        f.event != null &&
        f.event >= state.currentEvent &&
        !f.finished &&
        (f.team_h === teamId || f.team_a === teamId),
    )
    .sort((a, b) => (a.event ?? 0) - (b.event ?? 0));

  const result: FixtureInfo[] = [];
  for (const fix of upcoming) {
    if (result.length >= count) break;
    const isHome = fix.team_h === teamId;
    const opponentId = isHome ? fix.team_a : fix.team_h;
    const opponent = state.teams.get(opponentId);
    result.push({
      opponentShortName: opponent?.short_name ?? "???",
      isHome,
      fdr: isHome ? fix.team_h_difficulty : fix.team_a_difficulty,
      event: fix.event!,
    });
  }

  return result;
}

export function useFixtureData(): FixtureDataState | null {
  const [state, setState] = useState<FixtureDataState | null>(sharedState);

  useEffect(() => {
    if (sharedState) {
      setState(sharedState);
      return;
    }

    if (!loadingPromise) {
      loadingPromise = loadFixtureData().then((s) => {
        sharedState = s;
        return s;
      });
    }

    loadingPromise
      .then((s) => setState(s))
      .catch((err) => console.warn("[useFixtureData] load failed:", err));
  }, []);

  return state;
}
