# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**KuXtaL** is a Progressive Web App (PWA) for glucose and blood pressure monitoring designed for people with diabetes and their families. It features family group management with role-based access, medication scheduling with adherence tracking, budget management with an expense approval workflow, inventory tracking with AI-powered medication information, real-time health alerts, push notifications for critical readings, and analytics/reporting.

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
- `supabase functions deploy generate-med-info` — Deploy AI medication info edge function

## Tech Stack

- **Frontend**: React 19 + Vite (ESM modules)
- **State Management**: React hooks (local component state) + Zustand API available but not currently used
- **Styling**: Inline styles with color constants (no CSS-in-JS library); Tailwind CSS + PostCSS configured but minimal usage
- **PWA**: vite-plugin-pwa with manifest, service workers, and push notifications
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Storage, Realtime)
- **Push Notifications**: Web Push API with VAPID keys; service worker at `/public/sw-notifications.js`
- **Charts**: Recharts for glucose/BP visualization and reporting
- **AI Integration**: Anthropic Claude API (via `@anthropic-ai/sdk`) for auto-generating medication information
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

**Medications (useMedications hook)**
- Manages medication schedules (`medication_schedules`), intakes (`medication_intakes`), and consultations (`consultations`)
- Schedule frequency types: `daily`, `every_n_days`, `days_of_week`, `as_needed`
- `markTaken` / `unmarkTaken` tracks daily adherence per scheduled dose
- `saveConsultation()` implements a guided consultation flow:
  1. Optionally creates a budget entry for the consultation cost (linked via `budget_entry_id`)
  2. Creates the consultation record
  3. Processes decisions on existing schedules: `keep` (no-op), `suspend` (close with end date), `adjust` (close old + insert new linked to consultation)
  4. Creates new schedules from `newSchedules` array
  5. Calls `recalcItemConsumption()` for each affected inventory item to re-anchor stock and update `consumption_per_day`
- `updateConsultation()` syncs the linked budget entry (create/update/delete) when cost changes
- `deleteConsultation()` cascades: deletes the linked budget entry if present; schedule FK `consultation_id` is `ON DELETE SET NULL`
- `recalcItemConsumption(itemId)` derives `consumption_per_day` from active schedules via `dailyDose()`, re-anchors current stock by decaying consumption since `quantity_updated_at`. When no active schedules remain (`perDay <= 0`), sets `active = false` on the item (auto-deactivation). When schedules are re-added, sets `active = true` (auto-reactivation). Items with `active = false` don't trigger stock alerts and show "Sin pautas" in the inventory UI.
- Realtime subscriptions on `medication_schedules`, `consultations`, `medication_intakes`

**Budget Requests (useRequests hook)**
- Expense approval workflow via `budget_requests` table
- Lifecycle: `pending` → `approved` | `rejected`
- `addRequest()` creates request and notifies all group admins via push notification (queries `family_memberships` for admins, then `push_subscriptions` for their endpoints)
- `approveRequest()` accepts optional `addEntryFn` (creates budget entry), `restockFn` + `restockQuantity` (triggers inventory restock), and `actualAmount` (override requested amount)
- `rejectRequest()` stores a `response_note`
- Realtime subscription on `budget_requests`

**Audit Log (useAuditLog hook)**
- Tracks changes to inventory and budget entities via `audit_log` table
- `logAction()` inserts entries with `entity_type`, `entity_id`, `action`, and optional `before`/`after` JSON snapshots
- Used by inventory operations (adjust, restock, delete) and budget entries
- Realtime subscription on `audit_log` INSERTs; limited to 200 most recent entries

**Swipe Navigation (useSwipe hook)**
- Touch gesture handler detecting horizontal swipe left/right with configurable threshold (default 48px)
- Returns `onTouchStart`, `onTouchEnd`, `onTouchCancel` handlers to spread on a container
- Optional `fromRightEdge` mode restricts detection to the rightmost `edgeWidth` pixels
- Used in App.jsx to cycle through the 5 main screens; swipe-right on first screen triggers double-back-to-exit

### Component Hierarchy

```
App.jsx (main layout + 5-tab screen routing + swipe navigation + double-back-to-exit)
├── AuthScreen.jsx (login/register form)
├── MainApp.jsx (health dashboard — glucose + BP charts, add readings, 4 sub-tabs)
├── MedsScreen.jsx (medication schedules, daily doses, consultations)
├── FamilyScreen.jsx (manage groups, members, invitations, view other patients)
├── BudgetScreen.jsx (budget entries, inventory, requests, audit log — 4 sub-tabs)
├── ReportScreen.jsx (analytics with ComposedChart, distribution bars, statistics)
└── ProfileScreen.jsx (user settings, avatar, glucose ranges, push permissions)
```

All components use inline styles with shared color constants (`G="#059669"` primary green, `mu="#6B7280"` muted gray, etc.). No component library—all UI built with primitives.

### Screen Navigation

- **5 main screens**: Salud (app), Meds, Familia, Presupuesto, Informe — accessed via bottom tab bar
- **Profile screen**: Full-screen modal overlay (pushed onto History API stack)
- Bottom nav bar with 5 tabs, each with icon + label
- **Swipe navigation**: Horizontal swipe left/right cycles through the 5 screens (via `useSwipe` hook in App.jsx). Swipe-right on the first screen (Salud) triggers the exit toast
- **Double-back-to-exit**: Android-style pattern — first back press shows toast "Toca de nuevo para salir", second back within 2 seconds exits. Implemented via `popstate` listener with `history.pushState` guards
- When viewing a patient's data, a blue banner appears showing "Viendo datos de [patient name]"

### API Layer

**Supabase Tables**
- `profiles` — full_name, avatar_url, glucose_hypo/target_high/high, push_endpoint (custom ranges per user)
- `glucose_readings` — user_id, recorded_by, value, context (timing), note, recorded_at (`timestamptz`)
- `bp_readings` — user_id, recorded_by, systolic, diastolic, pulse, arm, note, recorded_at (`timestamptz`)
- `family_groups` — name, created_at
- `family_memberships` — user_id, group_id, role
- `family_invitations` — group_id, code, role, created_by, created_at
- `push_subscriptions` — user_id, endpoint, subscription (JSON), created_at
- `budget_entries` — group_id, recorded_by, contributor_id, contributor_label, type (income/expense), amount, category, note, entry_date (`date`), receipt_url, created_at
- `budget_requests` — group_id, requested_by, resolved_by, amount, actual_amount, category, note, entry_date (`date`), status (pending/approved/rejected), response_note, resolved_at (`timestamptz`), inventory_item_id
- `inventory_items` — group_id, name, unit, units_per_pack, consumption_per_day, current_quantity, alert_threshold_days, image_url, indication, side_effects, info_generated_at, notes, active, quantity_updated_at (`timestamptz`), created_at
- `inventory_restocks` — item_id, group_id, recorded_by, quantity, price, brand, store, purchased_at (`date`), budget_entry_id, notes, created_at
- `inventory_adjustments` — item_id, group_id, adjusted_by, old_quantity, new_quantity, adjusted_at (`timestamptz`)
- `medication_schedules` — group_id, item_id, created_by, dose, frequency_type, interval_days, days_of_week, times, start_date, end_date, active, notes, consultation_id, created_at
- `medication_intakes` — group_id, schedule_id, item_id, taken_by, scheduled_date, scheduled_time, dose, note, created_at
- `consultations` — group_id, created_by, consultation_date, doctor, notes, cost, budget_entry_id, created_at
- `audit_log` — group_id, changed_by, entity_type, entity_id, action, before (JSON), after (JSON), occurred_at (`timestamptz`)

**RPC Functions** (Supabase-managed)
- `create_family_group(group_name)` — Creates group and adds caller as admin
- `join_family_group(invitation_code)` — Validates code, adds caller to group

**Edge Functions**
- `send-push-notification(subscription, title, body)` — Deno function using `web-push` npm package to send VAPID-signed notifications
- `generate-med-info(name)` — Deno function using Anthropic Claude API (`@anthropic-ai/sdk`) to generate medication indication and side effects. Uses tool_use with `record_med_info` tool. Model configurable via `ANTHROPIC_MODEL` secret (default: `claude-opus-4-8`). Returns `{ indication, side_effects }` which are saved to `inventory_items` by `useInventory.generateMedInfo()`

**Realtime Subscriptions**
- `budget_entries` — all events (useBudget)
- `budget_requests` — all events (useRequests)
- `inventory_items` — all events (useInventory)
- `inventory_restocks` — all events (useInventory)
- `medication_schedules` — all events (useMedications)
- `medication_intakes` — all events (useMedications)
- `consultations` — all events (useMedications)
- `audit_log` — INSERT only (useAuditLog)

### Push Notifications & Service Worker

- `usePushNotifications` hook manages Notification API and Push API subscription lifecycle
- Service worker registered at `/public/sw-notifications.js` (minimal stub in public/)
- VAPID public/private keys stored in `.env.local`
- Subscription stored in `push_subscriptions` table per user
- `useReadings.sendAlertIfCritical()` queries `push_subscriptions` for the data owner and dispatches via Edge Function
- `useRequests.addRequest()` notifies group admins via push when a new expense request is created
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

**Supabase Secrets** (set via `supabase secrets set`)
- `ANTHROPIC_API_KEY` — Required for `generate-med-info` edge function (Anthropic Claude API)
- `ANTHROPIC_MODEL` — Optional, defaults to `claude-opus-4-8`

## UI Patterns

- **Color System**: Predefined hex constants at top of each component (primary green `#059669`, text `#111827`, muted `#6B7280`, borders `#E5E7EB`, background `#F4F2ED`)
- **Card Layout**: `card()` factory function returns shared shadow + padding + border-radius
- **Label Style**: `lbl10()` factory for uppercase, small, muted labels
- **No CSS files**: All styling is inline `style` props; `App.css` exists but rarely used
- **Form Inputs**: Simple text/password inputs with consistent styling; no form library
- **Responsive**: Fixed bottom navigation, scrollable content area with padding to avoid nav overlap
- **Tappable cards with detail Sheet**: List items (inventory, budget movements, medications) are fully tappable (`cursor: pointer`, `WebkitTapHighlightColor: transparent`, "Ver detalle ›" hint). Tapping opens a bottom `Sheet` with full info and action buttons (Editar/Eliminar). No inline action buttons on list items. Follow this pattern for any new list with editable items.
- **Bottom Sheet (`Sheet` component)**: Reusable component in `src/components/Sheet.jsx` with optional swipe-to-close gesture. Props: `onClose`, `title`, `children`, `swipeToClose`. Imported in BudgetScreen, MedsScreen.
- **PhotoPicker**: Shared camera/file upload component (defined inline in BudgetScreen and MedsScreen) for attaching images to items, restocks, and consultations. Uses `compressImage()` before upload to Supabase Storage.

## Key Files to Understand

- `/src/lib/supabase.js` — Supabase singleton initialization
- `/src/hooks/useAuth.js` — Authentication and profile CRUD
- `/src/hooks/useReadings.js` — Glucose/BP data fetching, insertion, alerts
- `/src/hooks/useFamily.js` — Family group management and role-based logic
- `/src/hooks/useMedications.js` — Medication schedules, intakes, consultations, adherence tracking, stock sync (~408 LOC)
- `/src/hooks/useBudget.js` — Budget entries CRUD
- `/src/hooks/useInventory.js` — Inventory items, restocks, stock adjustment, AI medication info generation
- `/src/hooks/useRequests.js` — Budget request workflow (create, approve, reject) with push notifications (~157 LOC)
- `/src/hooks/useAuditLog.js` — Audit log fetching and insertion (~57 LOC)
- `/src/hooks/useSwipe.js` — Touch gesture handler for swipe navigation (~37 LOC)
- `/src/utils/analysis.js` — Status classification and alert determination
- `/src/utils/medications.js` — Medication schedule logic: frequency calculation, dose building, day-of-week labels (~129 LOC)
- `/src/components/Sheet.jsx` — Reusable bottom sheet with optional swipe-to-close (~90 LOC)
- `/src/pages/MainApp.jsx` — Main dashboard (longest file ~1935 LOC)
- `/src/pages/BudgetScreen.jsx` — Budget entries, inventory, requests, audit log (~4863 LOC)
- `/src/pages/MedsScreen.jsx` — Medication schedules, daily doses, consultations (~1696 LOC)
- `/src/pages/FamilyScreen.jsx` — Group/member management (~845 LOC)
- `/src/pages/ReportScreen.jsx` — Analytics with charts and statistics (~543 LOC)
- `vite.config.js` — PWA manifest and icon configuration

## Common Development Patterns

1. **Hook for async data** — All data fetching is in custom hooks (`useAuth`, `useReadings`, `useFamily`, `useMedications`, `useBudget`, `useInventory`, `useRequests`, `useAuditLog`), not inline in components
2. **Callback pattern** — Parent component passes `onViewPatient`, `onRoleChange`, `onOpenProfile`, `onSwipeScreen` callbacks to children
3. **Alert/Flash messages** — Components use local state with setTimeout for auto-dismiss UX
4. **Error handling** — Try/catch blocks in async handlers; errors stored in component state and displayed inline
5. **Optimistic updates** — State updated immediately after successful mutations (e.g., `setGluReadings([data, ...prev])`)
6. **Conditional rendering** — Based on `loading`, `user`, `myRole`, `viewingPatient` state flags
7. **No nested components** — Never define a React component (arrow function or function declaration) inside another component's body. Define all components at module level to avoid recreation on every render.
8. **Consultation flow** — `saveConsultation()` handles the full doctor visit lifecycle: optionally create budget entry for cost, create consultation record, process decisions on existing schedules (keep/suspend/adjust), create new schedules, then recalculate inventory consumption for all affected items.
9. **Medication stock sync** — `recalcItemConsumption()` re-anchors inventory stock by decaying `current_quantity` at the old `consumption_per_day` rate since `quantity_updated_at`, then sets the new rate from the sum of `dailyDose()` across all active, current schedules. When no active schedules remain, sets `active = false` on the item (auto-deactivation). When schedules are re-added, sets `active = true` (auto-reactivation). Called after every schedule add/update/suspend/delete and after consultation saves.

## Date & Timezone Rules

These are non-obvious bugs that have already burned us. Follow these patterns strictly:

- **Never** use `new Date().toISOString().split("T")[0]` for the local date — `toISOString()` is UTC; after ~6 PM in Mexico (UTC-5/UTC-6) it returns the next day. Use `todayStr()` in `BudgetScreen.jsx` or equivalent with `getFullYear/getMonth/getDate`.
- **Never** use `new Date(datetimeLocalStr).toISOString()` to convert a `datetime-local` input value — some browsers treat the timezone-less string as UTC. Use `parseLocalDT()` defined in `MainApp.jsx` (multi-argument constructor always uses local time).
- **Never** use `toTimeString().slice(0, 5)` for displaying time — format is implementation-defined. Use `getHours()` and `getMinutes()` with zero-padding.
- **Hoy/Ayer labels** — Compare calendar days using `new Date(y, m, d)` (midnight local), not elapsed milliseconds. See `fmt()` in `MainApp.jsx`.
- **`timestamptz` columns** (recorded_at, occurred_at, quantity_updated_at): store UTC via `.toISOString()`, display with `getHours/getMinutes` or `toLocaleString`. Supabase returns these with `+00:00` offset — `new Date()` parses them correctly.
- **`date` columns** (entry_date, purchased_at): pure date string `"YYYY-MM-DD"`, no timezone conversion. Store using `todayStr()` or the value from `<input type="date">` directly.

## Build & Deployment

- Vite outputs to `/dist/` with built-in code splitting and dynamic imports
- PWA manifest served from `/manifest.webmanifest` (generated by vite-plugin-pwa)
- Icons in `/public/icons/` (generated via `generate-icons.js`)
- `.npmrc` configured to resolve peer dependency conflicts on Vercel
- Environment variables loaded from `.env.local` via `import.meta.env.VITE_*`
- Service worker auto-registered on startup; push notification SW at `/sw-notifications.js`
