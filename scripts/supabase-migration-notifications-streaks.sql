-- ============================================================
-- SuperScout Migration: Notifications + Streaks
-- Run this in the Supabase SQL Editor (paste the whole thing)
-- Safe to re-run — uses IF NOT EXISTS / DO $$ blocks
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. NOTIFICATIONS: new table + new columns on users
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('deadline_reminder', 'post_gw_results', 'price_change', 'streak_at_risk')),
  gameweek integer NOT NULL,
  season text DEFAULT '2025-26',
  title text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  opened boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user_gw ON notification_log(user_id, gameweek);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_log' AND policyname = 'notification_log_select') THEN
    CREATE POLICY "notification_log_select" ON notification_log FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_log' AND policyname = 'notification_log_insert') THEN
    CREATE POLICY "notification_log_insert" ON notification_log FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_log' AND policyname = 'notification_log_update') THEN
    CREATE POLICY "notification_log_update" ON notification_log FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_log' AND policyname = 'notification_log_delete') THEN
    CREATE POLICY "notification_log_delete" ON notification_log FOR DELETE USING (true);
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notification_token text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences jsonb
  DEFAULT '{"deadline_reminder": true, "post_gw_results": true, "price_change": true, "streak_at_risk": true}'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- 2. STREAKS: new columns on existing streaks table
-- ─────────────────────────────────────────────────────────────

ALTER TABLE streaks ADD COLUMN IF NOT EXISTS sport text NOT NULL DEFAULT 'fpl';

ALTER TABLE streaks ADD COLUMN IF NOT EXISTS streak_shield_used_gw integer;

ALTER TABLE streaks ALTER COLUMN streak_shield_available SET DEFAULT false;

-- ============================================================
-- Done! You can verify by running:
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name IN ('notification_log', 'streaks', 'users')
--   ORDER BY table_name, ordinal_position;
-- ============================================================
