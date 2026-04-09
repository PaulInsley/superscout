export interface BanterRules {
  onlyVibes: ("critic" | "fanboy")[];
  requiresTeam: boolean;
  frequency: string;
  selfMockAllowed: boolean;
  rivalryOverride: string;
  goodRunAcknowledge: boolean;
  badStreakCutoff: number;
  neverPunchDown: boolean;
  neverPersonal: boolean;
}

export const BANTER_RULES: BanterRules = {
  onlyVibes: ["critic", "fanboy"],
  requiresTeam: true,
  frequency: "roughly 1 in 3 or 4 responses — not every time",
  selfMockAllowed: true,
  rivalryOverride:
    "When the user's team is playing a rival, do NOT mock the user's team. Go heavier on the rival instead. The user wants SuperScout on their side for derby day.",
  goodRunAcknowledge: true,
  badStreakCutoff: 3,
  neverPunchDown: true,
  neverPersonal: true,
};

export const RIVALRY_MAP: Record<string, string[]> = {
  Arsenal: ["Tottenham", "Chelsea"],
  Tottenham: ["Arsenal", "Chelsea", "West Ham"],
  Chelsea: ["Arsenal", "Tottenham", "Fulham"],
  Liverpool: ["Everton", "Man United"],
  Everton: ["Liverpool"],
  "Man United": ["Liverpool", "Man City", "Leeds"],
  "Man City": ["Man United"],
  Newcastle: ["Sunderland"],
  "Aston Villa": ["Birmingham", "Wolves"],
  Wolves: ["Aston Villa", "West Brom"],
  "West Ham": ["Tottenham", "Millwall"],
  Leeds: ["Man United", "Sheffield United"],
  "Crystal Palace": ["Brighton"],
  Brighton: ["Crystal Palace"],
  Southampton: ["Portsmouth"],
  "Nottingham Forest": ["Derby", "Leicester"],
  Leicester: ["Nottingham Forest"],
  Fulham: ["Chelsea"],
  Bournemouth: ["Southampton"],
  Brentford: ["Fulham"],
  Ipswich: ["Norwich"],
};

export function getRivals(teamName: string): string[] {
  return RIVALRY_MAP[teamName] ?? [];
}

export function areRivals(teamA: string, teamB: string): boolean {
  const rivalsA = RIVALRY_MAP[teamA] ?? [];
  return rivalsA.some((r) => r.toLowerCase() === teamB.toLowerCase());
}

export function buildBanterContext(
  vibeKey: string,
  userTeamName: string | null,
  opponentTeamName: string | null,
  consecutiveRedArrows: number
): {
  useBanter: boolean;
  isRivalryMatch: boolean;
  protectUserTeam: boolean;
  suppressBanter: boolean;
  reason: string;
} {
  if (!BANTER_RULES.onlyVibes.includes(vibeKey as "critic" | "fanboy")) {
    return {
      useBanter: false,
      isRivalryMatch: false,
      protectUserTeam: false,
      suppressBanter: true,
      reason: "The Expert never uses team banter.",
    };
  }

  if (!userTeamName) {
    return {
      useBanter: false,
      isRivalryMatch: false,
      protectUserTeam: false,
      suppressBanter: true,
      reason: "User's supported team is unknown.",
    };
  }

  if (consecutiveRedArrows >= BANTER_RULES.badStreakCutoff) {
    return {
      useBanter: false,
      isRivalryMatch: false,
      protectUserTeam: false,
      suppressBanter: true,
      reason: `User has ${consecutiveRedArrows} consecutive red arrows. Banter suppressed.`,
    };
  }

  const isRivalryMatch =
    opponentTeamName != null && areRivals(userTeamName, opponentTeamName);

  return {
    useBanter: true,
    isRivalryMatch,
    protectUserTeam: isRivalryMatch,
    suppressBanter: false,
    reason: isRivalryMatch
      ? `Rivalry match: ${userTeamName} vs ${opponentTeamName}. Protect user's team, target the rival.`
      : "Standard banter available.",
  };
}
