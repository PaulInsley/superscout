interface FPLPlayer {
  id: number;
  first_name: string;
  second_name: string;
  web_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  status: string;
  chance_of_playing_next_round: number | null;
}

interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
}

interface FPLFixture {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  started: boolean;
  finished: boolean;
}

interface HallucinationContext {
  players: FPLPlayer[];
  teams: FPLTeam[];
  fixtures: FPLFixture[];
  gameweek: number;
  squadPlayerNames?: Set<string>;
  logger?: {
    warn: (obj: Record<string, unknown>, msg: string) => void;
    info: (obj: Record<string, unknown>, msg: string) => void;
  };
}

interface HallucinationResult {
  removedCount: number;
  correctedCount: number;
  flaggedStats: string[];
  warnings: string[];
}

interface CaptainRecommendation {
  player_name?: string;
  team?: string;
  opponent?: string;
  expected_points?: number;
  confidence?: string;
  ownership_pct?: number;
  upside?: string;
  risk?: string;
  case?: string;
  is_superscout_pick?: boolean;
  [key: string]: unknown;
}

interface TransferRecommendation {
  player_out?: string;
  player_out_team?: string;
  player_in?: string;
  player_in_team?: string;
  is_package?: boolean;
  is_hold_recommendation?: boolean;
  transfers?: Array<{
    player_out?: string;
    player_out_team?: string;
    player_in?: string;
    player_in_team?: string;
    [key: string]: unknown;
  }>;
  case?: string;
  [key: string]: unknown;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function fuzzyPlayerMatch(name: string, players: FPLPlayer[]): FPLPlayer | null {
  if (!name) return null;
  const norm = normalize(name);

  for (const p of players) {
    if (normalize(p.web_name) === norm) return p;
    if (normalize(p.second_name) === norm) return p;
    if (normalize(`${p.first_name} ${p.second_name}`) === norm) return p;
    const initialForm = `${p.first_name.charAt(0)}. ${p.second_name}`;
    if (normalize(initialForm) === norm) return p;
  }

  for (const p of players) {
    const webNorm = normalize(p.web_name);
    const surnameNorm = normalize(p.second_name);
    const fullNorm = normalize(`${p.first_name} ${p.second_name}`);

    if (webNorm.includes(norm) || norm.includes(webNorm)) return p;
    if (surnameNorm.includes(norm) || norm.includes(surnameNorm)) return p;
    if (fullNorm.includes(norm) || norm.includes(fullNorm)) return p;
  }

  const normTokens = norm.split(/\s+/);
  if (normTokens.length >= 1) {
    const lastToken = normTokens[normTokens.length - 1];
    if (lastToken.length >= 3) {
      const matches = players.filter((p) => normalize(p.second_name) === lastToken);
      if (matches.length === 1) return matches[0];
    }
  }

  return null;
}

function fuzzyTeamMatch(name: string, teams: FPLTeam[]): FPLTeam | null {
  if (!name) return null;
  const norm = normalize(name);

  for (const t of teams) {
    if (normalize(t.short_name) === norm) return t;
    if (normalize(t.name) === norm) return t;
  }

  for (const t of teams) {
    const shortNorm = normalize(t.short_name);
    const fullNorm = normalize(t.name);
    if (shortNorm.includes(norm) || norm.includes(shortNorm)) return t;
    if (fullNorm.includes(norm) || norm.includes(fullNorm)) return t;
  }

  return null;
}

function extractStatClaims(text: string): string[] {
  if (!text) return [];
  const patterns = [
    /\b\d+\s+(?:goals?|assists?|clean sheets?|returns?)\s+in\s+(?:the\s+)?(?:last|past|previous)\s+\d+/gi,
    /\bscored\s+in\s+\d+\s+of\s+(?:the\s+)?(?:last|past)\s+\d+/gi,
    /\b\d+\s+(?:goals?|assists?|bonus)\s+(?:from|in)\s+\d+\s+(?:games?|matches?|appearances?|starts?)/gi,
    /\bblank(?:ed)?\s+(?:in\s+)?\d+\s+(?:consecutive|straight)\b/gi,
    /\b(?:highest|top)\s+(?:scoring|owned|transferred)\s+(?:player|defender|midfielder|forward|keeper)\b/gi,
    /\baveraging\s+[\d.]+\s+(?:points?|bps)\s+(?:per|over)\b/gi,
  ];

  const claims: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) claims.push(...matches);
  }
  return claims;
}

function verifyFixture(
  teamName: string,
  opponentStr: string,
  ctx: HallucinationContext,
): { valid: boolean; corrected?: string } {
  const team = fuzzyTeamMatch(teamName, ctx.teams);
  if (!team) return { valid: false };

  const opponentMatch = opponentStr.match(/^(.+?)\s*\(([HA])\)\s*$/i);
  const opponentName = opponentMatch ? opponentMatch[1].trim() : opponentStr;
  const claimedVenue = opponentMatch ? opponentMatch[2].toUpperCase() : null;

  const opponent = fuzzyTeamMatch(opponentName, ctx.teams);
  if (!opponent) return { valid: false };

  const relevantGws = [ctx.gameweek, ctx.gameweek + 1, ctx.gameweek + 2];
  const fixture = ctx.fixtures.find(
    (f) =>
      f.event !== null &&
      relevantGws.includes(f.event) &&
      ((f.team_h === team.id && f.team_a === opponent.id) ||
        (f.team_a === team.id && f.team_h === opponent.id)),
  );

  if (!fixture) {
    return { valid: false };
  }

  const isHome = fixture.team_h === team.id;
  const correctVenue = isHome ? "H" : "A";

  if (claimedVenue && claimedVenue !== correctVenue) {
    const corrected = `${opponent.short_name} (${correctVenue})`;
    return { valid: true, corrected };
  }

  return { valid: true };
}

export function checkCaptainHallucinations(
  recommendations: CaptainRecommendation[],
  ctx: HallucinationContext,
): { filtered: CaptainRecommendation[]; result: HallucinationResult } {
  const result: HallucinationResult = {
    removedCount: 0,
    correctedCount: 0,
    flaggedStats: [],
    warnings: [],
  };

  const filtered: CaptainRecommendation[] = [];

  for (const rec of recommendations) {
    const playerName = String(rec.player_name ?? "");
    const teamName = String(rec.team ?? "");

    const player = fuzzyPlayerMatch(playerName, ctx.players);
    if (!player) {
      result.removedCount++;
      result.warnings.push(`Player "${playerName}" not found in FPL data — removed`);
      ctx.logger?.warn({ playerName }, "Hallucination: captain player not found");
      continue;
    }

    const team = fuzzyTeamMatch(teamName, ctx.teams);
    if (!team) {
      result.removedCount++;
      result.warnings.push(`Team "${teamName}" not found — removed`);
      ctx.logger?.warn({ teamName, playerName }, "Hallucination: captain team not found");
      continue;
    }

    if (player.team !== team.id) {
      const actualTeam = ctx.teams.find((t) => t.id === player.team);
      if (actualTeam) {
        result.correctedCount++;
        result.warnings.push(
          `Player "${playerName}" is on ${actualTeam.short_name}, not ${teamName} — corrected`,
        );
        ctx.logger?.warn(
          { playerName, claimed: teamName, actual: actualTeam.short_name },
          "Hallucination: player-team mismatch corrected",
        );
        rec.team = actualTeam.short_name;
      }
    }

    if (rec.opponent) {
      const actualTeamName = String(rec.team);
      const fixtureCheck = verifyFixture(actualTeamName, String(rec.opponent), ctx);
      if (!fixtureCheck.valid) {
        result.warnings.push(
          `Fixture "${actualTeamName} vs ${rec.opponent}" not found in upcoming GWs — correcting`,
        );
        ctx.logger?.warn(
          { teamName: actualTeamName, opponent: rec.opponent },
          "Hallucination: fixture mismatch",
        );
        const gwFixtures = ctx.fixtures.filter(
          (f) => f.event === ctx.gameweek && (f.team_h === player.team || f.team_a === player.team),
        );
        if (gwFixtures.length > 0) {
          const fx = gwFixtures[0];
          const isHome = fx.team_h === player.team;
          const oppTeam = ctx.teams.find((t) => t.id === (isHome ? fx.team_a : fx.team_h));
          if (oppTeam) {
            rec.opponent = `${oppTeam.short_name} (${isHome ? "H" : "A"})`;
            result.correctedCount++;
          }
        }
      } else if (fixtureCheck.corrected) {
        rec.opponent = fixtureCheck.corrected;
        result.correctedCount++;
        result.warnings.push(`Venue corrected for ${playerName}: ${fixtureCheck.corrected}`);
      }
    }

    if (rec.lineup_changes && Array.isArray(rec.lineup_changes)) {
      const validChanges: Array<Record<string, unknown>> = [];
      for (const change of rec.lineup_changes as Array<Record<string, unknown>>) {
        const playerInName = String(change.player_in ?? "");
        const playerOutName = String(change.player_out ?? "");
        const playersToCheck = ctx.squadPlayerNames
          ? ctx.players.filter(
              (p) =>
                ctx.squadPlayerNames!.has(normalize(p.second_name)) ||
                ctx.squadPlayerNames!.has(normalize(p.web_name)),
            )
          : ctx.players;
        const playerIn = playerInName
          ? fuzzyPlayerMatch(playerInName, playersToCheck.length > 0 ? playersToCheck : ctx.players)
          : null;
        const playerOut = playerOutName
          ? fuzzyPlayerMatch(
              playerOutName,
              playersToCheck.length > 0 ? playersToCheck : ctx.players,
            )
          : null;
        if (!playerIn && playerInName) {
          result.warnings.push(
            `Lineup change player_in "${playerInName}" not found in squad — removed change`,
          );
          ctx.logger?.warn(
            { playerInName, playerName },
            "Hallucination: lineup_changes player_in not in squad",
          );
          continue;
        }
        if (!playerOut && playerOutName) {
          result.warnings.push(
            `Lineup change player_out "${playerOutName}" not found in squad — removed change`,
          );
          ctx.logger?.warn(
            { playerOutName, playerName },
            "Hallucination: lineup_changes player_out not in squad",
          );
          continue;
        }
        validChanges.push(change);
      }
      rec.lineup_changes = validChanges.length > 0 ? validChanges : undefined;
      if (!rec.lineup_changes) {
        rec.lineup_note = undefined;
      }
    }

    if (rec.is_on_bench && !rec.lineup_changes) {
      rec.lineup_note = "Move this player into your starting XI before setting as captain";
      ctx.logger?.warn({ playerName }, "Bench captain missing lineup_changes — added generic note");
    }

    const caseText = String(rec.case ?? "");
    const upsideText = String(rec.upside ?? "");
    const riskText = String(rec.risk ?? "");
    const allText = `${caseText} ${upsideText} ${riskText}`;
    const statClaims = extractStatClaims(allText);
    if (statClaims.length > 0) {
      result.flaggedStats.push(...statClaims.map((s) => `[${playerName}] ${s}`));
      ctx.logger?.info(
        { playerName, statClaims },
        "Hallucination check: stat claims flagged for review",
      );
    }

    filtered.push(rec);
  }

  return { filtered, result };
}

export function checkTransferHallucinations(
  recommendations: TransferRecommendation[],
  ctx: HallucinationContext,
): { filtered: TransferRecommendation[]; result: HallucinationResult } {
  const result: HallucinationResult = {
    removedCount: 0,
    correctedCount: 0,
    flaggedStats: [],
    warnings: [],
  };

  const filtered: TransferRecommendation[] = [];

  function checkPlayerAndTeam(playerName: string, teamName: string, label: string): boolean {
    if (!playerName) return true;

    const player = fuzzyPlayerMatch(playerName, ctx.players);
    if (!player) {
      result.warnings.push(`${label} player "${playerName}" not found in FPL data — removed`);
      ctx.logger?.warn({ playerName, label }, "Hallucination: transfer player not found");
      return false;
    }

    if (teamName) {
      const team = fuzzyTeamMatch(teamName, ctx.teams);
      if (!team) {
        result.warnings.push(`${label} team "${teamName}" not found — removed`);
        ctx.logger?.warn({ teamName, playerName, label }, "Hallucination: transfer team not found");
        return false;
      }

      if (player.team !== team.id) {
        const actualTeam = ctx.teams.find((t) => t.id === player.team);
        if (actualTeam) {
          result.correctedCount++;
          result.warnings.push(
            `${label} "${playerName}" is on ${actualTeam.short_name}, not ${teamName} — corrected`,
          );
          ctx.logger?.warn(
            { playerName, claimed: teamName, actual: actualTeam.short_name, label },
            "Hallucination: transfer player-team mismatch corrected",
          );
          return { correctedTeam: actualTeam.short_name };
        }
      }
    }

    return true;
  }

  for (const rec of recommendations) {
    if (rec.is_hold_recommendation) {
      filtered.push(rec);
      continue;
    }

    let valid = true;

    if (rec.is_package && Array.isArray(rec.transfers)) {
      for (const swap of rec.transfers) {
        const outOk = checkPlayerAndTeam(
          String(swap.player_out ?? ""),
          String(swap.player_out_team ?? ""),
          "Package player_out",
        );
        if (outOk === false) {
          valid = false;
          break;
        }
        if (typeof outOk === "object" && outOk.correctedTeam)
          swap.player_out_team = outOk.correctedTeam;

        const inOk = checkPlayerAndTeam(
          String(swap.player_in ?? ""),
          String(swap.player_in_team ?? ""),
          "Package player_in",
        );
        if (inOk === false) {
          valid = false;
          break;
        }
        if (typeof inOk === "object" && inOk.correctedTeam)
          swap.player_in_team = inOk.correctedTeam;
      }
    } else {
      const outOk = checkPlayerAndTeam(
        String(rec.player_out ?? ""),
        String(rec.player_out_team ?? ""),
        "player_out",
      );
      if (outOk === false) valid = false;
      else if (typeof outOk === "object" && outOk.correctedTeam)
        rec.player_out_team = outOk.correctedTeam;

      const inOk = checkPlayerAndTeam(
        String(rec.player_in ?? ""),
        String(rec.player_in_team ?? ""),
        "player_in",
      );
      if (inOk === false) valid = false;
      else if (typeof inOk === "object" && inOk.correctedTeam)
        rec.player_in_team = inOk.correctedTeam;
    }

    if (!valid) {
      result.removedCount++;
      continue;
    }

    const caseText = String(rec.case ?? "");
    const statClaims = extractStatClaims(caseText);
    if (statClaims.length > 0) {
      const label = rec.is_package
        ? String((rec as Record<string, unknown>).package_name ?? "package")
        : `${rec.player_out} → ${rec.player_in}`;
      result.flaggedStats.push(...statClaims.map((s) => `[${label}] ${s}`));
      ctx.logger?.info(
        { label, statClaims },
        "Hallucination check: stat claims flagged for review",
      );
    }

    filtered.push(rec);
  }

  return { filtered, result };
}

export const ANTI_HALLUCINATION_PROMPT_SUFFIX =
  "\n\nIMPORTANT: Only reference players who currently exist in the FPL game. Do not invent player names or statistics. Use only real Premier League teams and verified upcoming fixtures.";
