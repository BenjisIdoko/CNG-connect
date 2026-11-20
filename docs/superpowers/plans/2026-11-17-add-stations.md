# Add New Stations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin adds a station from the admin dashboard (phase 1, built and shippable first); an admin approves or rejects driver suggestions (phase 2).

**Architecture:** One admin-only database function, `admin_create_station`, is the only way a station is created; the add form and (phase 2) approving a suggestion both call it. Duplicate detection and position parsing are pure, tested utilities shared by the form. The form reuses the pin editor's coordinate parsing, and the new station then opens in the existing full editor.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (no DOM test library: logic lives in pure utils), Supabase Postgres (SECURITY DEFINER function), optional Google Maps picker.

**Spec:** `docs/superpowers/specs/2026-11-17-add-stations-design.md`

## Global Constraints

- Only admins create stations; the app gets no insert rule on `stations`. Function pattern as `admin_set_station_pin` (`security definer`, `set search_path = public`, `revoke ... from anon`, `grant execute ... to authenticated`).
- Position is **required** and must be inside Nigeria: lat 4 to 14, lng 2.5 to 15. Accuracy tiers: `source_exact` (15 m), `rooftop` (30 m), `street` (150 m), `area` (700 m), `city` (4000 m); default `rooftop`; `needs_pin_review = (tier = 'city')`.
- Name rule (SQL and TypeScript must agree): lower-case the name and strip everything except `a-z` and `0-9`; two stations with the same result are duplicates and the second is refused. This mirrors `deduplicateStations` in `src/data/mockData.ts`.
- Similar-station warning: any station within **300 m**, or with a similar name; it warns and allows "Add anyway". An identical normalized name is blocked.
- New station defaults: status `unknown` with label "No recent reports", `is_picng_accredited = false`, `data_source = 'Admin added'` with today's date, `created_by = auth.uid()::text`, `verified_by_community = false`, id like `admin-nipco-ikeja-x7k2q9` (slug of at most 30 characters plus 6 random characters).
- Required: name, address, city, state, position. Operator and area are optional. Station type defaults to `cng` (the form offers CNG only; EV is switched off in the app).
- Project rule: commit and push only when the user asks. Work on `feat/add-stations` cut from `main`, in a worktree.
- Production order: apply each migration (ask the user first) **before** deploying the app code that calls it.

## Review Focus

1. The same name spelled differently ("NIPCO - Ikeja", "nipco ikeja", "N.I.P.C.O Ikeja!") is a duplicate in both the TypeScript check and the database function (Task 1 tests, Task 2 smoke test).
2. Bad positions: a link with no coordinates, "0, 0", and a point outside Nigeria give a clear message and never save a blank or wrong pin (Task 1 tests, Task 3 validation tests).
3. Double submit: pressing "Add station" twice creates one station; the second attempt shows "already exists", not a raw error (Task 3 test, Task 4 behaviour).
4. Whitespace and length: a name of spaces only, a 121-character name and padded input are refused or trimmed (Task 3 tests, Task 2 smoke test).
5. Phase 2: approving the same suggestion twice, or approving a rejected one, never creates a second station (Task 6 smoke test).

## File Structure

- Create `src/utils/geoInput.ts` + test: coordinate parsing, bounds and tier constants, moved out of `PinReviewModal.tsx` (Task 1).
- Create `src/utils/stationDuplicates.ts` + test: name rule, distance, similar-station search (Task 1).
- Create `supabase/admin-create-station.sql`, `supabase/verify-admin-create-station.sql` (Task 2).
- Create `src/services/stationAdminService.ts` + test; `src/data/nigerianStates.ts` (Task 3).
- Create `src/components/admin/PositionPicker.tsx`, `AddStationModal.tsx`; modify `StationsPanel.tsx` (Task 4).
- Phase 2: create `supabase/admin-review-station-suggestions.sql`, `src/components/admin/SuggestionsPanel.tsx`; modify `AdminScreen.tsx`, `AdminSidebarLayout.tsx`, `stationAdminService.ts` (Tasks 6, 7).

---

## Phase 1: admin adds a station

### Task 1: Position parsing and duplicate detection

**Files:**
- Create: `src/utils/geoInput.ts`, `src/utils/geoInput.test.ts`, `src/utils/stationDuplicates.ts`, `src/utils/stationDuplicates.test.ts`
- Modify: `src/components/admin/PinReviewModal.tsx` (import `parseLatLng`, the Nigeria bounds and the tier list/labels from `geoInput.ts`; delete its local copies; no other change)

**Interfaces:**
- Produces (`geoInput.ts`): `type PinTier = 'source_exact' | 'rooftop' | 'street' | 'area' | 'city'`; `PIN_TIERS: PinTier[]`; `PIN_TIER_LABEL: Record<PinTier, string>` (same labels as today); `NG_BOUNDS = { minLat: 4, maxLat: 14, minLng: 2.5, maxLng: 15 }`; `isInNigeria(lat: number, lng: number): boolean`; `parseLatLng(raw: string): { lat: number; lng: number } | null` (behaviour unchanged, rounds to 6 decimals).
- Produces (`stationDuplicates.ts`): `NEARBY_METERS = 300`; `normalizeStationName(name: string): string`; `haversineMeters(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number` (whole metres); `interface StationRef { id: string; name: string; lat: number; lng: number }`; `interface DuplicateHit { id: string; name: string; distanceM: number | null; reason: 'same_name' | 'nearby' | 'similar_name' }`; `isExactNameDuplicate(name: string, existing: { name: string }[]): boolean`; `findSimilarStations(candidate: { name: string; lat: number | null; lng: number | null }, existing: StationRef[]): DuplicateHit[]` (`same_name` first, then by distance, at most 5; with no position only name matches are returned).

- [ ] **Step 1: Write the failing tests.**
  - `geoInput.test.ts`: `parseLatLng('9.07, 7.48')` gives `{lat: 9.07, lng: 7.48}`; a Google URL containing `@9.0765,7.3986,17z` parses; one with `!3d9.0765!4d7.3986` parses; `parseLatLng('0, 0')`, `'48.8, 2.3'` and `'no coordinates here'` return `null`; `isInNigeria(14.01, 7)` is false and `isInNigeria(4, 2.5)` is true.
  - `stationDuplicates.test.ts`: `normalizeStationName('N.I.P.C.O - Ikeja!')` is `'nipcoikeja'`; `isExactNameDuplicate('nipco  IKEJA', [{name:'NIPCO - Ikeja'}])` is true; `findSimilarStations` returns a `nearby` hit at 120 m and none at 301 m; a name of "NIPCO CNG Ikeja" is a `similar_name` hit for "NIPCO Ikeja" (non-generic words `nipco`, `ikeja` shared; ignore `cng`, `station`, `filling`, `gas`, `ltd`, `limited`); "NIPCO Lekki" is not similar to "NIPCO Ikeja"; with `lat`/`lng` null only name hits come back with `distanceM: null`; results are capped at 5, `same_name` first.
- [ ] **Step 2: Run** `npx vitest run src/utils/geoInput.test.ts src/utils/stationDuplicates.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both modules (move, do not rewrite, the parsing code from `PinReviewModal.tsx`) and update `PinReviewModal.tsx` imports.
- [ ] **Step 4: Run** `npx tsc --noEmit && npx vitest run`. Expected: pass.
- [ ] **Step 5: Commit** `git add src/utils src/components/admin/PinReviewModal.tsx && git commit -m "feat(stations): shared position parsing and duplicate detection"`

---

### Task 2: Database function and smoke test

**Files:**
- Create: `supabase/admin-create-station.sql` (idempotent, same style as `admin-station-pins.sql`), `supabase/verify-admin-create-station.sql`

**Interfaces:**
- Produces: `admin_create_station(p_name text, p_address text, p_city text, p_state text, p_lat double precision, p_lng double precision, p_precision text, p_operator text default null, p_station_type text default 'cng', p_area text default null) returns text` (the new station id).

- [ ] **Step 1: Write the migration.** The function: refuses non-admins (`'not authorized'`); trims the text inputs and requires name (at most 120 characters), address (300), city and state (80) to be non-blank; requires `p_station_type in ('cng','ev_charging')`; requires Nigeria bounds (`'coordinates outside Nigeria'`) and a valid tier (`'bad precision: %'`); refuses a name whose normalized form (`lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g'))`) equals an existing station's (`'a station with this name already exists'`); inserts with the defaults and accuracy radius from Global Constraints; returns the id.
- [ ] **Step 2: Write the smoke test** `verify-admin-create-station.sql` as one `begin; ... rollback;` block that prints `PASS`/`FAIL` for: (a) a non-admin profile (picked at run time; skip with a printed note if none exists) is refused; (b) as the admin, a valid call returns an id starting `admin-` and the row has the defaults (status `unknown`, not accredited, data source `Admin added`, radius 30 for `rooftop`); (c) lat 0 / lng 0 refused; (d) `'  '` as a name refused and a 121-character name refused; (e) the same name respelled `'N.I.P.C.O - ikeja!'` refused after `'NIPCO Ikeja'` was created; (f) tier `'exact'` refused; (g) tier `'city'` sets `needs_pin_review = true`.
- [ ] **Step 3: Ask the user for approval to apply the migration to production** (project `aomrrlxateneakvorzma`). Do not apply without a yes. If approved, apply it and run the smoke test with `execute_sql`. Expected: every line `PASS`, nothing persisted.
- [ ] **Step 4: Commit** `git add supabase/admin-create-station.sql supabase/verify-admin-create-station.sql && git commit -m "feat(stations): admin-only create-station function"`

---

### Task 3: Service wrapper, validation and state list

**Files:**
- Create: `src/services/stationAdminService.ts`, `src/services/stationAdminService.test.ts`, `src/data/nigerianStates.ts`

**Interfaces:**
- Consumes: `isInNigeria`, `PIN_TIERS`, `PinTier` (Task 1); RPC from Task 2.
- Produces: `NIGERIAN_STATES: string[]` (FCT Abuja plus the 36 states, "FCT Abuja" spelled as the existing data does); `interface NewStationInput { name: string; address: string; city: string; state: string; operator?: string; area?: string; stationType?: 'cng' | 'ev_charging'; lat: number | null; lng: number | null; precision: PinTier }`; `validateNewStation(input: NewStationInput): string | null` (first problem as a sentence, or `null`); `type CreateResult = { ok: true; id: string } | { ok: false; error: string }`; `createStation(client: RpcClient, input: NewStationInput): Promise<CreateResult>` where `RpcClient` is `{ rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> }`; `friendlyCreateError(message: string): string`.

- [ ] **Step 1: Write the failing tests** with a fake client (`{ rpc: vi.fn() }`):
  - `validateNewStation` rejects: a name of spaces only, a 121-character name, missing address, missing city, missing state, `lat: null`, a point outside Nigeria (0, 0); accepts a complete input.
  - `createStation` trims inputs before sending (`'  NIPCO  '` becomes `'NIPCO'`), sends `p_*` args, returns `{ ok: true, id }`, and does not call the database when validation fails.
  - `friendlyCreateError('a station with this name already exists')` mentions the name already exists; `'not authorized'` becomes "Only admins can add stations."; anything else becomes "Could not add the station, try again." (never the raw message).
- [ ] **Step 2: Run** `npx vitest run src/services/stationAdminService.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the module and the states list.
- [ ] **Step 4: Run** `npx tsc --noEmit && npx vitest run`. Expected: pass.
- [ ] **Step 5: Commit** `git add src/services/stationAdminService.* src/data/nigerianStates.ts && git commit -m "feat(stations): create-station service, validation, state list"`

---

### Task 4: Add-station form and Stations panel button

**Files:**
- Create: `src/components/admin/PositionPicker.tsx`, `src/components/admin/AddStationModal.tsx`
- Modify: `src/components/admin/StationsPanel.tsx` (an "Add station" button beside "Export CSV" / "Upload CSV"; after creation reload rows and open the new station in `FullStationEditorModal`)

**Interfaces:**
- Consumes: Tasks 1 and 3; `loadGoogleMaps`, `hasGoogleMapsKey`; `useSupabaseClient`.
- Produces: `PositionPicker: React.FC<{ value: { lat: number; lng: number } | null; onChange: (p: { lat: number; lng: number } | null) => void; tier: PinTier; onTierChange: (t: PinTier) => void; center?: { lat: number; lng: number } }>` (a Google map with a draggable pin when a key exists, always a paste field using `parseLatLng`, and a tier select; shows "Could not find coordinates in that text" for unparseable input); `AddStationModal: React.FC<{ stations: StationRef[]; prefill?: Partial<NewStationInput> & { suggestionId?: string }; onClose: () => void; onCreated: (id: string) => void; flash: (m: string) => void }>`. `PinReviewModal`'s own map code is left as it is.

- [ ] **Step 1: Implement `PositionPicker`** as described. The map code may be copied in minimal form from `PinReviewModal`; the paste path must work with no Google key.
- [ ] **Step 2: Implement `AddStationModal`** per the spec's sketch: fields in the order shown, state from `NIGERIAN_STATES`, type fixed to CNG, tier default `rooftop`. As the admin types and places the pin, show `findSimilarStations` results ("Similar: NIPCO Ikeja · 120 m away"). An exact normalized duplicate disables "Add station" with the reason; other hits show a warning and the button reads "Add anyway". Disable the button while saving and while `validateNewStation` returns a message; show `friendlyCreateError` text inside the form.
- [ ] **Step 3: Wire the button** into `StationsPanel.tsx`; on `onCreated(id)` reload the list, flash "Station added", and set `fullEditorId` to the new id.
- [ ] **Step 4: Check** `npx tsc --noEmit && npm run build`. Expected: pass.
- [ ] **Step 5: Browser check** (`cng-dev`, desktop width): the admin dashboard needs a signed-in admin password; if it cannot be used, say so instead of claiming the form was checked, and rely on Tasks 1 to 3 tests.
- [ ] **Step 6: Commit** `git add src/components/admin && git commit -m "feat(stations): Add station form in the admin Stations panel"`

---

### Task 5: Phase 1 end-to-end check (ship point)

- [ ] **Step 1: Test the name rule against the app's own filter.** Add a test to `src/utils/stationDuplicates.test.ts` showing `normalizeStationName` equals the key `deduplicateStations` uses (call it with two stations whose names differ only by case and punctuation; expect one result).
- [ ] **Step 2: Run** `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] **Step 3: Real-data check, only with the user's explicit yes:** create one clearly named test station in production through the form, confirm it appears in the app's station list at its position, then delete it with the existing bulk delete. If the user declines, state that the end-to-end path was verified only by tests and the rolled-back smoke test.
- [ ] **Step 4: Tell the user phase 1 can ship** (migration applied first, then deploy). Phase 2 starts only after that.

---

## Phase 2: driver suggestions

### Task 6: Approve and reject in the database

**Files:**
- Create: `supabase/admin-review-station-suggestions.sql`, `supabase/verify-admin-review-station-suggestions.sql`

**Interfaces:**
- Produces: `admin_create_station(...)` recreated (drop the Task 2 signature first) with one extra last parameter `p_suggestion_id text default null`: when given, the function locks that suggestion row (`for update`), requires it to exist and be `pending` (`'suggestion already reviewed'` otherwise), creates the station, and sets the suggestion `approved`, all in one transaction; `admin_reject_station_suggestion(p_suggestion_id text) returns void` (admin only; pending to `rejected`; `'suggestion already reviewed'` otherwise).

- [ ] **Step 1: Write the migration** as above, same grants and admin check as the Task 2 function.
- [ ] **Step 2: Write the smoke test** (one `begin; ... rollback;` block): insert two pending suggestions; (a) approving one creates a station and marks it approved; (b) approving it again is refused and the station count is unchanged; (c) rejecting an approved one is refused; (d) rejecting a pending one works and approving it afterwards is refused; (e) a non-admin is refused.
- [ ] **Step 3: Ask the user before applying to production**, then apply and run the smoke test. Expected: all `PASS`.
- [ ] **Step 4: Commit** `git add supabase && git commit -m "feat(stations): approve and reject driver suggestions"`

---

### Task 7: Suggestions tab

**Files:**
- Create: `src/components/admin/SuggestionsPanel.tsx`
- Modify: `src/services/stationAdminService.ts` (`NewStationInput` gains `suggestionId?: string`, sent as `p_suggestion_id`; add `rejectSuggestion(client: RpcClient, suggestionId: string): Promise<{ ok: true } | { ok: false; error: string }>`), `src/services/stationAdminService.test.ts`, `src/components/admin/AdminScreen.tsx` (a "Suggestions" item in `ADMIN_NAV`), `src/components/admin/AdminSidebarLayout.tsx` (`AdminNavItem` gains `badge?: number`, shown beside the label)

- [ ] **Step 1: Write the failing tests:** `createStation` sends `p_suggestion_id` when `suggestionId` is set and omits it otherwise; `rejectSuggestion` calls `admin_reject_station_suggestion` with `p_suggestion_id`; a `'suggestion already reviewed'` error becomes "Someone already reviewed this suggestion."
- [ ] **Step 2: Run** `npx vitest run src/services/stationAdminService.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the service changes.
- [ ] **Step 4: Implement `SuggestionsPanel`:** load pending suggestions (`station_suggestions` where `status = 'pending'`, newest first) and the `StationRef` list from `stations`; each card shows name, type, address, city, state, operator, notes, photo and name-based similar stations from `findSimilarStations` (position null); "Approve" opens `AddStationModal` with `prefill` from the suggestion and its `suggestionId`; on `onCreated` remove the card and flash "Station added"; "Reject" asks for confirmation then calls `rejectSuggestion`. Show the pending count as the nav badge.
- [ ] **Step 5: Check** `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass. Browser check as in Task 4, with the same honesty rule.
- [ ] **Step 6: Commit** `git add -A src && git commit -m "feat(stations): Suggestions tab to approve or reject driver suggestions"`

---

### Task 8: Docs and final check

- [ ] **Step 1: README:** one line under Internal Tools saying admins can add stations and review driver suggestions; update the test count if it changed.
- [ ] **Step 2: Run** `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] **Step 3: Tell the user** the production order (migrations first, then deploy) and that the one pending suggestion in production will appear in the new tab.
