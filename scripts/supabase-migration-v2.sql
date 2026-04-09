-- SuperScout Schema Additions — Technical Review
-- Addition 1: recommendation_options table + user_decisions column
-- Addition 2: inference_context table
-- Addition 3: GDPR fields on users + consent_events table

-- ADDITION 1: recommendation_options
CREATE TABLE IF NOT EXISTS recommendation_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  option_rank integer NOT NULL CHECK (option_rank >= 1 AND option_rank <= 5),
  player_id integer,
  option_type text,
  expected_points decimal,
  confidence_score decimal CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  confidence_label text NOT NULL CHECK (confidence_label IN ('HIGH', 'MEDIUM', 'SPECULATIVE')),
  upside_text text,
  risk_text text,
  is_superscout_pick boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_decisions
  ADD COLUMN IF NOT EXISTS recommendation_option_id uuid REFERENCES recommendation_options(id);

CREATE INDEX IF NOT EXISTS idx_recommendation_options_recommendation_id ON recommendation_options(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_user_decisions_recommendation_option_id ON user_decisions(recommendation_option_id);

-- ADDITION 2: inference_context
CREATE TABLE IF NOT EXISTS inference_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  engine_level integer NOT NULL CHECK (engine_level IN (1, 2, 3, 4)),
  persona_prompt_version text NOT NULL,
  model_name text NOT NULL,
  model_provider text NOT NULL CHECK (model_provider IN ('anthropic', 'openai')),
  generated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inference_context_recommendation_id ON inference_context(recommendation_id);

-- ADDITION 3: GDPR fields on users + consent_events table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS purged_at timestamptz,
  ADD COLUMN IF NOT EXISTS purge_status text CHECK (purge_status IS NULL OR purge_status IN ('pending', 'scheduled', 'complete'));

CREATE TABLE IF NOT EXISTS consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('analytics', 'push_notifications')),
  consent_given boolean NOT NULL,
  occurred_at timestamptz DEFAULT now(),
  ip_address_hash text
);

CREATE INDEX IF NOT EXISTS idx_consent_events_user_id ON consent_events(user_id);

-- RLS on new tables
ALTER TABLE recommendation_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE inference_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;

-- Permissive policies (same approach as existing tables)
CREATE POLICY IF NOT EXISTS "allow_all_select" ON recommendation_options FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "allow_all_insert" ON recommendation_options FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_update" ON recommendation_options FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "allow_all_delete" ON recommendation_options FOR DELETE USING (true);

CREATE POLICY IF NOT EXISTS "allow_all_select" ON inference_context FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "allow_all_insert" ON inference_context FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_update" ON inference_context FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "allow_all_delete" ON inference_context FOR DELETE USING (true);

CREATE POLICY IF NOT EXISTS "allow_all_select" ON consent_events FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "allow_all_insert" ON consent_events FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_update" ON consent_events FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "allow_all_delete" ON consent_events FOR DELETE USING (true);
