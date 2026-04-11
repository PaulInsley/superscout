CREATE TABLE IF NOT EXISTS feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  gameweek integer,
  season text DEFAULT '2026-27',
  usefulness_score integer CHECK (usefulness_score IS NULL OR (usefulness_score >= 1 AND usefulness_score <= 5)),
  best_feature text,
  frustration_text text,
  feedback_type text NOT NULL CHECK (feedback_type IN ('pulse', 'persistent')),
  category text CHECK (category IS NULL OR category IN ('bug', 'feature_request', 'vibe_feedback', 'other')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own feedback"
  ON feedback_responses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can read their own feedback"
  ON feedback_responses FOR SELECT
  USING (auth.uid() = user_id);
