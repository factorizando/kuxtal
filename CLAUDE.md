# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**KuXtaL** is a Progressive Web App (PWA) for glucose and blood pressure monitoring designed for people with diabetes and their families. It features family group management with role-based access, real-time health alerts, and push notifications for critical readings.

## Commands

### Development
- `npm run dev` — Start Vite dev server (HMR enabled)
- `npm run build` — Build production bundle to `/dist`
- `npm run preview` — Preview production build locally
- `npm run lint` — Run ESLint on all `.js` and `.jsx` files

### Icon Generation
- `node scripts/generate-icons.js` — Generate PWA icons (icon-192.png, icon-512.png) for `/public/icons`

### Supabase (Local Development)
- `supabase start` — Start local Supabase stack
- `supabase stop` — Stop local Supabase stack
- `supabase functions deploy send-push-notification` — Deploy push notification edge function

## Tech Stack

- **Frontend**: React 19 + Vite (ESM modules)
- **State Management**: React hooks (local component state) + Zustand API available but not currently used
- **Styling**: Inline styles with color constants (no CSS-in-JS library); Tailwind CSS + PostCSS configured but minimal usage
- **PWA**: vite-plugin-pwa with manifest, service workers, and push notifications
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Storage, Realtime)
- **Push Notifications**: Web Push API with VAPID keys; service worker at `/public/sw-notifications.js`
- **Charts**: Recharts for glucose/BP visualization
- **Build**: Vite 8 with @vitejs/plugin-react (Oxc parser)
- **Linting**: ESLint with flat config, React Hooks plugin, React Refresh plugin

## Architecture

### Data Flow & State Management

**Authentication (useAuth hook)**
- Manages user session via Supabase Auth (persistent storage key: `kuxtal-auth`)
- Stores user profile in `profiles` table (full_name, avatar_url, glucose_hypo, glucose_target_high, glucose_high)
- Single Supabase client instance (singleton pattern in `/src/lib/supabase.js`) shared across the app
- Profile ranges persist per-user for glucose status calculations

**Readings & Data (useReadings hook)**
- Fetches last 50 glucose & BP readings from Supabase tables
- Supports viewing own data or a patient's data via `targetUserId` parameter (caregiver/admin use case)
- `recorded_by` field tracks who recorded a reading (important for family scenarios)
- Automatic alert dispatch: `sendAlertIfCritical()` triggers push notifications on dangerous values
  - Glucose: < 70 mg/dL (hypoglycemia) or > 250 mg/dL (very high)
  - BP: ≥ 180/120 mmHg (hypertensive crisis) or ≥ 140/90 mmHg (HTA Stage 2)
- Alerts sent via Supabase Edge Function `send-push-notification`

**Family Groups (useFamily hook)**
- Groups are managed via `family_groups` table with `family_memberships` join table
- Roles: `admin`, `caregiver`, `viewer`, `patient`
- Invitation system: generates 6-char alphanumeric codes, consumed via `join_family_group()` RPC
- Active group selection stored locally in component state (not persisted)
- Key RPC functions: `create_family_group()`, `join_family_group()`

### Component Hierarchy

```
App.jsx (main layout + screen routing)
├── AuthScreen.jsx (login/register form)
├── MainApp.jsx (health dashboard — glucose + BP charts, add readings)
├── FamilyScreen.jsx (manage groups, members, invitations, view other patients)
└── ProfileScreen.jsx (user settings, avatar, glucose ranges, push permissions)
```

All components use inline styles with shared color constants (`G="#059669"` primary green, `mu="#6B7280"` muted gray, etc.). No component library—all UI built with primitives.

### Screen Navigation

- **App screen**: Dashboard with readings and charts (default)
- **Family screen**: Family group management and member viewing
- **Profile screen**: User settings and preferences (full-screen modal)
- Bottom nav bar with 3 tabs (App, Family, Profile avatar)
- When viewing a patient's data, a blue banner appears showing "Viendo datos de [patient name]"

### API Layer

**Supabase Tables**
- `profiles` — full_name, avatar_url, glucose_hypo/target_high/high, push_endpoint (custom ranges per user)
- `glucose_readings` — user_id, recorded_by, value, context (timing), note, recorded_at
- `bp_readings` — user_id, recorded_by, systolic, diastolic, pulse, arm, note, recorded_at
- `family_groups` — name, created_at
- `family_memberships` — user_id, group_id, role
- `family_invitations` — group_id, code, role, created_by, created_at
- `push_subscriptions` — user_id, endpoint, subscription (JSON), created_at

**RPC Functions** (Supabase-managed)
- `create_family_group(group_name)` — Creates group and adds caller as admin
- `join_family_group(invitation_code)` — Validates code, adds caller to group
- Availability of other RPC functions not evident from client code; may exist in Supabase schema

**Edge Functions**
- `send-push-notification(subscription, title, body)` — Deno function using `web-push` npm package to send VAPID-signed notifications

### Push Notifications & Service Worker

- `usePushNotifications` hook manages Notification API and Push API subscription lifecycle
- Service worker registered at `/public/sw-notifications.js` (minimal stub in public/)
- VAPID public/private keys stored in `.env.local`
- Subscription stored in `push_subscriptions` table per user
- `useReadings.sendAlertIfCritical()` queries `push_subscriptions` for the data owner and dispatches via Edge Function
- Alert conditions defined in `/src/utils/analysis.js` (status classification + alert thresholds)

### Status & Alert Logic

**Glucose Status** (via `getGluStatus()`)
- `< hypo`: Hypoglycemia (red)
- `hypo..target_high`: In range (green)
- `target_high..high`: Elevated (amber)
- `> high`: Very elevated (red)

**BP Status** (via `getBPStatus()`)
- `< 120/80`: Normal (green)
- `< 130/80`: Elevated (amber)
- `< 140/90`: HTA Stage 1 (orange)
- `< 180/120`: HTA Stage 2 (red)
- `>= 180/120`: Hypertensive crisis (purple)

## Environment Variables

**Required** (in `.env.local`)
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key
- `VITE_VAPID_PUBLIC_KEY` — Web Push VAPID public key
- `VAPID_PRIVATE_KEY` — Web Push VAPID private key (server-side only)
- `VAPID_MAILTO` — Contact email for VAPID

## UI Patterns

- **Color System**: Predefined hex constants at top of each component (primary green `#059669`, text `#111827`, muted `#6B7280`, borders `#E5E7EB`, background `#F4F2ED`)
- **Card Layout**: `card()` factory function returns shared shadow + padding + border-radius
- **Label Style**: `lbl10()` factory for uppercase, small, muted labels
- **No CSS files**: All styling is inline `style` props; `App.css` exists but rarely used
- **Form Inputs**: Simple text/password inputs with consistent styling; no form library
- **Responsive**: Fixed bottom navigation, scrollable content area with padding to avoid nav overlap

## Key Files to Understand

- `/src/lib/supabase.js` — Supabase singleton initialization
- `/src/hooks/useAuth.js` — Authentication and profile CRUD
- `/src/hooks/useReadings.js` — Glucose/BP data fetching, insertion, alerts
- `/src/hooks/useFamily.js` — Family group management and role-based logic
- `/src/utils/analysis.js` — Status classification and alert determination
- `/src/pages/MainApp.jsx` — Main dashboard (longest file ~1500 LOC)
- `/src/pages/FamilyScreen.jsx` — Group/member management (~800 LOC)
- `vite.config.js` — PWA manifest and icon configuration

## Common Development Patterns

1. **Hook for async data** — All data fetching is in custom hooks (`useAuth`, `useReadings`, `useFamily`), not inline in components
2. **Callback pattern** — Parent component passes `onViewPatient`, `onRoleChange`, `onOpenProfile` callbacks to children
3. **Alert/Flash messages** — Components use local state with setTimeout for auto-dismiss UX
4. **Error handling** — Try/catch blocks in async handlers; errors stored in component state and displayed inline
5. **Optimistic updates** — State updated immediately after successful mutations (e.g., `setGluReadings([data, ...prev])`)
6. **Conditional rendering** — Based on `loading`, `user`, `myRole`, `viewingPatient` state flags

## Build & Deployment

- Vite outputs to `/dist/` with built-in code splitting and dynamic imports
- PWA manifest served from `/manifest.webmanifest` (generated by vite-plugin-pwa)
- Icons in `/public/icons/` (generated via `generate-icons.js`)
- `.npmrc` configured to resolve peer dependency conflicts on Vercel
- Environment variables loaded from `.env.local` via `import.meta.env.VITE_*`
- Service worker auto-registered on startup; push notification SW at `/sw-notifications.js`
