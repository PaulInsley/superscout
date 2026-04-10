# SuperScout

## Overview

SuperScout is a fantasy sports AI coach mobile app built with Expo (React Native). Currently connects to the Fantasy Premier League (FPL) API. The architecture is sport-agnostic — sport-specific data connectors live in swappable modules.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Mobile**: Expo (React Native) with expo-router
- **API framework**: Express 5 (backend proxy for CORS)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Architecture

### Brand Config
- `artifacts/superscout/constants/config.ts` — single source of truth for the brand name "SuperScout". All screens pull from this file.

### Sport Connectors (sport-agnostic pattern)
- `artifacts/superscout/services/fpl/` — FPL connector module
  - `types.ts` — FPL-specific data types and normalized player interface
  - `api.ts` — API calls to FPL (uses proxy on web, direct on native)
  - `index.ts` — barrel export
- To add a new sport: create `services/<sport>/` with the same pattern (types, api, index)

### Supabase Database
- `artifacts/superscout/services/supabase.ts` — shared Supabase client (reads EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY)
- `scripts/supabase-migration.sql` — full schema (18 tables) with indexes and RLS
- **21 tables**: users, recommendations, user_decisions, outcomes, source_tracking, structural_knowledge, player_continuity, streaks, manager_profiles, squad_cards, subscription_events, mini_league_context, challenges, challenge_entries, superscout_leagues, league_memberships, challenge_points_balance, reward_redemptions, recommendation_options, inference_context, consent_events
- `scripts/supabase-migration-v2.sql` — v2 additions: recommendation_options (normalised options), inference_context (AI model tracking), consent_events (GDPR), user GDPR deletion fields
- `scripts/supabase-migration-sport-interest.sql` — Table 22: `sport_interest` (cross-sport discovery nudges, RLS enabled, no policies yet)
- Tables 13-18 (challenges, engagement, leagues) are empty by design until GW15
- RLS tightened: owner-scoped policies on user-data tables (auth.uid() = user_id), read-only public on reference tables
- `scripts/supabase-rls-fix.sql` — RLS policy migration (owner-scoped access controls on all 21 tables)
- All foreign keys use ON DELETE CASCADE for GDPR compliance
- Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD

### AI Service
- `artifacts/superscout/services/ai.ts` — `generateRecommendation(persona, context)` function using Claude (claude-sonnet-4-6, max_tokens: 2000)
- Shared system prompt: `sharedSystemPrompt.ts`; vibe-specific prompts in `config/vibes/vibePrompts.ts`
- **Server-side only**: ai.ts is NOT imported from the React Native app bundle (app/ directory). It will be called via the API server to keep the Anthropic API key out of the app binary.

### FPL Rules Engine (sport-agnostic)
- `artifacts/superscout/services/rules/fpl-2025-26.md` — Complete FPL 2025/26 ruleset (R1-R11: squad composition, transfers, pricing, captaincy, chips, scoring, defensive contributions, assists, BPS, auto-subs, deadlines)
- `artifacts/superscout/services/rules/fpl-strategy-2025-26.md` — Strategic context (SC1-SC6: chip strategy, transfer strategy, captain strategy, defensive contributions, fixture difficulty, season phases)
- `artifacts/api-server/src/lib/rulesEngine.ts` — Loads and caches rules files at startup, provides `getRulesContext(gameweek)` which includes current season phase. Sport-configurable — add new sports by adding entries to `SPORT_CONFIGS`.
- Rules are injected into every AI system prompt: vibe prompt + rules + strategy + feature-specific instructions
- Architecture: rules files are the only sport-specific part. When F1 Fantasy is added, create `services/rules/f1-2026.md` and register in `SPORT_CONFIGS`.

### Validation Layer
- `artifacts/superscout/services/validation/fpl-validator.ts` — Pre-display validation for AI recommendations
- Captain validation: checks player is in starting XI (R4.03), has a fixture, is not injured; adds warnings for doubtful players
- Transfer validation (ready for Transfer Advisor): budget check with sell price formula (R3.06), club limit (R1.03), position count (R1.04)
- Returns: unchanged recommendation (valid), recommendation with warning (doubtful), or null (invalid — filtered out)

### Decision Log
- **Server-side** via API server routes — all Supabase writes go through the API server using the service role key (not the client anon key, which is blocked by RLS for unauthenticated users)
- `artifacts/api-server/src/routes/decisionLog.ts` — POST `/api/decision-log/recommendation` and POST `/api/decision-log/decision`
- `artifacts/api-server/src/lib/supabase.ts` — Supabase client using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Captain.tsx calls these API endpoints instead of Supabase directly; all calls fail silently
- Anonymous user uses nil UUID `00000000-0000-0000-0000-000000000000` (pre-created in users table)
- Season hardcoded to '2026-27', engine_level to 1 (FPL API only)
- Tables written: recommendations, recommendation_options, inference_context, user_decisions
- Confidence labels stored as-is: BANKER, CALCULATED_RISK, BOLD_PUNT (DB CHECK constraint updated to match AI output)
- Decision type values: 'captain', 'transfer', 'chip_usage', 'lineup' (CHECK constraint on recommendations)

### Captain Picker
- `app/(tabs)/captain.tsx` — Captain Picker tab screen with AI-powered captain recommendations
- Loads squad data via `fetchCaptainCandidates()`, sends to AI via `/api/captain-picks` POST, displays 3 `ChoiceCard` components
- `components/ChoiceCard.tsx` — reusable card component with confidence badges: **Banker** (green), **Calculated Risk** (amber), **Bold Punt** (orange). SuperScout Pick badge.
- No confirm button — user reads advice then sets captain in the official FPL app. Subtle reminder text shown at bottom.
- Regenerate button lets user re-run recommendations.
- Vibe re-read on tab focus via `useFocusEffect` — switching vibe in Settings clears old recommendations
- Mock data fallback for off-season testing via `getMockCaptainData()`
- Silent Decision Log writes on recommendation generation (not on confirm — there is no confirm)
- API URL pattern: web uses `https://${EXPO_PUBLIC_DOMAIN}/api/captain-picks` (not `/api-server/api/...` — POST routing through Replit proxy only works with the `/api` prefix)

### Auto-Pull Decisions
- `artifacts/api-server/src/routes/processDecisions.ts` — POST `/api/process-decisions/:gameweek`
- Runs after a gameweek deadline; pulls actual captain choices from FPL API and writes to `user_decisions`
- Accepts optional `manager_id` in body for single-user mode (current anonymous user setup)
- Fetches bootstrap-static once for player name resolution, then iterates over all recommendations for that GW
- Logs: processed count, matched (user followed SuperScout advice), ignored (user chose differently)
- Skips users with no FPL ID, already-processed recommendations, or FPL API errors

### FPL API Caching Layer
- `artifacts/api-server/src/lib/fplCache.ts` — In-memory 3-tier cache: Static (6hr TTL), Semi-Live (30min/2min during live matches), User-specific (5min)
- `artifacts/api-server/src/lib/fplRateLimiter.ts` — Sequential request queue, 1 req/2s, exponential backoff on 429/5xx (1s→2s→4s→8s, max 60s), 15s timeout
- All FPL proxy routes go through cache — cache metadata in response headers (`X-Cache: HIT/MISS/STALE`, `X-Cache-Age`)
- Fallback: stale cache served when FPL API is down; never shows blank screen
- Live match detection: checks fixture `started/finished` to toggle semi-live polling rate

### Transfer Advisor
- `artifacts/api-server/src/routes/transfer.ts` — POST `/api/transfer-advice` endpoint with **SSE streaming** (Accept: text/event-stream)
- Pre-filters 500+ players to top 50 candidates by: form × fixture difficulty × points-per-million
- Ensures minimum 5 players per position in candidate pool
- Assembles context: squad with selling prices, free transfers, budget, chips remaining, filtered candidates
- Server-side validation: budget check, club limit (R1.03), position count (R1.04), position match enforcement, player availability
- AI returns 4-5 recommendations: 2-3 packages + 1 individual swap + 1 hold option
- **SSE Progress Stages**: Backend streams real-time stage events: `squad` → `market` → `rules` → `ai` → `validating` → `done` → `result`. Non-SSE clients still get standard JSON response (backward compatible).
- **Restructure Mode**: Prompt and response shape adapt based on free transfer count:
  - 0-1 FT: Individual swaps only + hold option
  - 2-3 FT: Mixed mode — 1-2 packages + 1-2 individual swaps + hold
  - 4+ FT: Restructure — 2-3 packages with different strategic themes + 1 swap + hold
  - Wildcard/Free Hit active (current GW chip): Full squad overhaul packages (3-6 transfers each)
- **Package format**: `is_package: true`, `package_name` (creative name), `transfers[]` array of individual swaps, `total_net_cost`, `total_hit_cost`, `uses_free_transfers`, `total_expected_points_gain_3gw`
- **Package validation**: Validates entire package sequentially — simulates squad state after each swap, checks budget/club limits/position counts across all transfers combined
- `artifacts/superscout/components/TransferCard.tsx` — Transfer-specific card with OUT→IN swap layout, net cost, hit/free indicator, 3GW impact. Package mode shows banner with package name, all swaps listed with dividers, combined impact stats
- `artifacts/superscout/app/(tabs)/transfers.tsx` — Transfer Advisor tab with SSE streaming, summary bar, card display, regenerate button
- Decision Log writes with `decision_type: "transfer"` (matches DB CHECK constraint); package options logged with `option_type: "package"`
- processDecisions extended: also checks actual FPL transfers after deadline and matches against recommendations

### Progress Loading Indicator
- `artifacts/superscout/components/ProgressLoadingIndicator.tsx` — Shared staged progress bar component with vibe-voiced messages
- Shows named stages with animated progress bar (not a spinner): "Loading your squad" → "Scanning the transfer market" → "Checking rules and budget" → "Your [vibe] is analysing options" → "Validating recommendations" → "Done!"
- Each stage has unique messages per vibe (Expert/Critic/Fanboy)
- Transfer Advisor: driven by real SSE stage events from the backend
- Captain Picker: driven by optimistic timing (1s squad → 1.5s rules → ai → ai_deep after 8s → validating when response arrives)
- AI stage animates bar slowly from 45% to 85% over 15 seconds, holds until response
- Two variants: `transfer` (6 stages) and `captain` (5 stages)
- Replaces the previous `AILoadingIndicator` (spinning wheel + cycling messages)

### Squad Card Generator
- `artifacts/api-server/src/routes/squadCard.ts` — POST `/api/squad-card` endpoint for generating shareable gameweek squad cards
- Fetches: manager info, picks, live points, history (for rank movement) from FPL API via rate limiter + cache
- Generates AI quip via Claude (max_tokens: 200) using the user's chosen vibe voice — one shareable sentence about their gameweek
- Logs every card generation to `squad_cards` table in Supabase
- POST `/api/squad-card/share` — updates `was_shared` and `share_platform` when user taps Share
- Returns: team name, formation string, starters with points, bench with points, total points, rank/rank change, GW average, quip text
- `artifacts/superscout/components/SquadCard.tsx` — Premium dark card component (1080x1350, 4:5 ratio for Instagram/Twitter)
  - Dark background (#0f1923), formation layout (FWD top, GK bottom), captain gold highlight
  - Points per player, total points (large), rank movement (green up/red down), bench section with auto-sub markers
  - AI quip in styled speech area, SuperScout branding, "superscout.pro" CTA footer
- `artifacts/superscout/app/(tabs)/card.tsx` — Card tab screen with generate/share/save flow
  - Uses `react-native-view-shot` for image capture, `expo-sharing` for share sheet, `expo-media-library` for save to photos
  - Edge cases: unfinished gameweek, no picks, no finished GWs, AI quip failure (uses fallback)
  - Optimistic loading stages via ProgressLoadingIndicator
- Tab position: between Transfers and My Squad in the tab bar

### API Proxy
- `artifacts/api-server/src/routes/fpl.ts` — server-side proxy for FPL API (now cached). Proxies: bootstrap-static, entry/{id}, entry/{id}/event/{gw}/picks, entry/{id}/transfers, entry/{id}/history, fixtures, event/{event}/live. Native mobile calls FPL directly.
- `artifacts/api-server/src/routes/captain.ts` — POST `/api/captain-picks` endpoint for AI captain recommendations using Claude, with robust JSON extraction (balanced-brace parser)
- CORS: exact origin matching with Set; `*.replit.dev` wildcard allowed in dev only

### Onboarding Flow
- `artifacts/superscout/app/onboarding/` — 5-screen onboarding flow shown on first launch
  - WelcomeScreen → ConnectFPLScreen → ChoosePersonaScreen → WhatWeDoScreen → YoureInScreen
  - FPL Manager ID saved to AsyncStorage (`superscout_manager_id`) + team name (`superscout_team_name`) + Supabase `users.fpl_manager_id`
  - Vibe choice saved to AsyncStorage key `superscout_persona` (internal key unchanged)
  - Completion stored in AsyncStorage key `superscout_onboarding_complete`
  - Root layout (`_layout.tsx`) checks onboarding status on launch and shows flow before main tabs if not completed
  - `fetchTeamName()` in `services/fpl/teamLookup.ts` — lightweight FPL API lookup for onboarding
  - **Manager ID Entry**: ConnectFPLScreen has a single Manager ID input with a "Find" button
    - Numeric ID lookup via `fetchTeamName()` → `/api/fpl/entry/{id}/`
    - Confirmed team name displayed with green checkmark and "That's my team" button
    - "How to find your Manager ID" help card with 3 numbered steps + example URL
  - `fetchTeamName()` in `services/fpl/teamLookup.ts` — lightweight entry lookup
  - **FPL API limitation (confirmed via testing)**: The FPL API has NO text search for managers. League 314's `searching=true&search=` parameter is completely ignored (returns top 50 by rank). Mini-league search params are also ignored. The only reliable lookup is by numeric Manager ID via `/entry/{id}/`.

### Vibe System (AI Personality Engine)
- `artifacts/api-server/src/lib/vibes.ts` — Server-side shared VIBE_PROMPTS used by both captain.ts and transfer.ts (single source of truth for AI persona prompts)
- `config/vibes/vibePrompts.ts` — Client-side three sport-agnostic AI system prompts (Expert, Critic, Fanboy) with shared rules
- `config/vibes/fpl/banterSheet.ts` — Premier League team banter data (all 20 clubs + promoted template) with FPL API IDs
- `config/vibes/fpl/rivalryMap.ts` — Rivalry pairs, banter rules, and `buildBanterContext()` helper
- `config/vibes/index.ts` — Barrel export for all vibe config
- Architecture: vibe prompts are sport-agnostic; banter sheet and rivalry map are in `fpl/` subfolder so F1 or other sports can add their own without touching prompts
- Banter rules: only Critic and Fanboy use banter; Expert never does; suppressed after 3+ consecutive red arrows; rivalry matches protect user's team

### Manager ID — Single Source of Truth
- `hooks/useManagerId.ts` — shared hook that all screens use for manager ID access
  - Reads from AsyncStorage (`superscout_manager_id`, `superscout_team_name`) on mount
  - `setManager(id, name)` writes to AsyncStorage + Supabase `users.fpl_manager_id`
  - `clearManager()` removes from both AsyncStorage and Supabase
  - Used by: Settings, My Squad, Captain Picker, Transfer Advisor
- No screen has its own Manager ID input — all read from this hook
- If no manager ID is set, screens show "Connect your FPL account in Settings" with a link icon

### Settings Screen
- `app/(tabs)/settings.tsx` — Settings tab with FPL Account + Vibe sections
- **FPL Account**: Shows connected team name + manager ID with "Change" option, or "Connect your FPL Team" prompt. Opens the same ConnectFPLScreen from onboarding with a back button.
- **Vibe**: Opens the same vibe picker used during onboarding (with `isSettings` prop)
- User-facing terminology is "Vibe" everywhere; internal variable names and DB field (`default_persona`) remain unchanged
- Saves vibe to AsyncStorage and Supabase `users.default_persona` when authenticated

### My Squad Screen
- `app/(tabs)/squad.tsx` — Manager squad screen with three sub-tabs (Squad, Transfers, Leagues)
- Manager ID stored locally via AsyncStorage for persistence across sessions
- Handles edge cases: new managers with no picks, null stats, API errors, invalid manager IDs

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
