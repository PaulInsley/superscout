export interface CaptainScoreInput {
  userCaptainId: number;
  userCaptainPoints: number;
  recommendedOptions: Array<{
    playerId: number;
    playerName: string;
    actualPoints: number;
    isSuperscoutPick: boolean;
  }>;
}

export interface TransferScoreInput {
  transfers: Array<{
    playerInId: number;
    playerInName: string;
    playerInPoints: number;
    playerOutId: number;
    playerOutName: string;
    playerOutPoints: number;
    wasRecommended: boolean;
    hitCost: number;
  }>;
  recommendedHold: boolean;
  userHeld: boolean;
}

export interface PerformanceScoreInput {
  userPoints: number;
  averagePoints: number;
}

export interface ScoringResult {
  captainQualityScore: number;
  transferQualityScore: number;
  performanceScore: number;
  decisionQualityScore: number;
  starRating: number;
  captainName: string;
  captainPoints: number;
  bestRecommendedCaptain: string;
  bestRecommendedCaptainPoints: number;
  hasTransferData: boolean;
}

export function scoreCaptainDecision(input: CaptainScoreInput): {
  score: number;
  captainName: string;
  captainPoints: number;
  bestRecommendedName: string;
  bestRecommendedPoints: number;
} {
  const { userCaptainId, userCaptainPoints, recommendedOptions } = input;

  if (recommendedOptions.length === 0) {
    return {
      score: 50,
      captainName: "Unknown",
      captainPoints: userCaptainPoints,
      bestRecommendedName: "N/A",
      bestRecommendedPoints: 0,
    };
  }

  const sorted = [...recommendedOptions].sort((a, b) => b.actualPoints - a.actualPoints);
  const bestOption = sorted[0];

  const userPicked = recommendedOptions.find((o) => o.playerId === userCaptainId);

  let score: number;

  if (!userPicked) {
    if (userCaptainPoints >= bestOption.actualPoints) {
      score = 85;
    } else if (userCaptainPoints >= bestOption.actualPoints * 0.7) {
      score = 55;
    } else {
      score = 40;
    }
  } else {
    const rank = sorted.findIndex((o) => o.playerId === userCaptainId) + 1;
    const total = sorted.length;

    if (rank === 1) {
      score = 100;
    } else if (rank === 2 && total >= 3) {
      score = 70;
    } else if (rank === 2) {
      score = 60;
    } else {
      score = Math.max(20, 60 - (rank - 2) * 15);
    }
  }

  const userPickName =
    userPicked?.playerName ??
    recommendedOptions.find((o) => o.playerId === userCaptainId)?.playerName ??
    "Unknown";

  return {
    score,
    captainName: userPickName,
    captainPoints: userCaptainPoints,
    bestRecommendedName: bestOption.playerName,
    bestRecommendedPoints: bestOption.actualPoints,
  };
}

export function scoreTransferDecision(input: TransferScoreInput): {
  score: number;
  hasData: boolean;
} {
  const { transfers, recommendedHold, userHeld } = input;

  if (transfers.length === 0 && userHeld && recommendedHold) {
    return { score: 80, hasData: true };
  }

  if (transfers.length === 0 && !recommendedHold) {
    return { score: 50, hasData: false };
  }

  if (transfers.length === 0) {
    return { score: 50, hasData: false };
  }

  let totalScore = 0;
  let count = 0;

  for (const t of transfers) {
    const netGain = t.playerInPoints - t.playerOutPoints - t.hitCost;

    let transferScore: number;
    if (netGain > 6) {
      transferScore = 100;
    } else if (netGain > 3) {
      transferScore = 85;
    } else if (netGain > 0) {
      transferScore = 70;
    } else if (netGain === 0) {
      transferScore = 50;
    } else if (netGain > -3) {
      transferScore = 35;
    } else {
      transferScore = 15;
    }

    if (t.wasRecommended) {
      transferScore = Math.min(100, transferScore + 10);
    }

    totalScore += transferScore;
    count++;
  }

  return { score: Math.round(totalScore / count), hasData: true };
}

export function scorePerformance(input: PerformanceScoreInput): number {
  const { userPoints, averagePoints } = input;

  if (averagePoints === 0) return 50;

  const diff = userPoints - averagePoints;
  const pctDiff = diff / averagePoints;

  if (pctDiff >= 0.5) return 100;
  if (pctDiff >= 0.3) return 85;
  if (pctDiff >= 0.1) return 70;
  if (pctDiff >= 0) return 60;
  if (pctDiff >= -0.1) return 45;
  if (pctDiff >= -0.3) return 30;
  return 15;
}

export function calculateStarRating(score: number): number {
  if (score >= 81) return 5;
  if (score >= 61) return 4;
  if (score >= 41) return 3;
  if (score >= 21) return 2;
  return 1;
}

export function getStarLabel(stars: number): string {
  switch (stars) {
    case 5:
      return "Perfect week";
    case 4:
      return "Great decision-making";
    case 3:
      return "Solid decisions";
    case 2:
      return "Room to improve";
    default:
      return "Tough week";
  }
}

export function computeFullScore(
  captain: CaptainScoreInput,
  transfer: TransferScoreInput,
  performance: PerformanceScoreInput,
): ScoringResult {
  const captainResult = scoreCaptainDecision(captain);
  const transferResult = scoreTransferDecision(transfer);
  const performanceResult = scorePerformance(performance);

  let decisionQualityScore: number;

  if (transferResult.hasData) {
    decisionQualityScore = Math.round(
      captainResult.score * 0.4 + transferResult.score * 0.4 + performanceResult * 0.2,
    );
  } else {
    decisionQualityScore = Math.round(captainResult.score * 0.8 + performanceResult * 0.2);
  }

  return {
    captainQualityScore: captainResult.score,
    transferQualityScore: transferResult.score,
    performanceScore: performanceResult,
    decisionQualityScore,
    starRating: calculateStarRating(decisionQualityScore),
    captainName: captainResult.captainName,
    captainPoints: captainResult.captainPoints,
    bestRecommendedCaptain: captainResult.bestRecommendedName,
    bestRecommendedCaptainPoints: captainResult.bestRecommendedPoints,
    hasTransferData: transferResult.hasData,
  };
}
