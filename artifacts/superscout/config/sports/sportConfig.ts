export interface SportStreakConfig {
  sport: string;
  roundName: string;
  roundNamePlural: string;
  seasonLength: number;
  seasonLabel: string;
}

const FPL_CONFIG: SportStreakConfig = {
  sport: "fpl",
  roundName: "gameweek",
  roundNamePlural: "gameweeks",
  seasonLength: 38,
  seasonLabel: "season",
};

const sportConfigs: Record<string, SportStreakConfig> = {
  fpl: FPL_CONFIG,
};

export function getSportConfig(sport: string = "fpl"): SportStreakConfig {
  return sportConfigs[sport] ?? FPL_CONFIG;
}

export default FPL_CONFIG;
