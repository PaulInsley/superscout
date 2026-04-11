CREATE TABLE IF NOT EXISTS consent_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  fpl_manager_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_events_type ON consent_events(event_type);
CREATE INDEX IF NOT EXISTS idx_consent_events_manager ON consent_events(fpl_manager_id);
