export interface FPLPlayer {
  id: number;
  first_name: string;
  second_name: string;
  now_cost: number;
  form: string;
  team: number;
  element_type: number;
  total_points: number;
}

export interface FPLBootstrapResponse {
  elements: FPLPlayer[];
}

export interface NormalizedPlayer {
  id: number;
  name: string;
  price: number;
  form: string;
}
