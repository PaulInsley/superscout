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
- Tables 13-18 (challenges, engagement, leagues) are empty by design until GW15
- RLS tightened: owner-scoped policies on user-data tables (auth.uid() = user_id), read-only public on reference tables
- `scripts/supabase-rls-fix.sql` — RLS policy migration (owner-scoped access controls on all 21 tables)
- All foreign keys use ON DELETE CASCADE for GDPR compliance
- Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD

### AI Service
- `artifacts/superscout/services/ai.ts` — `generateRecommendation(persona, context)` function using Claude (claude-sonnet-4-6, max_tokens: 1000)
- Shared system prompt: `sharedSystemPrompt.ts`; vibe-specific prompts in `config/vibes/vibePrompts.ts`
- **Server-side only**: ai.ts is NOT imported from the React Native app bundle (app/ directory). It will be called via the API server to keep the Anthropic API key out of the app binary.

### Decision Log
- **Server-side** via API server routes — all Supabase writes go through the API server using the service role key (not the client anon key, which is blocked by RLS for unauthenticated users)
- `artifacts/api-server/src/routes/decisionLog.ts` — POST `/api/decision-log/recommendation` and POST `/api/decision-log/decision`
- `artifacts/api-server/src/lib/supabase.ts` — Supabase client using `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Captain.tsx calls these API endpoints instead of Supabase directly; all calls fail silently
- Anonymous user uses nil UUID `00000000-0000-0000-0000-000000000000` (pre-created in users table)
- Season hardcoded to '2026-27', engine_level to 1 (FPL API only)
- Tables written: recommendations, recommendation_options, inference_context, user_decisions

### Captain Picker
- `app/(tabs)/captain.tsx` — Captain Picker tab screen with AI-powered captain recommendations
- Loads squad data via `fetchCaptainCandidates()`, sends to AI via `/api/captain-picks` POST, displays 3 `ChoiceCard` components
- `components/ChoiceCard.tsx` — reusable card component with confidence badges (HIGH=green, MEDIUM=amber, SPECULATIVE=red), SuperScout Pick badge
- `services/ai/captainPrompt.ts` — captain-picker instruction prompt
- `services/ai/generateCaptainPicks.ts` — combines context + vibe prompt + sends to AI
- Mock data fallback for off-season testing via `getMockCaptainData()`
- Silent Decision Log writes on captain confirmation
- API URL pattern: web uses `https://${EXPO_PUBLIC_DOMAIN}/api/captain-picks` (not `/api-server/api/...` — POST routing through Replit proxy only works with the `/api` prefix)

### API Proxy
- `artifacts/api-server/src/routes/fpl.ts` — server-side proxy for FPL API to bypass CORS on web. Proxies: bootstrap-static, entry/{id}, entry/{id}/event/{gw}/picks, entry/{id}/transfers, fixtures, event/{event}/live. Native mobile calls FPL directly.
- `artifacts/api-server/src/routes/captain.ts` — POST `/api/captain-picks` endpoint for AI captain recommendations using Claude, with robust JSON extraction (balanced-brace parser)
- CORS: exact origin matching with Set; `*.replit.dev` wildcard allowed in dev only

### Onboarding Flow
- `artifacts/superscout/app/onboarding/` — 5-screen onboarding flow shown on first launch
  - WelcomeScreen → ConnectFPLScreen → ChoosePersonaScreen → WhatWeDoScreen → YoureInScreen
  - FPL Manager ID entered during onboarding pre-populates the Squad screen (shared AsyncStorage key `superscout_manager_id`)
  - Vibe choice saved to AsyncStorage key `superscout_persona` (internal key unchanged)
  - Completion stored in AsyncStorage key `superscout_onboarding_complete`
  - Root layout (`_layout.tsx`) checks onboarding status on launch and shows flow before main tabs if not completed
  - `fetchTeamName()` in `services/fpl/teamLookup.ts` — lightweight FPL API lookup for onboarding

### Vibe System (AI Personality Engine)
- `config/vibes/vibePrompts.ts` — Three sport-agnostic AI system prompts (Expert, Critic, Fanboy) with shared rules
- `config/vibes/fpl/banterSheet.ts` — Premier League team banter data (all 20 clubs + promoted template) with FPL API IDs
- `config/vibes/fpl/rivalryMap.ts` — Rivalry pairs, banter rules, and `buildBanterContext()` helper
- `config/vibes/index.ts` — Barrel export for all vibe config
- Architecture: vibe prompts are sport-agnostic; banter sheet and rivalry map are in `fpl/` subfolder so F1 or other sports can add their own without touching prompts
- Banter rules: only Critic and Fanboy use banter; Expert never does; suppressed after 3+ consecutive red arrows; rivalry matches protect user's team

### Settings Screen
- `app/(tabs)/settings.tsx` — Settings tab with "Change your Vibe" option
- Opens the same vibe picker used during onboarding (with `isSettings` prop)
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
