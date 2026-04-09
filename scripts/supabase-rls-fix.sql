-- =============================================================================
-- SuperScout — RLS Policy Fix
-- =============================================================================
-- IMPORTANT: The Supabase service role key bypasses RLS entirely. These policies
-- only govern access via the anon key (i.e. what the client app can do).
-- All backend operations using the service role key are completely unaffected.
-- =============================================================================


-- =============================================================================
-- STEP 1: Drop all existing permissive policies on all 21 tables
-- =============================================================================

-- users (has custom policy names)
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;

-- recommendations
DROP POLICY IF EXISTS "allow_all_select" ON recommendations;
DROP POLICY IF EXISTS "allow_all_insert" ON recommendations;
DROP POLICY IF EXISTS "allow_all_update" ON recommendations;
DROP POLICY IF EXISTS "allow_all_delete" ON recommendations;

-- user_decisions
DROP POLICY IF EXISTS "allow_all_select" ON user_decisions;
DROP POLICY IF EXISTS "allow_all_insert" ON user_decisions;
DROP POLICY IF EXISTS "allow_all_update" ON user_decisions;
DROP POLICY IF EXISTS "allow_all_delete" ON user_decisions;

-- outcomes
DROP POLICY IF EXISTS "allow_all_select" ON outcomes;
DROP POLICY IF EXISTS "allow_all_insert" ON outcomes;
DROP POLICY IF EXISTS "allow_all_update" ON outcomes;
DROP POLICY IF EXISTS "allow_all_delete" ON outcomes;

-- source_tracking
DROP POLICY IF EXISTS "allow_all_select" ON source_tracking;
DROP POLICY IF EXISTS "allow_all_insert" ON source_tracking;
DROP POLICY IF EXISTS "allow_all_update" ON source_tracking;
DROP POLICY IF EXISTS "allow_all_delete" ON source_tracking;

-- streaks
DROP POLICY IF EXISTS "allow_all_select" ON streaks;
DROP POLICY IF EXISTS "allow_all_insert" ON streaks;
DROP POLICY IF EXISTS "allow_all_update" ON streaks;
DROP POLICY IF EXISTS "allow_all_delete" ON streaks;

-- manager_profiles
DROP POLICY IF EXISTS "allow_all_select" ON manager_profiles;
DROP POLICY IF EXISTS "allow_all_insert" ON manager_profiles;
DROP POLICY IF EXISTS "allow_all_update" ON manager_profiles;
DROP POLICY IF EXISTS "allow_all_delete" ON manager_profiles;

-- squad_cards
DROP POLICY IF EXISTS "allow_all_select" ON squad_cards;
DROP POLICY IF EXISTS "allow_all_insert" ON squad_cards;
DROP POLICY IF EXISTS "allow_all_update" ON squad_cards;
DROP POLICY IF EXISTS "allow_all_delete" ON squad_cards;

-- subscription_events
DROP POLICY IF EXISTS "allow_all_select" ON subscription_events;
DROP POLICY IF EXISTS "allow_all_insert" ON subscription_events;
DROP POLICY IF EXISTS "allow_all_update" ON subscription_events;
DROP POLICY IF EXISTS "allow_all_delete" ON subscription_events;

-- mini_league_context
DROP POLICY IF EXISTS "allow_all_select" ON mini_league_context;
DROP POLICY IF EXISTS "allow_all_insert" ON mini_league_context;
DROP POLICY IF EXISTS "allow_all_update" ON mini_league_context;
DROP POLICY IF EXISTS "allow_all_delete" ON mini_league_context;

-- challenge_entries
DROP POLICY IF EXISTS "allow_all_select" ON challenge_entries;
DROP POLICY IF EXISTS "allow_all_insert" ON challenge_entries;
DROP POLICY IF EXISTS "allow_all_update" ON challenge_entries;
DROP POLICY IF EXISTS "allow_all_delete" ON challenge_entries;

-- league_memberships
DROP POLICY IF EXISTS "allow_all_select" ON league_memberships;
DROP POLICY IF EXISTS "allow_all_insert" ON league_memberships;
DROP POLICY IF EXISTS "allow_all_update" ON league_memberships;
DROP POLICY IF EXISTS "allow_all_delete" ON league_memberships;

-- challenge_points_balance
DROP POLICY IF EXISTS "allow_all_select" ON challenge_points_balance;
DROP POLICY IF EXISTS "allow_all_insert" ON challenge_points_balance;
DROP POLICY IF EXISTS "allow_all_update" ON challenge_points_balance;
DROP POLICY IF EXISTS "allow_all_delete" ON challenge_points_balance;

-- reward_redemptions
DROP POLICY IF EXISTS "allow_all_select" ON reward_redemptions;
DROP POLICY IF EXISTS "allow_all_insert" ON reward_redemptions;
DROP POLICY IF EXISTS "allow_all_update" ON reward_redemptions;
DROP POLICY IF EXISTS "allow_all_delete" ON reward_redemptions;

-- recommendation_options
DROP POLICY IF EXISTS "allow_all_select" ON recommendation_options;
DROP POLICY IF EXISTS "allow_all_insert" ON recommendation_options;
DROP POLICY IF EXISTS "allow_all_update" ON recommendation_options;
DROP POLICY IF EXISTS "allow_all_delete" ON recommendation_options;

-- inference_context
DROP POLICY IF EXISTS "allow_all_select" ON inference_context;
DROP POLICY IF EXISTS "allow_all_insert" ON inference_context;
DROP POLICY IF EXISTS "allow_all_update" ON inference_context;
DROP POLICY IF EXISTS "allow_all_delete" ON inference_context;

-- consent_events
DROP POLICY IF EXISTS "allow_all_select" ON consent_events;
DROP POLICY IF EXISTS "allow_all_insert" ON consent_events;
DROP POLICY IF EXISTS "allow_all_update" ON consent_events;
DROP POLICY IF EXISTS "allow_all_delete" ON consent_events;

-- structural_knowledge
DROP POLICY IF EXISTS "allow_all_select" ON structural_knowledge;
DROP POLICY IF EXISTS "allow_all_insert" ON structural_knowledge;
DROP POLICY IF EXISTS "allow_all_update" ON structural_knowledge;
DROP POLICY IF EXISTS "allow_all_delete" ON structural_knowledge;

-- player_continuity
DROP POLICY IF EXISTS "allow_all_select" ON player_continuity;
DROP POLICY IF EXISTS "allow_all_insert" ON player_continuity;
DROP POLICY IF EXISTS "allow_all_update" ON player_continuity;
DROP POLICY IF EXISTS "allow_all_delete" ON player_continuity;

-- challenges
DROP POLICY IF EXISTS "allow_all_select" ON challenges;
DROP POLICY IF EXISTS "allow_all_insert" ON challenges;
DROP POLICY IF EXISTS "allow_all_update" ON challenges;
DROP POLICY IF EXISTS "allow_all_delete" ON challenges;

-- superscout_leagues
DROP POLICY IF EXISTS "allow_all_select" ON superscout_leagues;
DROP POLICY IF EXISTS "allow_all_insert" ON superscout_leagues;
DROP POLICY IF EXISTS "allow_all_update" ON superscout_leagues;
DROP POLICY IF EXISTS "allow_all_delete" ON superscout_leagues;


-- =============================================================================
-- STEP 2A: Owner-scoped policies for user-data tables
-- =============================================================================
-- These tables contain user-specific data. Each user can only access their own
-- rows, matched by auth.uid() against user_id (or id for the users table).
-- =============================================================================

-- users (primary key is "id", not "user_id")
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "users_insert_own" ON users FOR INSERT WITH CHECK (auth.uid()::text = id::text);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "users_delete_own" ON users FOR DELETE USING (auth.uid()::text = id::text);

-- recommendations
CREATE POLICY "recommendations_select_own" ON recommendations FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "recommendations_insert_own" ON recommendations FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "recommendations_update_own" ON recommendations FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "recommendations_delete_own" ON recommendations FOR DELETE USING (auth.uid()::text = user_id::text);

-- user_decisions
CREATE POLICY "user_decisions_select_own" ON user_decisions FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "user_decisions_insert_own" ON user_decisions FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "user_decisions_update_own" ON user_decisions FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "user_decisions_delete_own" ON user_decisions FOR DELETE USING (auth.uid()::text = user_id::text);

-- outcomes (linked via recommendation_id)
CREATE POLICY "outcomes_select_own" ON outcomes FOR SELECT USING (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);
CREATE POLICY "outcomes_insert_own" ON outcomes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);
CREATE POLICY "outcomes_update_own" ON outcomes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);
CREATE POLICY "outcomes_delete_own" ON outcomes FOR DELETE USING (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);

-- source_tracking (linked via recommendation_id)
CREATE POLICY "source_tracking_select_own" ON source_tracking FOR SELECT USING (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);
CREATE POLICY "source_tracking_insert_own" ON source_tracking FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);
CREATE POLICY "source_tracking_update_own" ON source_tracking FOR UPDATE USING (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);
CREATE POLICY "source_tracking_delete_own" ON source_tracking FOR DELETE USING (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);

-- streaks
CREATE POLICY "streaks_select_own" ON streaks FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "streaks_insert_own" ON streaks FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "streaks_update_own" ON streaks FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "streaks_delete_own" ON streaks FOR DELETE USING (auth.uid()::text = user_id::text);

-- manager_profiles
CREATE POLICY "manager_profiles_select_own" ON manager_profiles FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "manager_profiles_insert_own" ON manager_profiles FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "manager_profiles_update_own" ON manager_profiles FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "manager_profiles_delete_own" ON manager_profiles FOR DELETE USING (auth.uid()::text = user_id::text);

-- squad_cards
CREATE POLICY "squad_cards_select_own" ON squad_cards FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "squad_cards_insert_own" ON squad_cards FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "squad_cards_update_own" ON squad_cards FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "squad_cards_delete_own" ON squad_cards FOR DELETE USING (auth.uid()::text = user_id::text);

-- subscription_events
CREATE POLICY "subscription_events_select_own" ON subscription_events FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "subscription_events_insert_own" ON subscription_events FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "subscription_events_update_own" ON subscription_events FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "subscription_events_delete_own" ON subscription_events FOR DELETE USING (auth.uid()::text = user_id::text);

-- mini_league_context
CREATE POLICY "mini_league_context_select_own" ON mini_league_context FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "mini_league_context_insert_own" ON mini_league_context FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "mini_league_context_update_own" ON mini_league_context FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "mini_league_context_delete_own" ON mini_league_context FOR DELETE USING (auth.uid()::text = user_id::text);

-- challenge_entries
CREATE POLICY "challenge_entries_select_own" ON challenge_entries FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "challenge_entries_insert_own" ON challenge_entries FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "challenge_entries_update_own" ON challenge_entries FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "challenge_entries_delete_own" ON challenge_entries FOR DELETE USING (auth.uid()::text = user_id::text);

-- league_memberships
CREATE POLICY "league_memberships_select_own" ON league_memberships FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "league_memberships_insert_own" ON league_memberships FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "league_memberships_update_own" ON league_memberships FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "league_memberships_delete_own" ON league_memberships FOR DELETE USING (auth.uid()::text = user_id::text);

-- challenge_points_balance
CREATE POLICY "challenge_points_balance_select_own" ON challenge_points_balance FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "challenge_points_balance_insert_own" ON challenge_points_balance FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "challenge_points_balance_update_own" ON challenge_points_balance FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "challenge_points_balance_delete_own" ON challenge_points_balance FOR DELETE USING (auth.uid()::text = user_id::text);

-- reward_redemptions
CREATE POLICY "reward_redemptions_select_own" ON reward_redemptions FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "reward_redemptions_insert_own" ON reward_redemptions FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "reward_redemptions_update_own" ON reward_redemptions FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "reward_redemptions_delete_own" ON reward_redemptions FOR DELETE USING (auth.uid()::text = user_id::text);

-- recommendation_options (linked via recommendation_id)
CREATE POLICY "recommendation_options_select_own" ON recommendation_options FOR SELECT USING (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);
CREATE POLICY "recommendation_options_insert_own" ON recommendation_options FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);
CREATE POLICY "recommendation_options_update_own" ON recommendation_options FOR UPDATE USING (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);
CREATE POLICY "recommendation_options_delete_own" ON recommendation_options FOR DELETE USING (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);

-- inference_context (linked via recommendation_id)
CREATE POLICY "inference_context_select_own" ON inference_context FOR SELECT USING (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);
CREATE POLICY "inference_context_insert_own" ON inference_context FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);
CREATE POLICY "inference_context_update_own" ON inference_context FOR UPDATE USING (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);
CREATE POLICY "inference_context_delete_own" ON inference_context FOR DELETE USING (
  EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND auth.uid()::text = r.user_id::text)
);

-- consent_events
CREATE POLICY "consent_events_select_own" ON consent_events FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "consent_events_insert_own" ON consent_events FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "consent_events_update_own" ON consent_events FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "consent_events_delete_own" ON consent_events FOR DELETE USING (auth.uid()::text = user_id::text);


-- =============================================================================
-- STEP 2B: Read-only public policies for shared reference tables
-- =============================================================================
-- These tables contain shared reference data managed by the backend.
-- Anyone can read them, but only the service role can write to them.
-- =============================================================================

-- structural_knowledge
CREATE POLICY "structural_knowledge_select_public" ON structural_knowledge FOR SELECT USING (true);
CREATE POLICY "structural_knowledge_insert_none" ON structural_knowledge FOR INSERT WITH CHECK (false);
CREATE POLICY "structural_knowledge_update_none" ON structural_knowledge FOR UPDATE USING (false);
CREATE POLICY "structural_knowledge_delete_none" ON structural_knowledge FOR DELETE USING (false);

-- player_continuity
CREATE POLICY "player_continuity_select_public" ON player_continuity FOR SELECT USING (true);
CREATE POLICY "player_continuity_insert_none" ON player_continuity FOR INSERT WITH CHECK (false);
CREATE POLICY "player_continuity_update_none" ON player_continuity FOR UPDATE USING (false);
CREATE POLICY "player_continuity_delete_none" ON player_continuity FOR DELETE USING (false);

-- challenges
CREATE POLICY "challenges_select_public" ON challenges FOR SELECT USING (true);
CREATE POLICY "challenges_insert_none" ON challenges FOR INSERT WITH CHECK (false);
CREATE POLICY "challenges_update_none" ON challenges FOR UPDATE USING (false);
CREATE POLICY "challenges_delete_none" ON challenges FOR DELETE USING (false);

-- superscout_leagues
CREATE POLICY "superscout_leagues_select_public" ON superscout_leagues FOR SELECT USING (true);
CREATE POLICY "superscout_leagues_insert_none" ON superscout_leagues FOR INSERT WITH CHECK (false);
CREATE POLICY "superscout_leagues_update_none" ON superscout_leagues FOR UPDATE USING (false);
CREATE POLICY "superscout_leagues_delete_none" ON superscout_leagues FOR DELETE USING (false);
