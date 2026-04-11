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
- **Transfer Advisor**: Offers AI-driven transfer advice with SSE streaming for real-time progress updates. Free tier shows only the top recommendation; Pro unlocks restructure packages and full multi-transfer advice. Handles edge cases: BGW/DGW banners with team lists, active chip banners, WC/FH squad overhaul mode, TC/BB chip-aware AI prompts.
- **Gameweek Analysis**: Shared utility (`artifacts/api-server/src/lib/gameweekAnalysis.ts`) detects blank gameweeks (teams with no fixture), double gameweeks (teams with 2+ fixtures), and injects context into AI prompts. Used by captain, transfer, and pre-generation routes.
- **Squad Card Generator**: Allows users to generate shareable gameweek squad cards with AI-generated quips, designed for social media. Free tier omits the AI quip; Pro includes full vibe-voiced commentary.
- **RevenueCat Subscription System**: Three-tier subscription model (Free, Pro Monthly £4.99/mo, Season Pass £29.99/yr). Both paid tiers grant a single `pro` entitlement. Feature gating via `useSubscription()` hook from `lib/revenuecat.tsx`. Paywall component at `components/Paywall.tsx`. Subscription events logged to `subscription_events` Supabase table.
- **Privacy Policy Integration**: Privacy Policy and Terms of Service links in Settings (Legal section), Paywall (legal text below restore), onboarding ConnectFPLScreen (checkbox with consent logging to `consent_events` table), and landing page footer. URLs: `https://superscout.pro/privacy` and `https://superscout.pro/terms`. Full HTML pages served at `/privacy` and `/terms` by the landing page server (`server/serve.js`).
- **In-App Feedback System**: Two-channel feedback: (1) PulseCheck modal (`components/PulseCheck.tsx`) — 3-question post-gameweek survey (star rating, best feature, frustration text) shown once per GW after captain post-deadline results or squad card load, with 2-second delay, tracked in AsyncStorage; (2) FeedbackButton (`components/FeedbackButton.tsx`) — persistent feedback form with category selector (Bug/Feature request/Vibe feedback/Other) and 500-char text input, accessible from Settings Feedback section. Both write to `feedback_responses` Supabase table with `feedback_type` = 'pulse' or 'persistent'. Migration: `scripts/supabase-migration-feedback.sql`.
- **Onboarding Flow**: A guided first-time user experience to connect FPL accounts and choose an AI persona. Includes privacy consent checkbox that must be accepted before proceeding.
- **Decision Logging**: Server-side logging of all AI recommendations and user decisions for tracking outcomes and model improvement.
- **Auto-Pull Decisions**: Post-deadline process to automatically pull actual user captain choices from FPL API and compare against SuperScout recommendations.
- **Pre-Generation Pipeline**: Caches AI recommendations (captain picks and transfer advice) per user/vibe/gameweek before users open the app. Triggered via `POST /api/pre-generate/:gameweek` (auth: `Bearer PROCESS_DECISIONS_SECRET`). Clients check `GET /api/pre-generated/:gameweek` (supports `current` as gameweek) before making live AI calls, falling back to real-time generation if no cached result exists. Stored in `pre_generated_recommendations` Supabase table with expiry at gameweek deadline. Migration: `scripts/supabase-migration-pre-gen.sql`. Route: `artifacts/api-server/src/routes/preGenerate.ts`.
- **Admin Dashboard**: Web-based admin panel at `/api/admin` for browsing Supabase tables, viewing row counts, querying data, and running custom queries. Protected by cookie-based password auth (`ADMIN_PASSWORD` env var). Route: `artifacts/api-server/src/routes/admin.ts`.

### UI/UX & Interaction
- Reusable UI components like `ChoiceCard.tsx` and `TransferCard.tsx` ensure a consistent design.
- `ProgressLoadingIndicator.tsx` provides staged, animated progress for long-running AI operations, enhancing user experience by displaying vibe-voiced messages.
- The app features a dark theme as its primary aesthetic, seen in components like `SquadCard.tsx`.
- All screens access the Manager ID through a central `useManagerId.ts` hook for consistency.

## External Dependencies

- **Fantasy Premier League (FPL) API**: Primary data source for player statistics, fixtures, and user team information. Accessed via a cached, rate-limited proxy.
- **Anthropic Claude API**: Used for AI recommendation generation and text generation (e.g., squad card quips).
- **Supabase**: Backend-as-a-Service for database, authentication, and RLS.
- **Expo**: Framework for building universal React Native apps. EAS build config at `artifacts/superscout/eas.json`. iOS bundle ID: `pro.superscout.app`, Android package: `pro.superscout.app`. Note: `react-native-purchases` and `expo-media-library` plugins must be added to `app.json` plugins array for EAS builds (removed during dev as they crash Expo Go).
- **`react-native-view-shot`**: For capturing screenshots of UI components (e.g., Squad Cards).
- **`expo-sharing`**: For sharing functionality (e.g., sharing generated squad cards).
- **`expo-media-library`**: For saving generated images to the user's photo library.
- **RevenueCat (`react-native-purchases`)**: Client-side SDK for in-app purchases and subscription management. Configured in `lib/revenuecat.tsx`.
- **`@replit/revenuecat-sdk`**: Server-side SDK for RevenueCat REST API, used in the seed script (`scripts/src/seedRevenueCat.ts`).
