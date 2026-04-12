ALTER TABLE users ADD COLUMN IF NOT EXISTS is_beginner boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS beginner_rounds_completed integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS beginner_lessons_seen text DEFAULT '';
