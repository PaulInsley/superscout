-- SuperScout Database Schema — 18 Tables
-- Run via Supabase SQL or migration tool

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- TABLE 1: users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  fpl_manager_id text,
  default_persona text CHECK (default_persona IN ('expert', 'critic', 'fanboy')) DEFAULT 'expert',
  subscription_tier text CHECK (subscription_tier IN ('free', 'pro', 'elite', 'season_pass')) DEFAULT 'free',
  analytics_consent boolean DEFAULT false,
  push_notification_token text,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- TABLE 2: recommendations
CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season text NOT NULL,
  gameweek integer NOT NULL,
  decision_type text NOT NULL CHECK (decision_type IN ('captain', 'transfer', 'chip_usage', 'lineup')),
  options_shown jsonb NOT NULL,
  confidence_levels jsonb,
  data_sources_used text[],
  persona_used text CHECK (persona_used IN ('expert', 'critic', 'fanboy')),
  tier_at_time text,
  created_at timestamptz DEFAULT now()
);

-- TABLE 3: user_decisions
CREATE TABLE IF NOT EXISTS user_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chosen_option text NOT NULL,
  hours_before_deadline decimal,
  created_at timestamptz DEFAULT now()
);

-- TABLE 4: outcomes
CREATE TABLE IF NOT EXISTS outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  player_id integer,
  actual_points integer,
  gameweek integer NOT NULL,
  was_chosen boolean DEFAULT false,
  was_superscout_pick boolean DEFAULT false,
  gameweek_average_points decimal,
  recorded_at timestamptz DEFAULT now()
);

-- TABLE 5: source_tracking
CREATE TABLE IF NOT EXISTS source_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('fpl_api', 'understat', 'reddit', 'twitter', 'blog', 'betting', 'ai_knowledge')),
  source_detail text,
  weight_applied decimal,
  confidence_contribution decimal,
  created_at timestamptz DEFAULT now()
);

-- TABLE 6: structural_knowledge
CREATE TABLE IF NOT EXISTS structural_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type text NOT NULL,
  source_type text,
  season_stage text CHECK (season_stage IN ('early', 'mid', 'late', 'pre_season')),
  accuracy_metric decimal,
  sample_size integer,
  season text,
  created_at timestamptz DEFAULT now()
);

-- TABLE 7: player_continuity
CREATE TABLE IF NOT EXISTS player_continuity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  team text,
  fpl_id_current integer,
  fpl_id_previous integer,
  season text NOT NULL
);

-- TABLE 8: streaks
CREATE TABLE IF NOT EXISTS streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  streak_shield_available boolean DEFAULT false,
  season text NOT NULL,
  last_active_gameweek integer,
  sport text NOT NULL DEFAULT 'fpl',
  streak_shield_used_gw integer
);

-- TABLE 9: manager_profiles
CREATE TABLE IF NOT EXISTS manager_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  risk_appetite decimal,
  recency_bias_score decimal,
  timing_pattern text CHECK (timing_pattern IN ('early_week', 'mid_week', 'deadline_day', 'variable')),
  template_vs_contrarian decimal,
  captain_hit_rate decimal,
  transfer_timing_quality decimal,
  comfort_zone_override_rate decimal,
  superscout_score integer DEFAULT 0,
  season text NOT NULL,
  last_updated timestamptz DEFAULT now()
);

-- TABLE 10: squad_cards
CREATE TABLE IF NOT EXISTS squad_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season text NOT NULL,
  gameweek integer NOT NULL,
  skin_name text DEFAULT 'default',
  was_shared boolean DEFAULT false,
  share_platform text CHECK (share_platform IN ('twitter', 'whatsapp', 'imessage', 'instagram', 'clipboard') OR share_platform IS NULL),
  quip_text text,
  created_at timestamptz DEFAULT now()
);

-- TABLE 11: subscription_events
CREATE TABLE IF NOT EXISTS subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('signup', 'upgrade', 'downgrade', 'cancel', 'expired', 'resubscribe')),
  tier_from text,
  tier_to text,
  gameweek integer,
  source text CHECK (source IN ('app_store', 'google_play', 'web_stripe')),
  created_at timestamptz DEFAULT now()
);

-- TABLE 12: mini_league_context
CREATE TABLE IF NOT EXISTS mini_league_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mini_league_id text NOT NULL,
  mini_league_name text,
  league_type text DEFAULT 'classic',
  current_rank integer,
  rival_manager_ids jsonb,
  season text NOT NULL,
  last_refreshed timestamptz DEFAULT now()
);

-- TABLE 13: challenges
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_name text NOT NULL,
  challenge_type text NOT NULL CHECK (challenge_type IN ('captain_roulette', 'scouts_differential', 'prediction', 'contrarian', 'streak_survivor', 'xg_detective', 'formation', 'nemesis', 'clean_sheet_gamble', 'value_hunter')),
  gameweek integer NOT NULL,
  season text NOT NULL,
  description text,
  rules jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  free_tier_eligible boolean DEFAULT false,
  prize_type text,
  cash_prize_amount decimal
);

-- TABLE 14: challenge_entries
CREATE TABLE IF NOT EXISTS challenge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  entry_details jsonb NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  cp_earned integer DEFAULT 0,
  cash_prize_won decimal,
  completed boolean DEFAULT false,
  leaderboard_rank integer
);

-- TABLE 15: superscout_leagues
CREATE TABLE IF NOT EXISTS superscout_leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_type text NOT NULL CHECK (league_type IN ('weekly_sprint', 'monthly_marathon', 'decision_quality', 'persona', 'challenge_points')),
  league_tier text NOT NULL CHECK (league_tier IN ('bronze', 'silver', 'gold', 'diamond')),
  season text NOT NULL,
  period_start_gameweek integer NOT NULL,
  period_end_gameweek integer NOT NULL,
  max_members integer DEFAULT 25,
  persona_filter text CHECK (persona_filter IN ('expert', 'critic', 'fanboy') OR persona_filter IS NULL),
  created_at timestamptz DEFAULT now()
);

-- TABLE 16: league_memberships
CREATE TABLE IF NOT EXISTS league_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES superscout_leagues(id) ON DELETE CASCADE,
  current_score decimal DEFAULT 0,
  current_rank integer,
  cp_earned_this_period integer DEFAULT 0,
  promotion_status text DEFAULT 'pending' CHECK (promotion_status IN ('promoted', 'demoted', 'stayed', 'pending')),
  assigned_at timestamptz DEFAULT now()
);

-- TABLE 17: challenge_points_balance
CREATE TABLE IF NOT EXISTS challenge_points_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season text NOT NULL,
  total_lifetime_earned integer DEFAULT 0,
  current_spendable_balance integer DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

-- TABLE 18: reward_redemptions
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN ('skin', 'badge', 'persona_customisation', 'feature_access', 'early_access')),
  reward_name text NOT NULL,
  cp_cost integer NOT NULL,
  redeemed_at timestamptz DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_fpl_manager_id ON users(fpl_manager_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_gameweek ON recommendations(gameweek);
CREATE INDEX IF NOT EXISTS idx_recommendations_season ON recommendations(season);
CREATE INDEX IF NOT EXISTS idx_user_decisions_user_id ON user_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_decisions_recommendation_id ON user_decisions(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_recommendation_id ON outcomes(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_gameweek ON outcomes(gameweek);
CREATE INDEX IF NOT EXISTS idx_source_tracking_recommendation_id ON source_tracking(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_squad_cards_user_id ON squad_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_squad_cards_gameweek ON squad_cards(gameweek);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_mini_league_context_user_id ON mini_league_context(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_entries_user_id ON challenge_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_entries_challenge_id ON challenge_entries(challenge_id);
CREATE INDEX IF NOT EXISTS idx_league_memberships_user_id ON league_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_league_memberships_league_id ON league_memberships(league_id);
CREATE INDEX IF NOT EXISTS idx_challenge_points_balance_user_id ON challenge_points_balance(user_id);

-- ROW LEVEL SECURITY
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE structural_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_continuity ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE squad_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mini_league_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE superscout_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_points_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

-- TABLE 19: notification_log
CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('deadline_reminder', 'post_gw_results', 'price_change', 'streak_at_risk')),
  gameweek integer NOT NULL,
  season text DEFAULT '2026-27',
  title text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  opened boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user_gw ON notification_log(user_id, gameweek);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"deadline_reminder": true, "post_gw_results": true, "price_change": true, "streak_at_risk": true}'::jsonb;

-- RLS POLICIES — permissive for now, will be refined in Phase 1
CREATE POLICY IF NOT EXISTS "users_select_own" ON users FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "users_update_own" ON users FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "users_delete" ON users FOR DELETE USING (true);

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'recommendations', 'user_decisions', 'outcomes', 'source_tracking',
      'structural_knowledge', 'player_continuity', 'streaks', 'manager_profiles',
      'squad_cards', 'subscription_events', 'mini_league_context', 'challenges',
      'challenge_entries', 'superscout_leagues', 'league_memberships',
      'challenge_points_balance', 'reward_redemptions', 'notification_log'
    ])
  LOOP
    EXECUTE format('CREATE POLICY IF NOT EXISTS "allow_all_select" ON %I FOR SELECT USING (true)', tbl);
    EXECUTE format('CREATE POLICY IF NOT EXISTS "allow_all_insert" ON %I FOR INSERT WITH CHECK (true)', tbl);
    EXECUTE format('CREATE POLICY IF NOT EXISTS "allow_all_update" ON %I FOR UPDATE USING (true)', tbl);
    EXECUTE format('CREATE POLICY IF NOT EXISTS "allow_all_delete" ON %I FOR DELETE USING (true)', tbl);
  END LOOP;
END $$;
