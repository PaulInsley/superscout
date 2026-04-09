CREATE TABLE IF NOT EXISTS sport_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport TEXT NOT NULL,
  interest_status TEXT NOT NULL CHECK (interest_status IN ('interested', 'not_interested', 'active')),
  registered_interest_at TIMESTAMPTZ,
  nudge_source TEXT,
  season TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sport_interest ENABLE ROW LEVEL SECURITY;
