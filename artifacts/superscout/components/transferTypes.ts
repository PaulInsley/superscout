export interface FixtureDetailAPI {
  event: number;
  opponent: string;
  isHome: boolean;
  fdr: number;
  isBlank?: boolean;
  isDgw?: boolean;
  opponents?: Array<{ opponent: string; isHome: boolean; fdr: number }>;
}

export interface TransferSwap {
  player_out: string;
  player_out_team: string;
  player_out_selling_price?: number | null;
  player_in: string;
  player_in_team: string;
  player_in_price?: number | null;
  player_in_form?: string | null;
  player_in_fixtures?: FixtureDetailAPI[];
  player_out_fixtures?: FixtureDetailAPI[];
  computed_impact?: number;
}

export interface TransferRecommendation {
  player_out?: string | null;
  player_out_team?: string | null;
  player_out_selling_price?: number | null;
  player_in?: string | null;
  player_in_team?: string | null;
  player_in_price?: number | null;
  player_in_form?: string | null;
  player_in_fixtures?: FixtureDetailAPI[];
  player_out_fixtures?: FixtureDetailAPI[];
  net_cost?: number | null;
  uses_free_transfer?: boolean;
  hit_cost?: number;
  expected_points_gain_3gw?: number;
  computed_impact?: number;
  projection_window?: number;
  breakeven_gw?: number | null;
  confidence: "BANKER" | "CALCULATED_RISK" | "BOLD_PUNT";
  summary?: string | null;
  upside: string;
  risk: string;
  case: string;
  is_superscout_pick: boolean;
  is_hold_recommendation?: boolean;
  is_package?: boolean;
  package_name?: string;
  transfers?: TransferSwap[];
  total_net_cost?: number;
  total_hit_cost?: number;
  uses_free_transfers?: number;
  total_expected_points_gain_3gw?: number;
}
