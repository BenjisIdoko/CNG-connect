# Report Proof and 24-Hour Cut-off Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After 24 hours a station has no status and no listed reports; every report needs a live photo taken within 150 m of the station, enforced by the app and (later) the database.

**Architecture:** The 24-hour rule is one change in the shared freshness code plus a list filter. Proof is a pure rules module (position check, report check, photo hints) used by the report sheet and by `submitReportFor`, so no path can post without it. The arrival and follow-up prompts stop posting and open the report sheet instead. The database gets the two position columns first and the enforcing trigger last, after the new app has been live.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (no DOM test library: logic lives in pure utils), Supabase Postgres (columns, trigger), browser Geolocation and camera APIs.

**Spec:** `docs/superpowers/specs/2026-11-18-report-proof-and-24h-design.md`

## Global Constraints

- **24 hours:** a report older than 24 h counts for nothing: the station has no status (`tier 'none'`, shows "No report yet"), and the station's Reports tab lists only reports from the last 24 h. The data stays stored. A report whose age cannot be read is not listed.
- **Proof:** every report needs **one live photo** from the in-app camera (no gallery), taken with a GPS fix accurate to **100 m or better** and within **150 m** of the station. The sheet must say why when it cannot proceed. The 150 m check runs at photo time and again at submit time.
- **Hints** when a status is chosen (CNG): Available "Photograph the pump meter", Queuing "Photograph the queue", Out of gas "Photograph the pump showing it's out".
- **Points copy:** every report earns the photo rate, so the submit button reads `+100 pts`.
- **Prompts:** the arrival and follow-up prompts open the report sheet with the tapped status chosen; they never post by themselves. The "Left the station?" prompt, its phone storage (`queueWatch`) and its two analytics events are removed.
- **Unchanged:** the 250 m "car here" geofence, the queue rule (30 minutes / 3 hours), per-report flagging, signed-in reporters only.
- **Database order:** (1) add the two columns, (2) deploy the app, (3) wait until installed phones have updated, (4) only then enable the trigger. The trigger is never applied by this plan without the user's go-ahead at that moment.
- Project rule: commit and push only when the user asks. Work on `feat/report-proof` cut from `main`, in this worktree.

## Review Focus

1. The 24-hour boundary on every screen: a report 23 h 59 min old still counts, one 24 h 01 min old is gone from the status, the list, the map label, search and share text; an expired queue's grey "Last: Queuing" disappears at 24 h; a report with an unreadable age is not listed (Task 1 tests).
2. No path posts without proof: a report with no photo, or no position, or a position over 150 m away is refused by `reportProofProblem` and by `submitReportFor` (Tasks 2 and 5 tests).
3. Position edge cases: no GPS fix, accuracy 101 m, 149 m and 151 m, and a driver who walks away between taking the photo and pressing Submit (Task 2 tests; Task 4 re-checks at submit).
4. Old prompts left behind: nothing references the leave prompt, `queueWatch`, or the removed quick-submit path after Task 5 (type check and a search).
5. The database trigger: refuses a missing photo, a missing position and a position 151 m away, allows 149 m, ignores inserts that have no login (admin SQL), and leaves existing reports alone (Task 6 smoke test, run rolled back).

## File Structure

- Modify `src/utils/stationFreshness.ts` + test (Task 1); `src/components/StationDetailScreen.tsx` (Task 1).
- Create `src/utils/reportProof.ts` + test; modify `src/utils/geofencePresence.ts` + test, `src/types.ts` (Task 2).
- Create `supabase/report-proof-columns.sql`; modify `src/services/apiService.ts` (Task 3).
- Modify `src/components/ReportStatusModal.tsx`, `src/App.tsx` (Task 4).
- Modify `src/components/ProximityAlertBanner.tsx`, `src/App.tsx`, `src/services/analytics.ts`, `README.md`; delete `src/utils/queueWatch.ts` and its test (Task 5).
- Create `supabase/require-report-proof.sql`, `supabase/verify-require-report-proof.sql` (Task 6).

---

### Task 1: Nothing is shown after 24 hours

**Files:**
- Modify: `src/utils/stationFreshness.ts`, `src/utils/stationFreshness.test.ts`, `src/components/StationDetailScreen.tsx`

**Interfaces:**
- Produces: `getFreshness` returns `tier 'none'`, no last-known status and no age text when the newest report is older than 24 h (the `stale` tier remains only for a Queuing report between 30 minutes and 24 h); `export function isReportVisible(report: { timestamp: string }, now?: number): boolean` (age readable and at most 24 h); `export function visibleReports<T extends { timestamp: string }>(reports: T[], now?: number): T[]`.

- [ ] **Step 1: Write the failing tests** in `stationFreshness.test.ts`:
  - `a report 23 h 59 min old still counts, one 24 h 01 min old gives tier "none" and no last-known status`
  - `a station last reported 3 days ago has no last-known status and describeStatus is "No report yet"`
  - `an expired queue shows grey "Last: Queuing" at 5 hours and nothing at 24 h 01 min`
  - `isReportVisible is true at 23 h 59 min and "just now", false at 24 h 01 min and for a report with an unreadable timestamp`
  - `visibleReports keeps order and drops old and unreadable reports`
  Update the existing tests that expect a `stale` tier or a "Last: ..." line for reports older than 24 h so they expect `none` and "No report yet", each with a one-line reason in the test.
- [ ] **Step 2: Run** `npx vitest run src/utils/stationFreshness.test.ts`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** the freshness change and the two helpers. In `StationDetailScreen.tsx` list only `visibleReports(reports, now)` in the Reports tab, and use that length in the tab label ("Reports · N").
- [ ] **Step 4: Run** `npx tsc --noEmit && npx vitest run`. Expected: pass.
- [ ] **Step 5: Commit** `git add src && git commit -m "feat(status): nothing is shown for a report older than 24 hours"`

---

### Task 2: Proof rules (pure)

**Files:**
- Create: `src/utils/reportProof.ts`, `src/utils/reportProof.test.ts`
- Modify: `src/utils/geofencePresence.ts`, `src/utils/geofencePresence.test.ts`, `src/types.ts` (`DriverReport` gains `photoLat?: number; photoLng?: number; photoAccuracyM?: number`)

**Interfaces:**
- Produces (`geofencePresence.ts`): `REPORT_GEOFENCE_METERS = 150`; `type ReportPositionCheck = { allowed: true } | { allowed: false; reason: string }`; `checkReportPosition(position: PingPosition | null | undefined, station: { lat: number; lng: number }): ReportPositionCheck`. Reasons: no usable fix "Turn on location to report."; accuracy over 100 m "Your location isn't precise enough yet. Step into the open and try again."; farther than 150 m "Reports unlock within 150 m of the station so every status comes from someone actually there."
- Produces (`reportProof.ts`): `reportProofProblem(report: { photo?: string; photoLat?: number; photoLng?: number }, station: { lat: number; lng: number }): string | null` ("Take a live photo at the station to post this report." / "The photo needs your position at the station. Retake it." / "The photo was taken too far from the station."); `reportPhotoHint(status: StationStatus, isEv: boolean): string` (CNG hints from Global Constraints; EV: "Photograph the charger display", "Photograph the busy ports", "Photograph the charger showing it's out of service"; `unknown` gives `''`).

- [ ] **Step 1: Write the failing tests:** `checkReportPosition`: allowed at 149 m, refused at 151 m with the 150 m reason, refused for `null`, for a missing coordinate, for accuracy 101 m (precision reason), allowed at accuracy 100 m and with no accuracy value. `reportProofProblem`: `null` for a photo with a position 100 m away; each of the three messages for no photo, no position (one coordinate missing counts), and a position 151 m away; an empty-string photo counts as no photo. `reportPhotoHint`: the six strings and `''` for `unknown`.
- [ ] **Step 2: Run** `npx vitest run src/utils/reportProof.test.ts src/utils/geofencePresence.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules and the type fields, reusing `isAtStation`'s distance and accuracy rules where they fit but with the 150 m radius.
- [ ] **Step 4: Run** `npx tsc --noEmit && npx vitest run`. Expected: pass.
- [ ] **Step 5: Commit** `git add src && git commit -m "feat(proof): pure rules for report position and photo proof"`

---

### Task 3: Position columns and saving them

**Files:**
- Create: `supabase/report-proof-columns.sql`
- Modify: `src/services/apiService.ts`

**Interfaces:**
- Produces: `station_reports.photo_lat double precision`, `photo_lng double precision`, both nullable, added with `add column if not exists`. `submitReport` sends `photo_lat` and `photo_lng` (and keeps them on the local copy) only when the report has them; `fetchStations` maps them to `photoLat` and `photoLng` as numbers.

- [ ] **Step 1: Write the migration.** Nothing else in it: it is safe to apply before any app change.
- [ ] **Step 2: Ask the user before applying it to production** (project `aomrrlxateneakvorzma`); apply only on a yes, then check the two columns exist.
- [ ] **Step 3: Implement** the `apiService` change (omit the two keys when the report has no position, so the app still posts on a database without the columns).
- [ ] **Step 4: Run** `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] **Step 5: Commit** `git add supabase src && git commit -m "feat(proof): store the position a report's photo was taken at"`

---

### Task 4: The report sheet requires a live photo at the station

**Files:**
- Modify: `src/components/ReportStatusModal.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `checkReportPosition`, `REPORT_GEOFENCE_METERS`, `reportProofProblem`, `reportPhotoHint` (Task 2); `lastFixRef` (the latest `PingPosition`) in `App.tsx`.
- Produces: `ReportStatusModal` props gain `getPosition: () => PingPosition | null` and `initialStatus?: StationStatus` and lose `isPresenceActive`. The report it submits carries `photo`, `photoLat`, `photoLng` and `photoAccuracyM`.

- [ ] **Step 1: Implement the sheet changes:**
  - Remove the gallery file input, `handlePhotoUpload` and the file path of `verifyImageMetadata`; the live camera is the only source (keep the duplicate-photo check and `registerSharedImageHash` at submit).
  - Make the photo block a required, always-visible step under the status list, showing the hint for the chosen status; it is not inside the "optional details" drawer.
  - The geofence banner and the camera button follow `checkReportPosition(getPosition(), station)`; a refused check shows its reason and disables the camera button and Submit. Re-run the check when the camera returns a photo (record `photoLat`, `photoLng`, `photoAccuracyM` from that fix) and again on submit; if the driver has moved away, show the 150 m reason and do not submit.
  - Submit is disabled until a photo is attached; call `reportProofProblem` before submitting and show its message; the points chip reads `+100 pts`; update the helper text ("Optional · a live photo earns 100 pts instead of 50" becomes about price, wait time or a note only, with no points claim).
  - Start with `selectedStatus` equal to `initialStatus` when given.
- [ ] **Step 2: In `App.tsx`** pass `getPosition={() => lastFixRef.current}`, remove the `isPresenceActive` computation, and let `handleOpenReportModal(station, initialStatus?)` store an optional initial status in state for the sheet.
- [ ] **Step 3: Run** `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] **Step 4: Browser check** (`cng-dev`): at least that the sheet opens, shows the three hints, keeps Submit disabled without a photo, and shows the 150 m reason away from a station. Taking a real photo within 150 m needs a device; say so if it cannot be exercised.
- [ ] **Step 5: Commit** `git add src && git commit -m "feat(proof): a report needs a live photo taken at the station"`

---

### Task 5: Prompts open the sheet; remove the leave prompt

**Files:**
- Modify: `src/components/ProximityAlertBanner.tsx`, `src/App.tsx`, `src/services/analytics.ts`, `README.md`
- Delete: `src/utils/queueWatch.ts`, `src/utils/queueWatch.test.ts`

**Interfaces:**
- Produces: `ProximityAlertBanner` props: `onPickStatus: (station: GasStation, status: StationStatus) => void` replaces `onQuickSubmitReport`; `variant?: 'arrival' | 'followup'` (no `'left'`); no thank-you state. `submitReportFor` refuses a report that fails `reportProofProblem(report, station)` (toast "A photo taken at the station is required." and no post), so no future path can skip the proof.

- [ ] **Step 1: Write the failing test** for the guard's rule in `reportProof.test.ts` if not already covered (the same function): `refuses a report built by a one-tap prompt (no photo, no position)`. It should already pass from Task 2; if it does, note that and continue (it pins the contract the guard relies on).
- [ ] **Step 2: Implement:** the banner's three status buttons call `onPickStatus`; `App.tsx` closes the banner and opens the report sheet with that status via `handleOpenReportModal(station, status)`; remove the `'left'` variant, the leave-prompt check and `presence.busy` from the GPS handler, every `rememberQueueReport` / `clearQueueWatchFor` / `takeDueLeftPrompt` call, the `source === 'left'` branches in `submitReportFor`, and the `'left'` option from `proximityVariant`; delete `queueWatch.ts` and its test; remove `queue_left_prompt_shown` and `queue_left_answer` from `analytics.ts`; add the guard at the top of `submitReportFor`. In `README.md` drop the sentence about the leave prompt.
- [ ] **Step 3: Run** `npx tsc --noEmit && npx vitest run && npm run build`, then `grep -rn "queueWatch\|queue_left\|onQuickSubmitReport\|'left'" src` and confirm nothing is left. Expected: pass and no matches.
- [ ] **Step 4: Commit** `git add -A src README.md && git commit -m "feat(proof): one-tap prompts open the report sheet; remove the leave prompt"`

---

### Task 6: Database enforcement (written and tested, not enabled)

**Files:**
- Create: `supabase/require-report-proof.sql`, `supabase/verify-require-report-proof.sql`

**Interfaces:**
- Produces: a `before insert` trigger on `station_reports` that, when `auth.uid()` is not null, raises `'a photo taken at the station is required'` unless `photo` is non-empty and `photo_lat`, `photo_lng` are present and within 150 m of the station's `lat`, `lng` (great-circle distance in SQL). Inserts with no login (admin SQL, seeds) pass; existing rows are untouched.

- [ ] **Step 1: Write the migration** (function plus trigger, idempotent).
- [ ] **Step 2: Write the smoke test** as one `begin; ... rollback;` block that **includes the migration text first** (so it is tested without being enabled) and then lists PASS/FAIL, using made-up logins as in `verify-station-car-counts.sql`: refuses no photo, an empty photo, no position, one missing coordinate and a position 151 m away; allows 149 m; allows an insert with no login and no photo; leaves an existing row alone; afterwards nothing persists.
- [ ] **Step 3: Run the smoke test against production** (project `aomrrlxateneakvorzma`; it is rolled back and enables nothing) and confirm every row PASSES and the trigger does not exist afterwards.
- [ ] **Step 4: Commit** `git add supabase && git commit -m "feat(proof): database rule requiring a photo taken at the station (not enabled)"`

---

### Task 7: Docs and final check

- [ ] **Step 1: README:** a line under Fast Driver Status Reporting that every report needs a live photo taken at the station, and that nothing older than 24 hours is shown; update the test count.
- [ ] **Step 2: Run** `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] **Step 3: Tell the user** the deploy order (columns applied first, app deployed, trigger enabled only later on their word), what could not be tried without a real phone, that drivers must now be within 150 m to report, and that the public API (still uncommitted) needs the same 24-hour rule when it is committed.
