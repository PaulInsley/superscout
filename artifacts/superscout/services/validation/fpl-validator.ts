import type { CaptainRecommendation } from "../fpl/types";

export interface ValidationResult {
  recommendation: CaptainRecommendation | null;
  warning: string | null;
  reason: string | null;
}

export interface CaptainCandidate {
  name: string;
  isBench: boolean;
  status: string;
  chanceOfPlaying: number | null;
  hasFixture: boolean;
  teamId: number;
  position: string;
  price: number;
}

export interface TransferValidationInput {
  playerIn: {
    name: string;
    teamId: number;
    position: string;
    price: number;
  };
  playerOut: {
    name: string;
    teamId: number;
    position: string;
    purchasePrice: number;
    currentPrice: number;
  };
  currentSquad: Array<{
    name: string;
    teamId: number;
    position: string;
  }>;
  bank: number;
}

export interface TransferValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateCaptainRecommendation(
  rec: CaptainRecommendation,
  candidates: CaptainCandidate[],
): ValidationResult {
  const candidate = candidates.find((c) => c.name.toLowerCase() === rec.player_name.toLowerCase());

  if (!candidate) {
    return {
      recommendation: null,
      warning: null,
      reason: `${rec.player_name} is not in your squad — AI may have hallucinated this player`,
    };
  }

  if (candidate.isBench) {
    return {
      recommendation: null,
      warning: null,
      reason: `${rec.player_name} is on the bench — captain must be from starting XI (R4.03)`,
    };
  }

  if (!candidate.hasFixture) {
    return {
      recommendation: null,
      warning: null,
      reason: `${rec.player_name} has no fixture this gameweek (blank gameweek)`,
    };
  }

  const unavailableStatuses = ["u", "i", "s", "n"];
  if (
    candidate.chanceOfPlaying === 0 ||
    unavailableStatuses.includes(candidate.status.toLowerCase())
  ) {
    return {
      recommendation: null,
      warning: null,
      reason: `${rec.player_name} is unavailable (status: ${candidate.status})`,
    };
  }

  if (
    candidate.chanceOfPlaying !== null &&
    candidate.chanceOfPlaying > 0 &&
    candidate.chanceOfPlaying <= 75
  ) {
    const warning =
      candidate.chanceOfPlaying <= 25
        ? `${rec.player_name} has only ${candidate.chanceOfPlaying}% chance of playing — high rotation risk`
        : candidate.chanceOfPlaying <= 50
          ? `${rec.player_name} has ${candidate.chanceOfPlaying}% chance of playing — doubtful`
          : `${rec.player_name} has ${candidate.chanceOfPlaying}% chance of playing — monitor team news`;

    return {
      recommendation: { ...rec },
      warning,
      reason: null,
    };
  }

  return {
    recommendation: rec,
    warning: null,
    reason: null,
  };
}

export function calculateSellingPrice(purchasePrice: number, currentPrice: number): number {
  if (currentPrice <= purchasePrice) {
    return currentPrice;
  }
  const rise = currentPrice - purchasePrice;
  const profit = Math.floor((rise * 10) / 2) / 10;
  return purchasePrice + profit;
}

export function validateTransfer(input: TransferValidationInput): TransferValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sellingPrice = calculateSellingPrice(
    input.playerOut.purchasePrice,
    input.playerOut.currentPrice,
  );
  const availableBudget = input.bank + sellingPrice;

  if (input.playerIn.price > availableBudget) {
    errors.push(
      `Cannot afford ${input.playerIn.name} (£${input.playerIn.price}m). Available: £${availableBudget.toFixed(1)}m after selling ${input.playerOut.name} (sell price: £${sellingPrice.toFixed(1)}m, R3.06)`,
    );
  }

  const squadAfterTransfer = input.currentSquad
    .filter((p) => p.name !== input.playerOut.name)
    .concat({
      name: input.playerIn.name,
      teamId: input.playerIn.teamId,
      position: input.playerIn.position,
    });

  const teamCounts = new Map<number, number>();
  for (const p of squadAfterTransfer) {
    teamCounts.set(p.teamId, (teamCounts.get(p.teamId) ?? 0) + 1);
  }
  for (const [teamId, count] of teamCounts) {
    if (count > 3) {
      errors.push(
        `Transfer would put ${count} players from the same club (team ${teamId}) in your squad — maximum is 3 (R1.03)`,
      );
    }
  }

  const positionCounts = { GKP: 0, DEF: 0, MID: 0, FWD: 0 } as Record<string, number>;
  for (const p of squadAfterTransfer) {
    const pos = p.position.toUpperCase();
    if (pos in positionCounts) {
      positionCounts[pos]++;
    }
  }

  const required = { GKP: 2, DEF: 5, MID: 5, FWD: 3 } as Record<string, number>;
  for (const [pos, req] of Object.entries(required)) {
    if ((positionCounts[pos] ?? 0) !== req) {
      errors.push(
        `Transfer would leave ${positionCounts[pos] ?? 0} ${pos}s in squad — exactly ${req} required (R1.04)`,
      );
    }
  }

  if (input.playerIn.position !== input.playerOut.position) {
    warnings.push(
      `Position change: replacing a ${input.playerOut.position} with a ${input.playerIn.position} — check formation validity`,
    );
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

export function validateCaptainRecommendations(
  recommendations: CaptainRecommendation[],
  candidates: CaptainCandidate[],
): CaptainRecommendation[] {
  const validated: CaptainRecommendation[] = [];

  for (const rec of recommendations) {
    const result = validateCaptainRecommendation(rec, candidates);
    if (result.recommendation) {
      if (result.warning) {
        result.recommendation.risk = `${result.recommendation.risk} ⚠️ ${result.warning}`;
      }
      validated.push(result.recommendation);
    }
  }

  return validated;
}
