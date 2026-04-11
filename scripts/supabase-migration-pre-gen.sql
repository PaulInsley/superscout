CREATE TABLE IF NOT EXISTS pre_generated_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gameweek INTEGER NOT NULL,
  season TEXT NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('captain', 'transfer')),
  vibe TEXT NOT NULL CHECK (vibe IN ('expert', 'critic', 'fanboy')),
  response_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_pre_gen_lookup ON pre_generated_recommendations (user_id, gameweek, decision_type, vibe, used);
CREATE INDEX IF NOT EXISTS idx_pre_gen_expires ON pre_generated_recommendations (expires_at);

ALTER TABLE pre_generated_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pre_generated_recommendations"
  ON pre_generated_recommendations
  FOR ALL
  USING (true)
  WITH CHECK (true);
