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

### API Proxy
- `artifacts/api-server/src/routes/fpl.ts` — server-side proxy for FPL API to bypass CORS on web. Proxies: bootstrap-static, entry/{id}, entry/{id}/event/{gw}/picks, entry/{id}/transfers. Native mobile calls FPL directly.

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
