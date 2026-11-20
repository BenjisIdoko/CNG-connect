# Queue Clearing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Queuing" status stays current only while a car is at the station's geofence (or the report is fresh), and the driver who reported it is asked once when they leave.

**Architecture:** The queue rule lives in the shared freshness code (`stationFreshness.ts`), reading a per-station car count. Cars are counted from the existing `station_presence` table, now written automatically by the GPS handler while a signed-in driver is within 250 m of a station, and read through a counts-only database function (the public loses read access to the rows). A small pure module remembers the last queue report on the phone and decides when to ask "Is the queue still there?".

**Tech Stack:** React 19, TypeScript, Vite, Vitest (no DOM test library: logic lives in pure utils), Supabase Postgres (SECURITY DEFINER function, RLS), browser Geolocation API.

**Spec:** `docs/superpowers/specs/2026-11-18-queue-clearing-design.md`

## Global Constraints

- **Queue rule:** a Queuing report is current while it is under **30 minutes** old, or while **at least one car is at the geofence** and it is under **3 hours** old. Otherwise it is last-known ("Last: Queuing · 6 hr ago"). Fresh stays "up to 60 minutes". Available and Out of gas keep their **24 hours**.
- **Never infer Available** from missing cars. Only a driver's own answer or report changes a status to Available.
- **A car is here** when a signed-in driver's GPS (accuracy 100 m or better) is within **250 m** of the station. The app pings every **2 minutes** per station while inside; a ping expires **6 minutes** after the last. Guests are not counted.
- **Counts only:** the public may read the number of cars per station, never the presence rows (they show which account was at which station).
- **Leave prompt:** the driver reported Queuing in the last **3 hours** and a fix with accuracy 100 m or better is more than **250 m** from the station; asked **once** per report; answers Queue cleared (Available), Still queuing, Out of gas, Not sure (posts nothing). **No points** for these answers. Copy: "Left {station}?" and "Is the queue still there?".
- The driver-facing line is "N car(s) here - queuing" (already built in `describePresence`, commit `0c838a9` on `fix/station-detail-lines`). Branch `feat/queue-clearing` from `main`; if `0c838a9` is not on `main` yet, merge or cherry-pick it first.
- Project rule: commit and push only when the user asks. Production order: apply the migration (ask the user first) **before** deploying the app code that reads it.

## Review Focus

1. Boundaries of the queue rule: 29 and 31 minutes with no cars, 2 hours with a car, 181 minutes with a car, and a newer Available report replacing an old queue whatever the car count (Task 1 tests).
2. Privacy: the counts function returns no user ids, and an anonymous caller reads zero presence rows (Task 2 smoke test).
3. A driver opening a station's page from far away must not count as a car there (Task 4 test and behaviour).
4. GPS noise and failures: a fix with accuracy over 100 m never pings or prompts; unavailable storage, a guest, or a failed ping never throws (Tasks 4 and 5 tests).
5. One prompt per report: still inside 250 m keeps the watch, a prompt consumes it, an older or newer report at another station does not interfere, and an expired watch never prompts (Task 5 tests).

## File Structure

- Modify `src/utils/stationFreshness.ts` + test (Task 1).
- Create `supabase/station-car-counts.sql`, `supabase/verify-station-car-counts.sql` (Task 2).
- Create `src/utils/carCounts.ts` + test; modify `src/services/supabaseClient.ts`, `src/services/apiService.ts` (Task 3).
- Create `src/utils/geofencePresence.ts` + test; modify `src/App.tsx` (Task 4).
- Create `src/utils/queueWatch.ts` + test; modify `src/components/ProximityAlertBanner.tsx`, `src/App.tsx` (Task 5).
- Task 6 (public API) happens on `feat/public-api`: `api/_lib/data.ts`, `api/_lib/publicApi.ts` + test, `docs/api.md`.

---

### Task 1: The queue rule

**Files:**
- Modify: `src/utils/stationFreshness.ts`, `src/utils/stationFreshness.test.ts`

**Interfaces:**
- Produces: `export const QUEUE_GRACE_MINUTES = 30;` `export const QUEUE_MAX_MINUTES = 180;`. `getFreshness(station, now)` reads `station.activePresenceCount` (already on `GasStation`, default 0). When the newest report's status is `queue`: it is current if `age <= QUEUE_GRACE_MINUTES || (cars > 0 && age <= QUEUE_MAX_MINUTES)`; tier is `stale` when not current, else `fresh` up to 60 minutes and `recent` after. Other statuses are unchanged. `currentStatus`, `describeStatus`, `usabilityCost`, `pickBestStation` follow automatically.

- [ ] **Step 1: Write the failing tests** in `stationFreshness.test.ts`, using the file's `station`, `report` and `minsAgo` helpers with `activePresenceCount` set on the station:
  - `a queue report is current at 29 minutes with nobody there` (`tier` is `fresh`, `currentStatus` is `'queue'`)
  - `a queue report is last-known at 31 minutes with nobody there` (`tier` `stale`, `currentStatus` `'unknown'`, `describeStatus` is `'Last: Queuing · 31 min ago'`)
  - `a queue report between 30 and 60 minutes stays fresh while a car is there` (45 min, 1 car: `tier` `fresh`)
  - `a queue report at 2 hours stays current while a car is there` (`tier` `recent`, `currentStatus` `'queue'`)
  - `a queue report at 181 minutes is last-known even with cars there`
  - `Available and Out of gas keep their 24 hour window with nobody there` (5 h old each: `tier` `recent`)
  - `a newer Available report replaces an old queue whatever the car count` (queue 10 min with 0 cars, full 1 min: `currentStatus` `'full'`)
  - `usabilityCost is Infinity for a 40 minute queue with nobody there and finite with a car`
  - `pickBestStation skips a last-known queue` (A: queue 2 h, 0 cars; B: full 3 h; the pick is B)
- [ ] **Step 2: Run** `npx vitest run src/utils/stationFreshness.test.ts`. Expected: the new tests FAIL; existing ones pass.
- [ ] **Step 3: Implement** the constants and the `getFreshness` change described above. Existing tests that use queue reports older than 30 minutes with no cars must be updated to the new rule, each with a one-line reason in the test.
- [ ] **Step 4: Run** `npx tsc --noEmit && npx vitest run`. Expected: pass.
- [ ] **Step 5: Commit** `git add src/utils/stationFreshness.ts src/utils/stationFreshness.test.ts && git commit -m "feat(queue): a queue is current only while a car is there"`

---

### Task 2: Counts-only database function and policy

**Files:**
- Create: `supabase/station-car-counts.sql` (idempotent), `supabase/verify-station-car-counts.sql`

**Interfaces:**
- Produces: `station_car_counts() returns table (station_id text, cars integer)`, `security definer`, `stable`, `set search_path = public`, executable by `anon` and `authenticated`; it counts rows of `station_presence` with `expires_at > now()` per station and returns no user ids. The public read policy "Allow public read station_presence" is dropped and replaced by "Read own station_presence" (`for select to authenticated using (user_key = auth.uid()::text)`), which the app's own upsert and `hasActivePresence` need.

- [ ] **Step 1: Write the migration** as described, in the style of the other `supabase/*.sql` files.
- [ ] **Step 2: Write the smoke test** `verify-station-car-counts.sql` as one `begin; ... rollback;` block that seeds presence rows inside the transaction (two live and one expired at one station, one live at another; explicit `user_key` values) and lists PASS/FAIL for: the function counts 2 and 1 and ignores the expired row; it returns only the two columns; as `anon` (`set local role anon`) a direct `select count(*) from station_presence` returns 0 while `station_car_counts()` still works; as a signed-in user (claims set) the user sees only their own row; after the block, nothing persists.
- [ ] **Step 3: Ask the user before applying to production** (project `aomrrlxateneakvorzma`); apply only on a yes, then run the smoke test. Expected: all PASS.
- [ ] **Step 4: Commit** `git add supabase && git commit -m "feat(queue): counts-only car function, close public read of presence rows"`

---

### Task 3: Car counts in the app's data path

**Files:**
- Create: `src/utils/carCounts.ts`, `src/utils/carCounts.test.ts`
- Modify: `src/services/supabaseClient.ts`, `src/services/apiService.ts`

**Interfaces:**
- Produces: `carCountsToMap(rows: unknown): Record<string, number>` (keeps only well-formed rows with a string `station_id` and a positive integer `cars`; anything else gives `{}`); `restRpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T | null>` in `supabaseClient.ts` (a POST to `/rest/v1/rpc/{fn}` with the same headers as `restSelect`; `null` on any failure); `apiService.fetchCarCounts(): Promise<Record<string, number>>`; `fetchStations` sets `activePresenceCount: counts[s.id] ?? 0`; `pingStationPresence(stationId: string, userKey: string, ttlMinutes = 6)` returns `(await apiService.fetchCarCounts())[stationId] ?? 0` after the upsert instead of selecting presence rows.

- [ ] **Step 1: Write the failing tests** in `carCounts.test.ts`: `maps rows to counts`, `ignores a row with no station id`, `ignores zero, negative, fractional and non-numeric counts`, `returns an empty map for null, undefined, a string and an object`.
- [ ] **Step 2: Run** `npx vitest run src/utils/carCounts.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `carCountsToMap`, `restRpc`, `fetchCarCounts` (REST first, then the Supabase client's `.rpc` as the fallback, `{}` on failure), the `fetchStations` mapping, and the `pingStationPresence` change. Keep the upsert as it is.
- [ ] **Step 4: Run** `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] **Step 5: Commit** `git add src && git commit -m "feat(queue): load car counts for every station"`

---

### Task 4: Automatic presence at the geofence

**Files:**
- Create: `src/utils/geofencePresence.ts`, `src/utils/geofencePresence.test.ts`
- Modify: `src/App.tsx` (the GPS handler `handlePosSuccess`, and `handleOpenStationDetail`)

**Interfaces:**
- Consumes: `haversineMeters` from `src/utils/stationDuplicates.ts`; `apiService.pingStationPresence`, `apiService.fetchCarCounts` (Task 3).
- Produces: `PRESENCE_GEOFENCE_METERS = 250`, `PRESENCE_PING_INTERVAL_MS = 120_000`, `PRESENCE_TTL_MINUTES = 6`, `MAX_GPS_ACCURACY_METERS = 100`; `interface PingPosition { lat: number; lng: number; accuracy?: number }`; `isAtStation(position: PingPosition, station: { lat: number; lng: number }): boolean` (within 250 m and accuracy 100 m or better, or no accuracy given); `stationsToPing(position: PingPosition, stations: { id: string; lat: number; lng: number }[], lastPingAt: Record<string, number>, now?: number): string[]`.

- [ ] **Step 1: Write the failing tests** in `geofencePresence.test.ts`: `a station inside 250 m that was never pinged is returned`; `a station pinged 60 seconds ago is not returned and one pinged 121 seconds ago is`; `a station 251 m away is not returned`; `a fix with accuracy 150 m returns nothing`; `a fix with no accuracy value is accepted`; `two overlapping stations are both returned, nearest first, at most two`; `a station with missing coordinates is ignored`; `isAtStation is false for a station page opened from 5 km away, true at 249 m, false at 251 m and false when the fix is only accurate to 150 m`.
- [ ] **Step 2: Run** `npx vitest run src/utils/geofencePresence.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `stationsToPing`.
- [ ] **Step 4: Wire it in `App.tsx`:** in `handlePosSuccess`, when the driver is signed in, call `stationsToPing` with the fix (`pos.coords.accuracy`), record each returned id in a `useRef` map of last-ping times, call `apiService.pingStationPresence(id, userKey, PRESENCE_TTL_MINUTES)` without awaiting, and set that station's `activePresenceCount` from the result; any failure is swallowed. In `handleOpenStationDetail`, only ping presence when `isAtStation(driver position, station)` is true; otherwise just set the count from `apiService.fetchCarCounts()` (no write). Guests never ping.
- [ ] **Step 5: Run** `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass. In the browser check (`cng-dev`), say what could not be exercised (a real GPS position inside a geofence needs a device or location override).
- [ ] **Step 6: Commit** `git add src && git commit -m "feat(queue): count a driver as a car when their phone is at the station"`

---

### Task 5: The leave prompt

**Files:**
- Create: `src/utils/queueWatch.ts`, `src/utils/queueWatch.test.ts`
- Modify: `src/components/ProximityAlertBanner.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `PingPosition`, `MAX_GPS_ACCURACY_METERS` and `PRESENCE_GEOFENCE_METERS` from `geofencePresence.ts` (Task 4), `haversineMeters` from `stationDuplicates.ts`.
- Produces (`queueWatch.ts`): `LEFT_DISTANCE_METERS = 250`, `WATCH_MAX_AGE_MINUTES = 180`; `interface QueueWatch { stationId: string; name: string; lat: number; lng: number; reportedAt: number }`; `rememberQueueReport(station: { id: string; name: string; lat: number; lng: number }, now?: number): void`; `clearQueueWatchFor(stationId: string): void`; `takeDueLeftPrompt(position: PingPosition, now?: number): QueueWatch | null` (returns and clears the watch when the fix is accurate to 100 m or better and more than 250 m away; clears and returns null once it is older than 180 minutes; keeps it and returns null otherwise). Storage failures are swallowed.
- Produces (banner): `variant?: 'arrival' | 'followup' | 'left'`; for `'left'` the title is "Left {station}?", the subtitle "Is the queue still there?", the buttons are Queue cleared (posts `full`), Still queuing (`queue`), Out of gas (`out`) and a Not sure text button (calls `onDismiss`, posts nothing), and the "Add a photo & more detail" link is hidden.

- [ ] **Step 1: Write the failing tests** in `queueWatch.test.ts` (follow the storage stub in `src/utils/followUp.test.ts`): `still inside 250 m keeps the watch and returns null`; `a fix 251 m away returns the watch once and then null`; `a fix with accuracy 150 m returns null and keeps the watch`; `a watch older than 180 minutes returns null and is cleared`; `a newer report at the same station replaces it, and clearQueueWatchFor(stationId) clears only that station's watch`; `a different station's clear leaves it`; `unavailable storage does not throw from remember, take or clear`.
- [ ] **Step 2: Run** `npx vitest run src/utils/queueWatch.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `queueWatch.ts` (key `cng_queue_watch`, one entry).
- [ ] **Step 4: Implement the banner variant and wire `App.tsx`:** extend `proximityVariant` and the `source` parameter of `submitReportFor` with `'left'`; remember the watch when any report with status `queue` is submitted, and call `clearQueueWatchFor` for other statuses at that station; in `handlePosSuccess`, when no banner is showing and the driver is signed in, call `takeDueLeftPrompt` and open the `'left'` banner for that station; for source `'left'` skip `awardReportPoints` and show "Thanks, station updated."; track `queue_left_prompt_shown` and `queue_left_answer`.
- [ ] **Step 5: Run** `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass. Browser check as in Task 4, with the same honesty about what needs a real position.
- [ ] **Step 6: Commit** `git add src && git commit -m "feat(queue): ask the reporter if the queue is still there when they leave"`

---

### Task 6: Public API (on `feat/public-api`)

**Precondition:** `api/_lib/*` exists only on `feat/public-api`. After Tasks 1-5 are on `main`, merge `main` into that branch, then do this task there.

**Files:**
- Modify: `api/_lib/data.ts`, `api/_lib/publicApi.ts`, `api/_lib/publicApi.test.ts`, `docs/api.md`

- [ ] **Step 1: Write the failing tests** in `publicApi.test.ts`: `a queue report 40 minutes old with no car count is last-known in the API`; `the same report with a car count of 1 is current`.
- [ ] **Step 2: Run** `npx vitest run api/_lib/publicApi.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement:** load `station_car_counts()` in `data.ts` (anon key, same as the app) and set `activePresenceCount` on each station row passed to the shared freshness code; failure means no counts (zero cars).
- [ ] **Step 4: Update `docs/api.md`:** the 30-minute and 3-hour queue rule and that `freshness` reflects cars at the station. Run `npx tsc --noEmit && npx vitest run`. Expected: pass.
- [ ] **Step 5: Commit** `git add api docs/api.md && git commit -m "feat(api): queue freshness follows cars at the station"`

---

### Task 7: Docs and final check

- [ ] **Step 1: README:** one line under Driver-Facing Features that a queue status follows cars at the station; update the test count.
- [ ] **Step 2: Run** `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] **Step 3: Tell the user** the production order (migration first, then deploy), that only phones running the app with location on count as cars, and that grey "Last: Queuing" will appear more often than today.
