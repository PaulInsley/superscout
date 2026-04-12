# SuperScout

## Overview

SuperScout is an AI-powered mobile app designed to be a fantasy sports coach. It currently supports Fantasy Premier League (FPL) and is built with a sport-agnostic architecture, allowing for easy integration of new sports through swappable modules. The project aims to provide personalized strategic recommendations, enhance user engagement, and streamline decision-making for fantasy sports players.

## User Preferences

I prefer concise and clear communication.
I value iterative development and expect to be consulted before major architectural changes or feature implementations.
Please ensure all AI recommendations are validated against game rules before presentation.
I prefer to see real-time progress updates for longer operations, like transfer advice generation.
Do not make changes to the `artifacts/superscout/services/rules/fpl-2025-26.md` and `artifacts/superscout/services/rules/fpl-strategy-2025-26.md` files unless explicitly requested.
Ensure that any new features are designed with user privacy and GDPR compliance in mind, especially regarding data deletion.

## System Architecture

### Core Technologies
The application is built as a monorepo using `pnpm workspaces`, Node.js 24, TypeScript 5.9, and Expo (React Native) with `expo-router` for the mobile client. The backend API uses Express 5 and serves as a proxy for external APIs. Zod is used for validation, and Orval for API codegen from OpenAPI specs.

### Sport-Agnostic Design
A key architectural decision is the sport-agnostic nature of the application. Sport-specific logic is encapsulated in connector modules (e.g., `artifacts/superscout/services/fpl/`) and rules engine configurations. This allows for seamless expansion to other fantasy sports.

### Supabase Integration
Supabase serves as the primary database, managing user data, recommendations, outcomes, and various tracking information across 22 tables. All database writes are processed server-side via an API to enforce RLS and use service role keys for enhanced security. GDPR compliance is ensured through `ON DELETE CASCADE` for foreign keys and specific fields for user data deletion.

### AI Service
The AI service, utilizing Claude (claude-sonnet-4-6), generates recommendations based on user persona, game context, and dynamically injected rules. AI interactions are server-side only to protect API keys. A "Vibe System" allows users to choose an AI persona (Expert, Critic, Fanboy) which influences the tone and content of recommendations.

### Rules Engine & Validation
A dynamic rules engine loads and caches sport-specific rules, injecting them into AI prompts to ensure recommendations are compliant and strategically sound. A client-side validation layer further checks AI outputs (e.g., captain choices, transfers) against FPL rules before display, providing warnings or filtering invalid suggestions. A separate hallucination check layer (`artifacts/api-server/src/services/validation/hallucination-check.ts`) runs after AI generation and before results reach the client, verifying player existence (fuzzy-matched against FPL bootstrap data), team existence, fixture accuracy (corrected from API data if wrong), and flagging implausible stat claims for review. If hallucination removal leaves fewer than 2 options, one retry is triggered with an anti-hallucination prompt suffix. Wired into captain, transfer, and pre-generation routes.

### Key Features
- **Captain Picker**: Provides AI-powered captain recommendations with lineup optimisation, displaying choices with confidence badges (Banker, Calculated Risk, Bold Punt). Each recommendation includes bench status (`is_on_bench`) and optional `lineup_changes` array showing recommended sub swaps (player_in/player_out/reason) with a `lineup_note` summary. If a captain pick is on the bench, lineup changes are required to show how to get them into the starting XI. Free tier shows only the SuperScout Pick; Pro shows all 3-5 options. Handles edge cases: BGW/DGW banners, chip context (TC/BB/WC/FH), deadline-passed state with current captain display, season-not-started graceful fallback.
- **Transfer Advisor**: Offers AI-driven transfer advice. Server supports SSE streaming (web) and JSON fallback (mobile). Mobile client uses JSON with 60s AbortController timeout and user-friendly error messages with retry. Server-side logging at each stage (started, FPL data fetched, candidates filtered, AI generation started, AI response received, hallucination check done, response sent). Free tier shows only the top recommendation; Pro unlocks restructure packages and full multi-transfer advice. Handles edge cases: BGW/DGW banners with team lists, active chip banners, WC/FH squad overhaul mode, TC/BB chip-aware AI prompts.
- **Gameweek Analysis**: Shared utility (`artifacts/api-server/src/lib/gameweekAnalysis.ts`) detects blank gameweeks (teams with no fixture), double gameweeks (teams with 2+ fixtures), and injects context into AI prompts. Used by captain, transfer, and pre-generation routes.
- **Squad Card Generator**: Allows users to generate shareable gameweek squad cards with AI-generated quips, designed for social media. Free tier omits the AI quip; Pro includes full vibe-voiced commentary.
- **RevenueCat Subscription System**: Three-tier subscription model (Free, Pro Monthly £4.99/mo, Season Pass £29.99/yr). Both paid tiers grant a single `pro` entitlement. Feature gating via `useSubscription()` hook from `lib/revenuecat.tsx`. Paywall component at `components/Paywall.tsx`. Subscription events logged to `subscription_events` Supabase table. Purchase flow uses `queryClient.setQueryData()` for synchronous Pro status update. Dev mode: `__DEV__` toggle in Settings ("Dev Mode: Simulate Pro") overrides `isPro` to true without real purchase — hidden in production builds.
- **Privacy Policy Integration**: Privacy Policy and Terms of Service links in Settings (Legal section), Paywall (legal text below restore), onboarding ConnectFPLScreen (checkbox with consent logging to `consent_events` table), and landing page footer. URLs: `https://superscout.pro/privacy` and `https://superscout.pro/terms`. Full HTML pages served at `/privacy` and `/terms` by the landing page server (`server/serve.js`).
- **In-App Feedback System**: Two-channel feedback: (1) PulseCheck modal (`components/PulseCheck.tsx`) — 3-question post-gameweek survey (star rating, best feature, frustration text) shown once per GW after captain post-deadline results or squad card load, with 2-second delay, tracked in AsyncStorage; (2) FeedbackButton (`components/FeedbackButton.tsx`) — persistent feedback form with category selector (Bug/Feature request/Vibe feedback/Other) and 500-char text input, accessible from Settings Feedback section. Both write to `feedback_responses` Supabase table with `feedback_type` = 'pulse' or 'persistent'. Migration: `scripts/supabase-migration-feedback.sql`.
- **Onboarding Flow**: A guided first-time user experience to connect FPL accounts and choose an AI persona. Includes privacy consent checkbox that must be accepted before proceeding.
- **Mini-League Banter Engine**: AI-powered banter generation against mini-league rivals. Users connect up to 3 mini-leagues in Settings → Banter Leagues. The banter tab fetches rival squad data, identifies differentials, and generates personalized banter cards with headline, key battle, captain clash, verdict, and share line. Pro gating: free users see 1 card, blurred card for Pro upsell. Share mechanic: native share sheet (mobile) or clipboard (web), logged to `squad_cards` table with `card_type='banter'`. Banter stages in ProgressLoadingIndicator with 3s minimum loading delay. Pre-gen pipeline includes banter for users with connected leagues. API routes: `GET /api/banter/:gameweek`, `POST /api/banter/leagues`, `GET /api/banter/leagues/:userId`. FPL proxy routes: `GET /api/fpl/leagues-classic/:leagueId/standings`, `GET /api/fpl/leagues-h2h/:leagueId/standings`. Files: `api-server/src/routes/banter.ts`, `superscout/app/(tabs)/banter.tsx`, `superscout/components/BanterCard.tsx`.
- **Push Notifications System**: Sport-agnostic notification infrastructure using `expo-notifications`. Client service at `services/notifications/pushNotificationService.ts` (permission requests, token registration, local/scheduled notifications). FPL-specific trigger templates at `services/notifications/fpl-triggers.ts`. Server routes at `api-server/src/routes/notifications.ts`: token registration (`POST /register-token`), send single (`POST /send`), send batch (`POST /send-batch`), preferences CRUD (`GET/PUT /preferences`), schedule info (`GET /schedule-info`), log (`GET /log/:user_id`). 4 notification types: deadline reminder (2hr before), post-GW results (Monday 9am BST), price change alert (daily 3am BST), streak at risk (Thursday 6pm BST). Each type has 3 vibe variants (expert/critic/fanboy). Hard cap: max 3 notifications per gameweek per user. Smart skip: checks if user already acted. Priority order: deadline > price change > streak > results. Settings UI has 4 toggles. Price change alerts are Pro-only. Permission requested after onboarding. Preferences stored in `notification_preferences` jsonb column on users table. Log stored in `notification_log` table.
- **Decision Logging**: Server-side logging of all AI recommendations and user decisions for tracking outcomes and model improvement.
- **Auto-Pull Decisions**: Post-deadline process to automatically pull actual user captain choices from FPL API and compare against SuperScout recommendations.
- **Pre-Generation Pipeline**: Caches AI recommendations (captain picks and transfer advice) per user/vibe/gameweek before users open the app. Triggered via `POST /api/pre-generate/:gameweek` (auth: `Bearer PROCESS_DECISIONS_SECRET`). Three layers of cache checking: (1) Client-side pre-gen check via `GET /api/pre-generated/:gameweek`; (2) Server-side cache check inside `/api/transfer-advice` (looks up user by `fpl_manager_id`) and `/api/captain-picks` (uses `user_id` from request body); (3) Live AI fallback if no cache found. All three layers include **staleness checks** before serving cached data — checking recommended IN players' `status` (i/s/u), `chance_of_playing_next_round` (≤25%), and `news` keywords (injured/knock/doubt/suspended/illness/ruled out/not in squad) added after cache `generated_at`. Stale caches are discarded (marked `used: true`) and trigger live generation. Cache checks race against a 500ms timeout to avoid blocking. Responses include `source: "cached"` or `source: "live"` for debugging. Stored in `pre_generated_recommendations` Supabase table with expiry at gameweek deadline. Migration: `scripts/supabase-migration-pre-gen.sql`. Route: `artifacts/api-server/src/routes/preGenerate.ts`.
- **Admin Dashboard**: Web-based admin panel at `/api/admin` for browsing Supabase tables, viewing row counts, querying data, and running custom queries. Protected by cookie-based password auth (`ADMIN_PASSWORD` env var). Route: `artifacts/api-server/src/routes/admin.ts`.

### UI/UX & Interaction
- `ChoiceCard.tsx` is expandable: SuperScout Pick starts expanded (full text visible); other options start compact with truncated upside/risk/commentary and hidden lineup reasons. Tap to expand/collapse with "Read more ▼" / "Show less ▲" toggle.
- Reusable UI components like `ChoiceCard.tsx` and `TransferCard.tsx` ensure a consistent design.
- `ProgressLoadingIndicator.tsx` provides staged, animated progress for long-running AI operations, enhancing user experience by displaying vibe-voiced messages.
- The app features a dark theme as its primary aesthetic, seen in components like `SquadCard.tsx`.
- All screens access the Manager ID through a central `useManagerId.ts` hook for consistency.

## External Dependencies

- **Fantasy Premier League (FPL) API**: Primary data source for player statistics, fixtures, and user team information. Accessed via a cached, rate-limited proxy. Player names use `web_name` field (e.g. "Salah", "B.Fernandes", "Beto") everywhere — in AI prompts, display, hallucination checks, and validation. `second_name` is only used as a fallback for matching.
- **Anthropic Claude API**: Used for AI recommendation generation and text generation (e.g., squad card quips).
- **Supabase**: Backend-as-a-Service for database, authentication, and RLS.
- **Expo**: Framework for building universal React Native apps. EAS build config at `artifacts/superscout/eas.json`. iOS bundle ID: `pro.superscout.app`, Android package: `pro.superscout.app`. Note: `react-native-purchases` and `expo-media-library` plugins must be added to `app.json` plugins array for EAS builds (removed during dev as they crash Expo Go).
- **`react-native-view-shot`**: For capturing screenshots of UI components (e.g., Squad Cards).
- **`expo-sharing`**: For sharing functionality (e.g., sharing generated squad cards).
- **`expo-media-library`**: For saving generated images to the user's photo library.
- **`expo-notifications`**: Push and local notification handling. Configured in `services/notifications/pushNotificationService.ts`. Added to EAS build plugins in `app.config.js`.
- **`expo-device`**: Device detection for push token eligibility (tokens only work on physical devices).
- **RevenueCat (`react-native-purchases`)**: Client-side SDK for in-app purchases and subscription management. Configured in `lib/revenuecat.tsx`.
- **`@replit/revenuecat-sdk`**: Server-side SDK for RevenueCat REST API, used in the seed script (`scripts/src/seedRevenueCat.ts`).
