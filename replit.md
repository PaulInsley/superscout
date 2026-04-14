# SuperScout

## Overview
SuperScout is an AI-powered mobile application designed to function as a fantasy sports coach, currently supporting Fantasy Premier League (FPL). Its core purpose is to provide personalized strategic recommendations, enhance user engagement, and simplify decision-making for fantasy sports players. The project is built with a sport-agnostic architecture to facilitate easy expansion to other fantasy sports.

## User Preferences
I prefer concise and clear communication.
I value iterative development and expect to be consulted before major architectural changes or feature implementations.
Please ensure all AI recommendations are validated against game rules before presentation.
I prefer to see real-time progress updates for longer operations, like transfer advice generation.
Do not make changes to the `artifacts/superscout/services/rules/fpl-2025-26.md` and `artifacts/superscout/services/rules/fpl-strategy-2025-26.md` files unless explicitly requested.
Ensure that any new features are designed with user privacy and GDPR compliance in mind, especially regarding data deletion.

## System Architecture

### Core Technologies
The application is a monorepo utilizing `pnpm workspaces`, Node.js 24, TypeScript 5.9, and Expo (React Native) with `expo-router` for the mobile client. The backend API uses Express 5, acting as a proxy for external APIs. Zod is employed for validation, and Orval for API codegen from OpenAPI specifications.

### Sport-Agnostic Design
A fundamental architectural decision is the sport-agnostic nature of the application. Sport-specific logic is isolated within connector modules and rules engine configurations, enabling seamless integration of new sports.

### Supabase Integration
Supabase serves as the primary database for user data, recommendations, and outcomes, managing 22 tables. All database writes are processed server-side to enforce Row-Level Security (RLS) and use service role keys for enhanced security and GDPR compliance.

### AI Service
The AI service, powered by Claude (claude-sonnet-4-6), generates recommendations based on user persona, game context, and dynamic rule injection. All AI interactions occur server-side to secure API keys. A "Vibe System" allows users to select an AI persona (Expert, Critic, Fanboy) that influences the tone and content of recommendations.

### Rules Engine & Validation
A dynamic rules engine loads and caches sport-specific rules, injecting them into AI prompts to ensure compliant and strategically sound recommendations. A client-side validation layer further checks AI outputs against FPL rules, providing warnings or filtering invalid suggestions. A server-side hallucination check layer verifies player existence, team accuracy, and fixture data, correcting inaccuracies and flagging implausible claims.

### Key Features
- **Captain Picker**: AI-powered captain recommendations with lineup optimization and confidence badges.
- **Transfer Advisor**: AI-driven transfer advice with streaming support, robust error handling, and optimized response times (~12s warm-cache via parallelized FPL fetches, compressed AI prompts, position-grouped candidates, and graceful package validation that strips invalid swaps instead of dropping whole packages). Impact points are calculated deterministically server-side using `min(form, 12.0) × FDR_modifier × minutes_probability` over 3 GWs (free) or 5 GWs (hit). Form capped at 12.0 for calculation; display shows real API value. Minutes probability: null→1.0, otherwise cop/100. Extreme impacts (>30 for 3GW, >50 for 5GW) logged as warnings. Each recommendation is enriched with `player_in_fixtures`, `player_out_fixtures`, `computed_impact`, `projection_window`, and `breakeven_gw`. Form value sourced exclusively from FPL API — AI never generates form values. TransferCardV2 displays dual fixture strips (IN player on top, OUT player on bottom) with FDR colors: FDR1=#00875A, FDR2=#A3F5C1, FDR3=#E7E7E7, FDR4=#FF6B6B, FDR5=#80132B. SuperScout Pick card defaults to coaching expanded; all others collapsed. AI prompt includes "plays FOR" team labels, fixture opponents with "vs" prefix, and 5 critical coaching text rules (no own-team confusion, correct form usage, honest acknowledgment of form disadvantages, actual fixture references, internal consistency). Summary field supports **bold** markdown for key phrases.
- **Gameweek Analysis**: Utility for detecting blank and double gameweeks, providing context to AI prompts.
- **Squad Card Generator**: Allows users to create shareable gameweek squad cards with AI-generated commentary.
- **RevenueCat Subscription System**: Implements a three-tier subscription model (Free, Pro Monthly, Season Pass) with feature gating and subscription event logging.
- **Privacy Policy Integration**: Provides access to privacy policy and terms of service, including consent logging during onboarding.
- **In-App Feedback System**: Offers two channels for user feedback: a post-gameweek survey and a persistent feedback form.
- **Authentication**: Supabase Auth with email/password, session persistence via AsyncStorage, and secure user ID management. 3-way app routing: (1) valid session → main app, (2) no session + onboarding completed → sign-in only screen, (3) no session + never onboarded → full onboarding flow. Sign-out clears ALL user-specific AsyncStorage keys via `clearUserStorage()` (manager_id, team_name, persona, beginner state, notif prefs, pulse check keys, onboarding flag). Sign-in loads the new user's profile from Supabase via `GET /users/profile/:userId` and populates AsyncStorage with their data (manager_id, persona, team name from FPL API, onboarding status).
- **Onboarding Flow**: A guided first-time user experience with a 3-question Vibe Quiz (personality test mapping to Expert/Critic/Fanboy), FPL connect, account creation, beginner check, feature overview, and a real captain recommendation preview on the final screen. Returning users who sign out see only the sign-in screen, not the full onboarding.
- **Mini-League Banter Engine**: AI-powered banter generation against mini-league rivals, with Pro-gated access.
- **Push Notifications System**: Sport-agnostic notification infrastructure for deadline reminders, results, price changes, and streak alerts, with user-configurable preferences.
- **Streak System**: Tracks consecutive gameweeks of user activity, offering milestones and a "Streak Shield" for retention.
- **Decision Logging**: Logs all AI recommendations and user decisions for tracking outcomes and model improvement.
- **Auto-Pull Decisions**: Post-deadline process to automatically compare actual user captain choices with SuperScout recommendations.
- **Pre-Generation Pipeline**: Caches AI recommendations per user/vibe/gameweek, with staleness checks to ensure data freshness.
- **Admin Dashboard**: Web-based admin panel for browsing Supabase tables and running custom queries, protected by password authentication.
- **API Security**: Implements Helmet security headers, two-tier rate limiting for AI generation and data endpoints, Zod schema validation on all POST/PUT routes via `validateBody()` middleware, and per-request user-scoped Supabase clients (RLS enforced) for user-facing routes with service_role restricted to background jobs only.
- **Error Observability**: All catch blocks log meaningful warnings with context (no silent failures). Sentry crash reporting integrated on mobile with user context.
- **Test Suite**: Vitest test suite with 46 tests across 10 files covering Zod schemas, validation middleware, cache utilities, and JSON extraction.
- **Code Quality**: ESLint + Prettier configured with TypeScript support. Zero ESLint errors across the codebase.
- **Accessibility**: All interactive elements have accessibilityLabel and accessibilityRole attributes for VoiceOver/TalkBack support.

### UI/UX & Interaction
The UI features expandable `ChoiceCard.tsx` components, consistent design using reusable components, and `ProgressLoadingIndicator.tsx` for enhanced user experience during long AI operations. The app primarily uses a dark theme and centrally manages Manager ID access.

## External Dependencies

- **Fantasy Premier League (FPL) API**: Main data source for player stats, fixtures, and user team information, accessed via a cached proxy.
- **Anthropic Claude API**: Utilized for AI recommendation and text generation.
- **Supabase**: Backend-as-a-Service for database, authentication, and RLS.
- **Expo**: Framework for building universal React Native applications.
- **`react-native-view-shot`**: For capturing UI component screenshots.
- **`expo-sharing`**: For sharing functionality.
- **`expo-media-library`**: For saving generated images to the user's photo library.
- **`expo-notifications`**: Handles push and local notifications.
- **`expo-device`**: Used for device detection in notification handling.
- **RevenueCat (`react-native-purchases`)**: Client-side SDK for in-app purchases and subscription management.
- **`@replit/revenuecat-sdk`**: Server-side SDK for RevenueCat REST API.