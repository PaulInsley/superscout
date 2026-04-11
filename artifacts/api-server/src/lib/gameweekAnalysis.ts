interface FPLFixture {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  started: boolean;
  finished: boolean;
}

interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
}

export interface GameweekAnalysis {
  gameweek: number;
  type: "normal" | "bgw" | "dgw" | "bgw_dgw";
  blankTeams: FPLTeam[];
  doubleTeams: FPLTeam[];
  blankTeamIds: Set<number>;
  doubleTeamIds: Set<number>;
  promptContext: string;
}

export function analyseGameweek(
  gameweek: number,
  fixtures: FPLFixture[],
  allTeams: FPLTeam[],
): GameweekAnalysis {
  const gwFixtures = fixtures.filter((f) => f.event === gameweek);

  const teamFixtureCount = new Map<number, number>();
  for (const f of gwFixtures) {
    teamFixtureCount.set(f.team_h, (teamFixtureCount.get(f.team_h) ?? 0) + 1);
    teamFixtureCount.set(f.team_a, (teamFixtureCount.get(f.team_a) ?? 0) + 1);
  }

  const blankTeamIds = new Set<number>();
  const doubleTeamIds = new Set<number>();

  for (const team of allTeams) {
    const count = teamFixtureCount.get(team.id) ?? 0;
    if (count === 0) blankTeamIds.add(team.id);
    if (count >= 2) doubleTeamIds.add(team.id);
  }

  const blankTeams = allTeams.filter((t) => blankTeamIds.has(t.id));
  const doubleTeams = allTeams.filter((t) => doubleTeamIds.has(t.id));

  const hasBlanks = blankTeams.length > 0;
  const hasDoubles = doubleTeams.length > 0;

  let type: GameweekAnalysis["type"] = "normal";
  if (hasBlanks && hasDoubles) type = "bgw_dgw";
  else if (hasBlanks) type = "bgw";
  else if (hasDoubles) type = "dgw";

  const promptParts: string[] = [];

  if (hasBlanks) {
    const names = blankTeams.map((t) => t.short_name).join(", ");
    promptParts.push(
      `BLANK GAMEWEEK ALERT: This is a blank gameweek. The following teams do NOT play in GW${gameweek}: ${names}. Do NOT recommend any players from these teams — they will score 0 points.`,
    );
  }

  if (hasDoubles) {
    const names = doubleTeams.map((t) => t.short_name).join(", ");
    promptParts.push(
      `DOUBLE GAMEWEEK ALERT: The following teams play TWICE in GW${gameweek}: ${names}. Players from these teams have higher expected points ceilings due to two fixtures. Heavily favour double-gameweek players in your recommendations.`,
    );
  }

  return {
    gameweek,
    type,
    blankTeams,
    doubleTeams,
    blankTeamIds,
    doubleTeamIds,
    promptContext: promptParts.join("\n\n"),
  };
}
