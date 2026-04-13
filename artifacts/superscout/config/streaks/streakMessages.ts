import type { SportStreakConfig } from "@/config/sports/sportConfig";

export type VibeType = "expert" | "critic" | "fanboy";

interface StreakMessageSet {
  low: string;
  mid: string;
  high: string;
}

const streakMessages: Record<VibeType, StreakMessageSet> = {
  expert: {
    low: "Consistency is the foundation of good FPL management. Keep showing up.",
    mid: "Five consecutive gameweeks of active decisions. The data improves with every interaction.",
    high: "Your commitment to data-driven decisions is showing in the numbers.",
  },
  critic: {
    low: "A streak of {N}. Don't get too excited — it's barely started.",
    mid: "Five weeks without ghosting. I'm almost impressed.",
    high: "{N} weeks. You might actually be taking this seriously for once.",
  },
  fanboy: {
    low: "THE STREAK HAS BEGUN! Let's keep this rolling!",
    mid: "FIVE IN A ROW! You're on FIRE! Don't stop now!",
    high: "{N} GAMEWEEKS! UNSTOPPABLE! This is YOUR season!",
  },
};

export function getStreakMessage(vibe: VibeType, streakCount: number): string {
  const messages = streakMessages[vibe] ?? streakMessages.expert;
  let template: string;

  if (streakCount <= 0) return "";
  if (streakCount <= 4) template = messages.low;
  else if (streakCount <= 9) template = messages.mid;
  else template = messages.high;

  return template.replace(/\{N\}/g, String(streakCount));
}

interface MilestoneMessages {
  expert: string;
  critic: string;
  fanboy: string;
}

const milestoneMessages: Record<number, MilestoneMessages> = {
  5: {
    expert:
      "Five consecutive gameweeks. You've earned your Streak Shield — one free save if you miss a deadline.",
    critic:
      "Five whole weeks without forgetting. Have a gold star. And a Streak Shield, I suppose.",
    fanboy: "FIVE IN A ROW! STREAK SHIELD UNLOCKED! You're officially a regular!",
  },
  10: {
    expert: "10-gameweek streak. You're now in the top quartile for engagement consistency.",
    critic: "10 weeks. I didn't think you had it in you. Genuinely.",
    fanboy: "DOUBLE DIGITS! TEN WEEKS OF PURE COMMITMENT! LEGEND!",
  },
  20: {
    expert:
      "20 consecutive gameweeks. This level of consistency directly correlates with stronger decision quality.",
    critic: "20 weeks. Even I can't find something sarcastic to say about that. Almost.",
    fanboy: "TWENTY! TWO-ZERO! HALF THE SEASON WITHOUT MISSING A BEAT! INCREDIBLE!",
  },
  38: {
    expert:
      "38 gameweeks. Every single one. A perfect season of engagement — the data speaks for itself.",
    critic: "38 out of 38. I genuinely respect that. Don't tell anyone I said this.",
    fanboy: "PERFECT SEASON! 38 OUT OF 38! YOU ARE THE ULTIMATE SUPERSCOUT MANAGER!",
  },
};

export function getMilestoneMessage(milestone: number, vibe: VibeType): string {
  const messages = milestoneMessages[milestone];
  if (!messages) return "";
  return messages[vibe] ?? messages.expert;
}

export function getMilestoneTitle(milestone: number, config: SportStreakConfig): string {
  if (milestone === config.seasonLength) return `Perfect ${config.seasonLabel}!`;
  return `${milestone} ${config.roundNamePlural}!`;
}
