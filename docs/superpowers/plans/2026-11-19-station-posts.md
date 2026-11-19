# Station posts with reason, expected time, hours fallback and WhatsApp share — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A station manager's post can carry a reason and an expected time; drivers see them; a closed station outside its hours says so; managers can share an update to WhatsApp.

**Architecture:** Two optional columns on `stations` (and the post log) plus a replaced `manager_post_state` RPC. Pure helpers (`managerState`, `stationHours`, `expectedBack`, share builder) carry the logic and are unit-tested; the components only render them.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Supabase Postgres RPCs, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-11-19-station-posts-design.md`

## Global Constraints

- Reports older than 45 minutes are never shown; **do not** add a grey "last reported" line.
- No driver-report status is added; pins, ranking, points and flags do not change.
- No referral or airtime wording; the share message carries the plain `?station=<id>` link only.
- Manager post visibility: **6 hours** without an expected time; with one, until the expected time **+ 60 minutes**, capped at **24 hours** from the post.
- Time zone for hours and expected-back clocks is fixed **WAT (UTC+1)**.
- Tap targets `min-h-[44px]`; field text 16px on phones (`max-md:text-base`).
- Old phones must keep working: `manager_post_state(p_station_id, p_state)` calls with two arguments must still succeed after the migration.
- Do not touch the user's main checkout (`/Users/apple/Desktop/CNG Coonect/CNG-connect`, branch `feat/public-api`); work only in this worktree on `feat/station-posts`.

## Review Focus

1. Old app posts `manager_post_state` with two arguments after the migration: must succeed (no "could not choose best candidate" overload error).
2. Expected time that has already passed: line says "not confirmed", never reads as still true; and after +60 min the post disappears.
3. Hours that cross midnight (e.g. opens 22:00, closes 06:00) and stations with equal opens/closes or missing times: never "Closed" wrongly.
4. A manager typing a clock time earlier than now: resolves to tomorrow, never to the past; always ≤ 24 h ahead.
5. Posting `selling` after a closed-with-reason post: reason and time cleared, so "Open, gas available" never shows "waiting for supply".

---

### Task 1: Database migration and verify script

**Files:**
- Create: `supabase/station-post-details.sql`
- Create: `supabase/verify-station-post-details.sql`

**Interfaces:**
- Produces: columns `stations.manager_state_reason text`, `stations.manager_state_until timestamptz`, same two on `station_manager_posts`; RPC `manager_post_state(p_station_id text, p_state text, p_reason text default null, p_until timestamptz default null) returns void`.

- [ ] **Step 1: Write the migration** (`station-post-details.sql`, idempotent, header comment like the sibling files):
  - `alter table stations add column if not exists manager_state_reason text; … manager_state_until timestamptz;` and the same on `station_manager_posts`.
  - Check constraint `stations_manager_state_reason_values` (`null` or `supply|fault|power|other`), added in a `do $$ … if not exists` block like the existing state constraint.
  - `drop function if exists manager_post_state(text, text);` then `create or replace function manager_post_state(p_station_id text, p_state text, p_reason text default null, p_until timestamptz default null)` (`security definer`, `set search_path = public`). Keep the existing checks (caller in `station_managers`, state in closed/open/selling). Rules: reason kept only when state is `closed` or `open` and reason is in the allowed list, else null; `p_until` kept only when state is `closed`/`open` and `now() < p_until <= now() + interval '24 hours'`, else null. Update `stations` (state, `manager_state_at = now()`, reason, until, and the old `manager_selling` / `manager_selling_at` as before) and insert the log row with the same reason/until.
  - `revoke all on function manager_post_state(text, text, text, timestamptz) from public, anon;` and `grant execute … to authenticated;`.
- [ ] **Step 2: Write `verify-station-post-details.sql`** in the style of `verify-manager-access-and-states.sql`: `begin;`, the migration text inlined, then a final SELECT of PASS/FAIL rows, then `rollback;`. Checks: a 2-argument call still resolves and succeeds for an assigned manager; a non-manager is refused (`not authorized`); reason `supply` + future until is stored on `closed`; a past `p_until` is stored as null; an `p_until` 30 h ahead is stored as null; an unknown reason is stored as null; `selling` clears reason and until; the old `manager_selling` stays in step.
- [ ] **Step 3: Run the verify script** inside its own transaction through the Supabase MCP `execute_sql` on project `aomrrlxateneakvorzma` (it rolls back). Expected: every row PASS. Fix the migration until they are.
- [ ] **Step 4: Commit** — `git add supabase/station-post-details.sql supabase/verify-station-post-details.sql && git commit -m "feat(db): manager posts can carry a reason and an expected time"`.

(The migration is applied to the live database in Task 6, after the code is green.)

### Task 2: Manager statement with reason and expected time

**Files:**
- Modify: `src/types.ts` (add `managerStateReason?: ManagerStateReason; managerStateUntil?: string;` next to `managerStateAt`)
- Modify: `src/utils/managerState.ts`
- Modify: `src/services/apiService.ts` (map `manager_state_reason` / `manager_state_until`, validating the reason against the four values)
- Test: `src/utils/managerState.test.ts`

**Interfaces:**
- Produces:
  - `type ManagerStateReason = 'supply' | 'fault' | 'power' | 'other'`
  - `MANAGER_REASON_OPTIONS: { reason: ManagerStateReason; label: string }[]` — labels `Waiting for supply`, `Technical fault`, `No power`, `Other`
  - `ManagerStatement` becomes `{ state; ageMinutes; reason?: ManagerStateReason; untilMs?: number; overdue: boolean }`
  - `getManagerStatement(station, now?)` honours the visibility rule from Global Constraints
  - `describeManagerState(statement, now?)`
  - `formatWatTime(ms: number): string` → `"2 pm"`, `"2:30 pm"`, `"6 am"` (WAT)

- [ ] **Step 1: Write failing tests** (extend `managerState.test.ts`; keep the existing ones green):
  - no until, age 360 → visible, 361 → null (unchanged).
  - until in 2 h, posted 30 min ago → visible, `overdue: false`; same post 3 h later (now = until + 59 min) → visible, `overdue: true`; now = until + 61 min → null.
  - until 20 h ahead is honoured; a post whose until + 60 min is more than 24 h after `managerStateAt` is cut at 24 h.
  - `describeManagerState`: `{closed, reason supply, untilMs 14:00 WAT, overdue false}` → contains `Closed`, `Waiting for supply`, `expected about 2 pm`; overdue → contains `Was expected back 2 pm · not confirmed` and not `expected about`; `selling` never prints a reason even if one is present.
  - `formatWatTime(Date.parse('2026-11-19T13:00:00Z'))` → `"2 pm"`; `…T05:30:00Z` → `"6:30 am"`; midnight → `"12 am"`.
- [ ] **Step 2: Run** `npx vitest run src/utils/managerState.test.ts` → Expected: new tests FAIL (missing exports / fields).
- [ ] **Step 3: Implement** the above in `managerState.ts`; `selling` statements drop reason/until. Add the type fields and the `apiService` mapping.
- [ ] **Step 4: Run** `npx vitest run src/utils/managerState.test.ts && npx tsc --noEmit` → Expected: PASS, no type errors.
- [ ] **Step 5: Commit** — `feat(posts): statements carry a reason and an expected time`.

### Task 3: Posting details and the expected-back time

**Files:**
- Modify: `src/services/managerAccessService.ts` (`postManagerState` gains an optional 4th argument)
- Create: `src/utils/expectedBack.ts`
- Test: `src/utils/expectedBack.test.ts`, `src/services/managerAccessService.test.ts`

**Interfaces:**
- Consumes: `ManagerStateReason` from Task 2.
- Produces:
  - `postManagerState(client, stationId, state, details?: { reason?: ManagerStateReason; untilIso?: string })` — sends `p_reason` / `p_until` only when given; with no details the RPC args are exactly `{ p_station_id, p_state }` (old-phone shape)
  - `type ExpectedBack = { inHours: 1 | 2 | 4 } | { clock: string }` (`"HH:MM"`, WAT)
  - `resolveExpectedBack(choice: ExpectedBack, now?: number): string | null` → ISO string; clock earlier than or equal to now resolves to the next day; invalid clock → null; result always in (now, now + 24 h]

- [ ] **Step 1: Write failing tests:** `resolveExpectedBack({ inHours: 2 }, NOW)` = NOW + 2 h; `{ clock: '14:00' }` at 12:00 WAT → today 14:00 WAT; at 15:00 WAT → tomorrow 14:00 WAT; `'25:00'`, `'abc'`, `''` → null; service: no details → rpc called with exactly two args; with details → `p_reason: 'supply'` and `p_until` present; `selling` never sends details even if passed.
- [ ] **Step 2: Run** `npx vitest run src/utils/expectedBack.test.ts src/services/managerAccessService.test.ts` → FAIL.
- [ ] **Step 3: Implement** `expectedBack.ts` (WAT = UTC+1 arithmetic, no `Intl` time-zone dependency) and extend `postManagerState`.
- [ ] **Step 4: Run** the same command plus `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `feat(posts): send a reason and an expected time with a post`.

### Task 4: Opening hours fallback and the chip

**Files:**
- Create: `src/utils/stationHours.ts`
- Modify: `src/components/common/StationStatusChip.tsx`
- Modify: `src/components/common/StationSaysLine.tsx` (compact badge shows `back ~2 pm`; page line uses the new `describeManagerState`)
- Test: `src/utils/stationHours.test.ts`, `src/components/common/StationSaysLine.test.tsx`, new `src/components/common/StationStatusChip.test.tsx`

**Interfaces:**
- Consumes: `getManagerStatement`, `formatWatTime` (Task 2).
- Produces: `describeClosedHours(station: Pick<GasStation, 'opensAt' | 'closesAt' | 'is24Hours'>, now?: number): string | null` → `"Closed · opens 6 am"`, `"Closed · opens tomorrow 6 am"`, or `null` when open, 24 h, missing times, or `opensAt === closesAt`.

- [ ] **Step 1: Write failing tests:**
  - hours `06:00:00`–`22:00:00`: at 05:00 WAT → `Closed · opens 6 am`; 12:00 → null; 22:00 exactly → `Closed · opens tomorrow 6 am`; 23:30 → same.
  - overnight `22:00:00`–`06:00:00`: 23:00 → null; 03:00 → null; 12:00 → `Closed · opens 10 pm`.
  - `is24Hours: true`, null times, equal times, unparseable `"abc"` → null.
  - Chip: no fresh report + fresh manager post → renders nothing (the Station says badge speaks); no report, no post, outside hours → grey chip with `Closed · opens 6 am`; no report, no post, inside hours → `No report yet`; a fresh driver report still shows its normal chip.
  - Line: closed + reason + until renders `Waiting for supply` and `expected about 2 pm`; compact badge for `closed` with until contains `back ~2 pm`; `selling` badge unchanged.
- [ ] **Step 2: Run** `npx vitest run src/utils/stationHours.test.ts src/components/common` → FAIL.
- [ ] **Step 3: Implement** `stationHours.ts` (WAT minutes-of-day; handle midnight-crossing), update the chip's `none` branch per the tests, update the line/badge text. Pin colours and ranking untouched.
- [ ] **Step 4: Run** the same command plus `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `feat(posts): hours fallback and the manager's words in the status chip`.

### Task 5: Manager card — details and WhatsApp share

**Files:**
- Modify: `src/components/admin/StationQuickUpdate.tsx` (new props `stationName`, `city`, `managerStateReason`, `managerStateUntil`)
- Modify: `src/components/admin/MyStationsPanel.tsx` (`statusCard` passes the new props from the `my_managed_stations` row)
- Modify: `src/utils/shareMessageBuilder.ts` (add `buildManagerShareMessage`, `openManagerWhatsAppShare`)
- Test: `src/utils/shareMessageBuilder.test.ts` (extend or create), `src/components/admin/StationQuickUpdate.test.tsx`

**Interfaces:**
- Consumes: `postManagerState` + `resolveExpectedBack` (Task 3), `MANAGER_REASON_OPTIONS`, `describeManagerState`, `formatWatTime` (Task 2), `buildStationShareUrl` (existing).
- Produces: `buildManagerShareMessage(input: { stationId: string; name: string; city: string; statement: ManagerStatement; now?: number }): string`; `openManagerWhatsAppShare(input)` opens `https://wa.me/?text=<encoded>` and tracks `share_clicked`.

- [ ] **Step 1: Write failing tests:**
  - Share message contains station name, city, the manager sentence, `Waiting for supply` and `expected about 2 pm` when present, a posted time, and `?station=<id>`; contains no `referral`, `airtime` or `reward` (case-insensitive).
  - Card (mock supabase client): with a current `closed` post, the "Why?" chips and "Expected back" chips render; with `selling` or no post they do not; choosing "Waiting for supply" + "In 2 hours" then "Save details" calls `manager_post_state` with `p_state: 'closed'`, `p_reason: 'supply'` and a `p_until` about 2 h ahead; the share button is disabled with no current post and enabled with one; every new control is at least 44 px (`min-h-[44px]` class).
- [ ] **Step 2: Run** `npx vitest run src/utils/shareMessageBuilder.test.ts src/components/admin/StationQuickUpdate.test.tsx` → FAIL.
- [ ] **Step 3: Implement.** Details UI sits under the status buttons: reason chips (`aria-pressed`), expected-back chips (`In 1 hour`, `In 2 hours`, `In 4 hours`) plus a `type="time"` input (16px on phones), and a "Save details" button; selecting nothing and saving is allowed only if something is selected. Share button label `Share update on WhatsApp`. Reuse existing button/chip classes from the card.
- [ ] **Step 4: Run** the same command plus `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `feat(posts): manager details card and WhatsApp share`.

### Task 6: Docs, full check, live database, phone-size check

**Files:**
- Modify: `README.md` (manager paragraph: reason and expected time, hours fallback, WhatsApp share; test count; `supabase/station-post-details.sql` in the needs list)

- [ ] **Step 1: Run the whole suite and checks:** `npm test`, `npx tsc --noEmit`, `npm run build`. Expected: all green; note the new test count and put it in the README.
- [ ] **Step 2: Apply the migration** to project `aomrrlxateneakvorzma` with the Supabase MCP `apply_migration` (name `station_post_details`, text of `supabase/station-post-details.sql`), then confirm with `execute_sql` that the four columns exist and `manager_post_state` has exactly one signature (`select oid::regprocedure from pg_proc where proname = 'manager_post_state'`). Expected: one row with four arguments.
- [ ] **Step 3: Phone-size look:** run `npx vite --port=3011 --strictPort` from this worktree (background; not the `cng-dev` preview, which serves the main checkout), open it at 375 px, check the driver map list and a station page render the hours fallback and the chip without overflow, and that the manager card's new controls measure at least 44 px (the manager screen needs a sign-in, so verify the component through its test and report that it was not seen signed in). Stop the server afterwards.
- [ ] **Step 4: Commit** — `docs: station post details in the README`. **Do not merge or push**; wait for the user's "merge and deploy".
