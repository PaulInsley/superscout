export interface FPLPlayer {
  id: number;
  first_name: string;
  second_name: string;
  now_cost: number;
  form: string;
  team: number;
  element_type: number;
  total_points: number;
  selected_by_percent: string;
  status: string;
  chance_of_playing_next_round: number | null;
}

export interface FPLEvent {
  id: number;
  name: string;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
  deadline_time: string;
}

export interface FPLBootstrapResponse {
  elements: FPLPlayer[];
  events: FPLEvent[];
  teams: FPLTeam[];
}

export interface NormalizedPlayer {
  id: number;
  name: string;
  price: number;
  form: string;
}

export interface FPLManagerInfo {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_points: number | null;
  summary_overall_rank: number | null;
  current_event: number | null;
  started_event: number;
  entered_events: number[];
  leagues: {
    classic: FPLLeague[];
  };
}

export interface FPLLeague {
  id: number;
  name: string;
  entry_rank: number;
  entry_last_rank: number;
  entry_can_leave: boolean;
  entry_can_admin: boolean;
  entry_can_invite: boolean;
  created: string;
  league_type: string;
  start_event: number;
}

export interface FPLPick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export interface FPLPicksResponse {
  active_chip: string | null;
  automatic_subs: unknown[];
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    rank: number;
    overall_rank: number;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
    points_on_bench: number;
  };
  picks: FPLPick[];
}

export interface FPLTransfer {
  element_in: number;
  element_in_cost: number;
  element_out: number;
  element_out_cost: number;
  entry: number;
  event: number;
  time: string;
}

export interface SquadPlayer {
  id: number;
  name: string;
  position: string;
  price: number;
  form: string;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isBench: boolean;
  pickPosition: number;
}

export interface NormalizedTransfer {
  event: number;
  playerIn: string;
  playerInCost: number;
  playerOut: string;
  playerOutCost: number;
  time: string;
}

export interface FPLFixture {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  kickoff_time: string | null;
  finished: boolean;
}

export interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
}

export interface FPLLiveElement {
  id: number;
  stats: {
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    bonus: number;
    total_points: number;
  };
}

export interface FPLLiveResponse {
  elements: FPLLiveElement[];
}

export interface CaptainCandidate {
  id: number;
  name: string;
  firstName?: string;
  team: string;
  teamId: number;
  position: string;
  form: string;
  totalPoints: number;
  ownershipPct: number;
  price: number;
  opponent: string;
  isHome: boolean;
  fixtureDifficulty: number;
  status: string;
  chanceOfPlaying: number | null;
}

export interface CaptainRecommendation {
  player_name: string;
  team: string;
  opponent: string;
  expected_points: number;
  confidence: "BANKER" | "CALCULATED_RISK" | "BOLD_PUNT";
  ownership_pct: number;
  upside: string;
  risk: string;
  case: string;
  is_superscout_pick: boolean;
}

export interface CaptainPicksResponse {
  gameweek: number;
  recommendations: CaptainRecommendation[];
}

export interface ManagerData {
  teamName: string;
  managerName: string;
  overallPoints: number | null;
  overallRank: number | null;
  currentGwPoints: number | null;
  gameweekLoaded: number | null;
  isNewManager: boolean;
  squad: SquadPlayer[];
  transfers: NormalizedTransfer[];
  leagues: FPLLeague[];
}
