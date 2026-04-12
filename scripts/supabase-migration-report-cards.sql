-- ============================================================
-- SuperScout Migration: Report Cards
-- Run this in the Supabase SQL Editor (paste the whole thing)
-- Safe to re-run — uses IF NOT EXISTS / DO $$ blocks
-- ============================================================

CREATE TABLE IF NOT EXISTS report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  gameweek integer NOT NULL,
  season text DEFAULT '2025-26',
  total_points integer,
  average_points integer,
  rank_movement integer,
  overall_rank integer,
  captain_name text,
  captain_points integer,
  star_rating integer CHECK (star_rating BETWEEN 1 AND 5),
  decision_quality_score integer CHECK (decision_quality_score BETWEEN 0 AND 100),
  captain_quality_score integer CHECK (captain_quality_score BETWEEN 0 AND 100),
  transfer_quality_score integer CHECK (transfer_quality_score BETWEEN 0 AND 100),
  commentary text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_cards_user_gw
  ON report_cards(user_id, gameweek, season);

ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'report_cards' AND policyname = 'report_cards_select') THEN
    CREATE POLICY "report_cards_select" ON report_cards FOR SELECT
      USING (auth.uid() = user_id OR auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'report_cards' AND policyname = 'report_cards_insert') THEN
    CREATE POLICY "report_cards_insert" ON report_cards FOR INSERT
      WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'report_cards' AND policyname = 'report_cards_update') THEN
    CREATE POLICY "report_cards_update" ON report_cards FOR UPDATE
      USING (auth.uid() = user_id OR auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- Done! Verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'report_cards' ORDER BY ordinal_position;
-- ============================================================
