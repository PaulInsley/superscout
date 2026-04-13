import { readFileSync } from "fs";
import { resolve } from "path";

interface RulesConfig {
  rulesPath: string;
  strategyPath: string;
}

const WORKSPACE_ROOT = process.env.REPL_HOME ?? "/home/runner/workspace";

const SPORT_CONFIGS: Record<string, RulesConfig> = {
  fpl: {
    rulesPath: "artifacts/superscout/services/rules/fpl-2025-26.md",
    strategyPath: "artifacts/superscout/services/rules/fpl-strategy-2025-26.md",
  },
};

const SEASON_PHASES: Array<{ range: [number, number]; label: string }> = [
  { range: [1, 4], label: "GW1-GW4 (Early season): Limited data. Template teams dominate. Patience is key. Avoid hits." },
  { range: [5, 10], label: "GW5-GW10 (Form emerges): Enough data to identify genuine performers vs flukes. First Wildcard window." },
  { range: [11, 18], label: "GW11-GW18 (First-half chips): Use remaining first-half chips. Plan around blanks/doubles. AFCON planning." },
  { range: [19, 19], label: "GW19 (First-half chip deadline): Any unused first-half chips expire. Use or lose." },
  { range: [20, 30], label: "GW20-GW30 (Second half): Second chip set available. New Wildcard. Transfer accumulation matters." },
  { range: [31, 38], label: "GW31-GW38 (Run-in): Mini-league decisive. Differentials matter more. Second-half chips deployed." },
];

let cachedRules: string | null = null;
let cachedStrategy: string | null = null;
let currentSport = "fpl";

export function loadRules(sport: string = "fpl"): void {
  const config = SPORT_CONFIGS[sport];
  if (!config) {
    throw new Error(`Unknown sport: ${sport}`);
  }
  currentSport = sport;
  try {
    cachedRules = readFileSync(resolve(WORKSPACE_ROOT, config.rulesPath), "utf-8");
    cachedStrategy = readFileSync(resolve(WORKSPACE_ROOT, config.strategyPath), "utf-8");
  } catch (err) {
    console.error(`[rulesEngine] Failed to load rules for sport "${sport}":`, err);
    cachedRules = null;
    cachedStrategy = null;
  }
}

export function getRulesContext(gameweek?: number): string {
  if (!cachedRules && !cachedStrategy) {
    try {
      loadRules(currentSport);
    } catch (err) {
      console.warn("[RulesEngine] loadRules failed:", err);
      return "";
    }
  }

  const parts: string[] = [];

  if (gameweek) {
    const phase = SEASON_PHASES.find(
      (p) => gameweek >= p.range[0] && gameweek <= p.range[1]
    );
    if (phase) {
      parts.push(`CURRENT SEASON PHASE: ${phase.label}`);
    }
  }

  if (cachedRules) {
    parts.push(cachedRules);
  }

  if (cachedStrategy) {
    parts.push(cachedStrategy);
  }

  return parts.join("\n\n---\n\n");
}

export function getCurrentSport(): string {
  return currentSport;
}
