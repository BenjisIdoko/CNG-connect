# Station Manager Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the user chose native). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Assigned station managers post "Selling now / Not selling" and pressure in bar from "My stations"; drivers see it as a separate "Station says" line and badge, never as a driver report.

**Architecture:** Station-level columns (`manager_selling`, `manager_selling_at`, `live_pressure_bar`, `live_pressure_at`) set by two manager-only `security definer` functions that also append to a log table. Pure helpers in one util module decide what is still current and how it reads. The driver-report code, pin colours and ranking are untouched.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (logic lives in pure utils; no DOM test library), Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-11-18-station-manager-signals-design.md`

## Global Constraints

- A selling/not-selling post shows for **120 minutes** (`SELLING_STATEMENT_MINUTES`), with its age; a newer post replaces it.
- A pressure reading shows for **720 minutes** (`LIVE_PRESSURE_MAX_AGE_MINUTES`) with its age; after that fall back to the admin's `pump_pressure` with no age.
- Pressure: whole number **10 to 300**; stepper steps of **5**; starts at the last reading, else the admin's value, else **200**.
- Manager posts never change `status`, pin colour, ranking, the Reports tab, points or flags.
- Only managers assigned in `station_managers` may post, for their own stations only. Server clock stamps posts.
- Project rules: commit/push only when the user asks to merge/deploy; production DB changes only with explicit approval; work on branch `feat/station-manager-updates` (already created in this worktree).
- Production order: apply the migration (ask first) **before** deploying the app; the old app ignores the new columns.

## Review Focus

1. A manager of station A posting for station B is refused (Task 2 smoke test, Task 3 friendly error).
2. Expiry edges: a post exactly 120 min old still shows, 121 min is gone; a post with a clock slightly in the future shows age 0; a missing timestamp shows nothing (Task 1 tests).
3. Pressure bounds: 0, 9, 301, 220.5, `NaN`, `null`, `'220'` rejected; stepper clamps at 10 and 300 (Task 1, Task 3 tests).
4. Double-tap: posting buttons are disabled while a post is pending (Task 4).
5. A manager removed mid-session gets a clear "no longer a manager" message, not a raw database error (Task 3 test).

## File Structure

- Create `src/utils/stationManagerSignals.ts` + `.test.ts` (Task 1); modify `src/types.ts`.
- Create `supabase/station-manager-signals.sql` + `supabase/verify-station-manager-signals.sql` (Task 2).
- Create `src/services/stationManagerService.ts` + `.test.ts` (Task 3).
- Create `src/components/admin/StationQuickUpdate.tsx`; modify `MyStationsPanel.tsx`, `AdminScreen.tsx`, `src/services/apiService.ts` (Task 4).
- Create `src/components/common/StationSaysLine.tsx`; modify `StationDetailScreen.tsx`, `MapScreen.tsx`, `LiveNavigationModal.tsx`, `src/utils/shareMessageBuilder.ts` + test (Task 5).
- Modify `README.md` (Task 6).

---

### Task 1: Helpers and types

**Files:** Create `src/utils/stationManagerSignals.ts`, `src/utils/stationManagerSignals.test.ts`; modify `src/types.ts` (`GasStation` gains `managerSelling?: boolean; managerSellingAt?: string; livePressureBar?: number; livePressureAt?: string;`).

**Interfaces — Produces:**
`SELLING_STATEMENT_MINUTES = 120`, `LIVE_PRESSURE_MAX_AGE_MINUTES = 720`, `PRESSURE_MIN_BAR = 10`, `PRESSURE_MAX_BAR = 300`, `PRESSURE_STEP_BAR = 5`, `PRESSURE_DEFAULT_BAR = 200`;
`isValidPressure(bar: unknown): bar is number`;
`stepPressure(current: number | null | undefined, direction: 1 | -1): number`;
`interface SellingStatement { selling: boolean; ageMinutes: number }`;
`getSellingStatement(station: Pick<GasStation,'managerSelling'|'managerSellingAt'>, now?: number): SellingStatement | null`;
`describeSelling(statement: SellingStatement): string` → `'Selling now · updated 20 min ago'` / `'Not selling · updated 1 hr ago'`;
`interface PressureReading { bar: number; ageMinutes: number | null; live: boolean }`;
`getPressureReading(station: Pick<GasStation,'pumpPressure'|'livePressureBar'|'livePressureAt'>, now?: number): PressureReading | null`;
`describePressure(station, now?): string | null` → `'220 bar · updated 2 hr ago'`, `'220 bar'` (fallback), or `null`.
Reuse `parseAgeMinutes` / `formatAgeShort` from `stationFreshness.ts`. `formatAgeShort(0)` reads "just now", so the copy is "updated just now".

- [ ] Step 1: Write failing tests (names): `isValidPressure accepts 10, 200, 300 and rejects 0, 9, 301, 220.5, NaN, null and '220'`; `stepPressure moves by 5, starts at 200 when there is no value, and clamps at 10 and 300`; `getSellingStatement returns the post with its age within 120 minutes, including exactly 120`; `getSellingStatement is null at 121 minutes, with no timestamp, with a null flag, and with an unreadable timestamp`; `a timestamp a few minutes in the future gives age 0`; `describeSelling reads "Selling now · updated 20 min ago" and "Not selling · updated 1 hr ago"`; `getPressureReading returns the live reading for 2 h, falls back to the static value at 13 h and when the timestamp is missing, and is null when there is neither`; `describePressure gives "220 bar · updated 2 hr ago", "220 bar" for the fallback, null for none`.
- [ ] Step 2: Run `npx vitest run src/utils/stationManagerSignals.test.ts`. Expected: FAIL (module missing).
- [ ] Step 3: Implement the module and the type additions.
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run`. Expected: all pass.
- [ ] Step 5: Commit `feat(manager): helpers for station selling status and live pressure`.

### Task 2: Database migration and smoke test

**Files:** Create `supabase/station-manager-signals.sql` (idempotent), `supabase/verify-station-manager-signals.sql`.

**Interfaces — Produces:** RPC `manager_post_selling(p_station_id text, p_selling boolean) returns void` and `manager_post_pressure(p_station_id text, p_bar integer) returns void`; both `security definer`, `set search_path = public`, `revoke all ... from anon`, `grant execute ... to authenticated`. Table `station_manager_posts`.

- [ ] Step 1: Write the migration: `stations` gains `manager_selling boolean`, `manager_selling_at timestamptz`, `live_pressure_bar integer check (live_pressure_bar between 10 and 300)`, `live_pressure_at timestamptz` (`add column if not exists`); table `station_manager_posts (id uuid default gen_random_uuid() primary key, station_id text references stations(id) on delete cascade, user_id uuid references auth.users(id) on delete set null, kind text check (kind in ('selling','pressure')), selling boolean, pressure_bar integer, created_at timestamptz default now())` with RLS on and one admin-select policy; two functions that require `auth.uid()`, require a `station_managers` row for (station, caller) else raise `'not authorized'`, validate input (`'Invalid pressure'` outside 10..300), update the station columns with `now()`, insert the log row.
- [ ] Step 2: Write the smoke test as one `begin; ... rollback;` block that picks two stations and an existing user at run time, assigns that user as manager of station 1 inside the transaction, then (impersonating via `request.jwt.claims` and `set local role authenticated`) checks and prints PASS/FAIL for: (a) selling post for station 1 sets the columns and logs one row; (b) a post for station 2 raises `not authorized`; (c) pressure 9 and 301 raise `Invalid pressure`, 220 succeeds; (d) a pressure post does not change `manager_selling`; (e) a post leaves the station's `status` and reports unchanged; (f) `anon` cannot execute either function.
- [ ] Step 3: **Ask the user before applying to production** (project `aomrrlxateneakvorzma`). On yes, apply with `apply_migration`, run the smoke test with `execute_sql`; expected every line PASS, nothing persisted.
- [ ] Step 4: Commit `feat(manager): manager-only functions for selling status and pressure`.

### Task 3: Service wrappers

**Files:** Create `src/services/stationManagerService.ts`, `src/services/stationManagerService.test.ts`.

**Interfaces — Consumes:** `isValidPressure` (Task 1), RPC names (Task 2). **Produces:**
`type ManagerPostResult = { ok: true } | { ok: false; error: string }`;
`interface RpcClient { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }> }`;
`postSelling(client: RpcClient, stationId: string, selling: boolean): Promise<ManagerPostResult>`;
`postPressure(client: RpcClient, stationId: string, bar: number): Promise<ManagerPostResult>`;
`friendlyManagerError(message: string): string`.

- [ ] Step 1: Failing tests with a fake `{ rpc: vi.fn() }`: `postSelling calls manager_post_selling with p_station_id and p_selling`; `postPressure refuses 9, 301, 220.5 and NaN without calling the database`; `postPressure calls manager_post_pressure with p_bar for 220`; `a "not authorized" error becomes the "no longer a manager of this station" message`; `an unknown error becomes "Could not post, try again" and never shows the raw message`; `a thrown network error is returned as a failed result, not thrown`.
- [ ] Step 2: Run `npx vitest run src/services/stationManagerService.test.ts`. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run`. Expected: pass.
- [ ] Step 5: Commit `feat(manager): service wrappers for station posts`.

### Task 4: Manager card, admin tab, data mapping

**Files:** Create `src/components/admin/StationQuickUpdate.tsx`; modify `MyStationsPanel.tsx` (extend `ManagedStation`/`FullStationRow` usage with the four new nullable columns; render the card inside each station's card above the "Edit details" link without nesting a button in a button), `AdminScreen.tsx` (add a `My stations` nav item to `ADMIN_NAV` and render `MyStationsPanel` for admins too), `src/services/apiService.ts` (map `manager_selling`, `manager_selling_at`, `live_pressure_bar`, `live_pressure_at` next to `pumpPressure`).

**Interfaces — Consumes:** Task 1 helpers, Task 3 service, `useSupabaseClient`. **Produces:** `StationQuickUpdate: React.FC<{ stationId: string; managerSelling: boolean | null; managerSellingAt: string | null; livePressureBar: number | null; livePressureAt: string | null; pumpPressure: number | null; flash: (m: string) => void; onPosted: (patch: Partial<{ manager_selling: boolean; manager_selling_at: string; live_pressure_bar: number; live_pressure_at: string }>) => void }>`.

- [ ] Step 1: Implement the card per the spec sketch: two buttons "Selling now" / "Not selling" (the current post highlighted while still showing), a line "Posted 20 min ago · shows for 2 hours", a pressure row (`–` / `+` using `stepPressure`, number in bar, "Update pressure", "updated 3 hr ago"). All posting buttons disabled while a post is pending; errors shown in the card via `friendlyManagerError`.
- [ ] Step 2: Run `npx tsc --noEmit && npm run build`. Expected: pass.
- [ ] Step 3: Browser check at phone width if a signed-in manager is possible; otherwise say plainly that it could not be checked with a real account.
- [ ] Step 4: Commit `feat(manager): quick selling and pressure card on My stations`.

### Task 5: What drivers see

**Files:** Create `src/components/common/StationSaysLine.tsx` (`React.FC<{ station: GasStation; now?: number; compact?: boolean }>`: renders nothing when there is no current selling post and no pressure reading; otherwise "Station says: ● Selling now · updated 20 min ago" plus pressure, or in compact mode only a small "Selling now" badge); modify `StationDetailScreen.tsx` (full line under the status card), `MapScreen.tsx` (compact badge next to `StationStatusChip` in the list rows at ~962 and ~1514), `LiveNavigationModal.tsx:57` and `shareMessageBuilder.ts:40` (use `describePressure`), `shareMessageBuilder.test.ts`.

- [ ] Step 1: Failing test in `shareMessageBuilder.test.ts`: `shows a live reading with its age ("220 bar · updated 2 hr ago") when fresh and the plain static value when not`.
- [ ] Step 2: Run `npx vitest run src/utils/shareMessageBuilder.test.ts`. Expected: FAIL.
- [ ] Step 3: Implement the component and edits.
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] Step 5: Browser check the station page and list at phone width for a station with no manager data (nothing extra shown, no errors).
- [ ] Step 6: Commit `feat(manager): drivers see "Station says" and live pressure with its age`.

### Task 6: Docs and final check

- [ ] Step 1: `README.md`: one line under internal tools (managers post selling status and pressure; drivers see it as "Station says"), test counts.
- [ ] Step 2: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] Step 3: Commit `docs: station managers post selling status and pressure`.
