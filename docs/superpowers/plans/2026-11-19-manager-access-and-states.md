# Manager Access and Three-State Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the user prefers native). Steps use checkbox (`- [ ]`) syntax. Before any UI edit read the Impeccable craft floor and keep to `DESIGN.md` (gold only on pressable things).

**Goal:** Station managers sign in with an emailed code (no driver account) after the admin invites their email, and post one of Closed / Open, waiting for gas / Open, gas available, shown to drivers on the station page for 6 hours.

**Architecture:** An invites table plus a `claim_station_manager_invites()` function turn an invited email into a station assignment on first code sign-in. A new `manager_state` column and `manager_post_state()` function carry the three states, keeping the old `manager_selling` field in step for phones that have not updated. The client gets pure helpers for the new states, a code-based sign-in mode for the manager entrance, an invite flow in the admin, and updated manager and driver displays.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (pure utils plus `react-dom/server` render tests), Supabase Postgres (SECURITY DEFINER functions) and its email-code (OTP) login.

**Spec:** `docs/superpowers/specs/2026-11-19-manager-access-and-states-design.md`

## Global Constraints

- States are exactly `closed`, `open`, `selling`; labels "Closed", "Open, waiting for gas", "Open, gas available"; driver wording "Open for business · Gas available", "Open · Waiting for gas supply", "Closed", each followed by "· updated <age>".
- A manager status shows for **360 minutes** (`MANAGER_STATE_MINUTES`), then disappears. Pressure rules from the earlier work are unchanged.
- Manager status never changes driver status, pin colour, ranking, the Reports tab, points or flags. No push notifications, no follow feature, no new server keys.
- An invite can only be claimed by a login whose verified email equals the invited email (case-insensitive). Only the admin can invite, cancel, assign or remove.
- Old phones keep working: `manager_selling` is set to true for `selling` and false for `closed` and `open`; the new function also writes `manager_selling_at`.
- Project rules: commit per task on branch `feat/manager-access-and-states`; push, merge and deploy only when the user asks; production database changes only with explicit approval (smoke test in a rolled-back transaction first).

## Review Focus

1. An invite for a@x.com cannot be claimed by b@x.com, and claiming twice is harmless (Task 2 smoke test).
2. A manager removed after claiming loses access at once (existing refusal path); a pending invite can be cancelled before it is claimed (Task 2).
3. The three states expire at 360 minutes and an old "selling-only" station row still shows correctly (Task 1 tests).
4. The code sign-in handles a wrong or expired code, a resend, and an invalid email without a crash or a stuck screen (Task 4 tests).
5. A signed-in person with no assignments at `/station-manager` sees a clear "no stations yet" message, not an error (Task 4).

## File Structure

- Create `src/utils/managerState.ts` + `.test.ts`; modify `src/types.ts`, `src/utils/stationManagerSignals.ts` + test (Task 1).
- Create `supabase/manager-access-and-states.sql`, `supabase/verify-manager-access-and-states.sql` (Task 2).
- Modify `src/services/stationManagerService.ts` + test (Task 3).
- Modify `src/components/admin/AdminAuthGate.tsx`, `StationManagerEntrance.tsx`; create `src/components/admin/CodeSignIn.tsx` + test (Task 4).
- Modify `src/components/admin/StationManagersPanel.tsx`, `UsersPanel.tsx`, `UsersDirectory.tsx` (+ test), `src/utils/stationManagerGroups.ts` + test (Task 5).
- Modify `src/components/admin/StationQuickUpdate.tsx`, `MyStationsPanel.tsx`, `src/components/common/StationSaysLine.tsx` (+ test), `src/services/apiService.ts` (Task 6).
- Modify `README.md` (Task 7).

---

### Task 1: Three-state helpers and types

**Files:** Create `src/utils/managerState.ts`, `src/utils/managerState.test.ts`; modify `src/types.ts` (`GasStation` gains `managerState?: 'closed' | 'open' | 'selling'; managerStateAt?: string`).

**Interfaces — Produces:**
`type ManagerState = 'closed' | 'open' | 'selling'`; `MANAGER_STATE_MINUTES = 360`; `MANAGER_STATE_OPTIONS: { state: ManagerState; label: string }[]` (Closed, Open, waiting for gas, Open, gas available);
`interface ManagerStatement { state: ManagerState; ageMinutes: number }`;
`getManagerStatement(station: Pick<GasStation,'managerState'|'managerStateAt'|'managerSelling'|'managerSellingAt'>, now?: number): ManagerStatement | null` (uses the new fields; falls back to the legacy pair, mapping `true` to `selling` and `false` to `closed`; null when missing, unreadable, or older than 360 minutes);
`describeManagerState(statement: ManagerStatement): string` (the driver wording above, with "· updated <age>" using `formatAgeShort`).

- [ ] Step 1: Failing tests: `returns the new state with its age within 360 minutes, including exactly 360`; `is null at 361 minutes, with no timestamp, with an unreadable timestamp, or with no state`; `falls back to the legacy selling flag when no new state exists (true is selling, false is closed)`; `the new state wins over the legacy flag when both exist`; `describeManagerState gives the three driver sentences with the age`; `a future timestamp gives age 0`.
- [ ] Step 2: Run `npx vitest run src/utils/managerState.test.ts`. Expected: FAIL (module missing).
- [ ] Step 3: Implement; leave `stationManagerSignals.ts` pressure helpers as they are and make its old `getSellingStatement` unused only after Task 6 swaps its callers (delete it then, with its tests).
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run`. Expected: pass.
- [ ] Step 5: Commit `feat(manager): three-state status helpers`.

### Task 2: Database migration and smoke test

**Files:** Create `supabase/manager-access-and-states.sql` (idempotent), `supabase/verify-manager-access-and-states.sql`; add the new function names to the grant list in `supabase/security-hardening-2026-10.sql`.

**Interfaces — Produces:** table `station_manager_invites (id uuid, station_id text, email text, invited_by uuid, created_at)` with `unique (station_id, email)`, RLS on, admin-select policy only; columns `stations.manager_state text check in ('closed','open','selling')` and `stations.manager_state_at timestamptz`; `station_manager_posts` gains `state text` and its `kind` check allows `'state'`; RPCs `manager_post_state(p_station_id text, p_state text) returns void`, `admin_invite_station_manager(p_station_id text, p_email text) returns text` (`'assigned'` when a profile with that email exists, else `'invited'`), `admin_cancel_station_manager_invite(p_station_id text, p_email text) returns void`, `claim_station_manager_invites() returns integer` (number assigned). All `security definer`, `set search_path = public`, revoked from anon, granted to authenticated.

- [ ] Step 1: Write the migration: emails are lower-cased and trimmed, validated with a simple `position('@' in …)` check; `admin_invite_station_manager` requires the admin and a real station; `claim_station_manager_invites` uses `lower(auth.jwt() ->> 'email')`, inserts `station_managers` rows for matching invites (on conflict do nothing), deletes the claimed invites and returns the count, and returns 0 for a caller with no email; `manager_post_state` requires an assignment, validates the state, sets `manager_state`, `manager_state_at`, `manager_selling` (true only for `selling`) and `manager_selling_at`, and logs a row with kind `state`; `admin_remove_station_manager` also deletes a pending invite for that email.
- [ ] Step 2: Write the smoke test as one `begin; ... rollback;` block with the migration inside; claims must include `'role','authenticated'` and an `email` claim. Checks: (a) the admin inviting an email with no profile returns `invited` and stores one invite; (b) inviting an email that has a profile returns `assigned`; (c) a login whose email differs cannot claim it (returns 0); (d) the matching email claims it once and a second claim returns 0; (e) an assigned user posts each of `closed`, `open`, `selling` and the station columns, `manager_selling` and the log row follow; (f) an unassigned user and a bad state value are refused; (g) a non-admin cannot invite or cancel; (h) anon cannot execute any of the new functions; (i) cancelling a pending invite removes it.
- [ ] Step 3: Run the smoke test against production (rolled back); expected all PASS; confirm nothing persisted. **Ask the user before applying the migration for real** (project `aomrrlxateneakvorzma`).
- [ ] Step 4: Commit `feat(manager): invites, claim and three-state posts in the database (not applied yet)`.

### Task 3: Service wrappers

**Files:** Modify `src/services/stationManagerService.ts` and `.test.ts`.

**Interfaces — Produces:** `postManagerState(client: RpcClient, stationId: string, state: ManagerState): Promise<ManagerPostResult>`; `inviteStationManager(client, stationId, email): Promise<{ ok: true; result: 'assigned' | 'invited' } | { ok: false; error: string }>` (refuses a blank or obviously invalid email without calling the database); `cancelStationManagerInvite(client, stationId, email): Promise<ManagerPostResult>`; `claimManagerInvites(client): Promise<{ ok: true; claimed: number } | { ok: false; error: string }>`. `friendlyManagerError` learns `Invalid state` and an invite error ("That doesn't look like an email address").

- [ ] Step 1: Failing tests with a fake `{ rpc: vi.fn() }`: `postManagerState sends p_station_id and p_state`; `rejects an unknown state without calling the database`; `inviteStationManager trims and lower-cases the email and returns invited or assigned`; `refuses a blank or invalid email without a call`; `cancel sends both fields`; `claim returns the claimed count and survives a thrown network error`; `not authorized and invalid state errors become plain messages`.
- [ ] Step 2: Run it. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run`. Expected: pass.
- [ ] Step 5: Commit `feat(manager): service wrappers for invites and the three states`.

### Task 4: Manager sign-in by emailed code

**Files:** Create `src/components/admin/CodeSignIn.tsx` and `CodeSignIn.test.tsx`; modify `AdminAuthGate.tsx` (new optional prop `mode?: 'password' | 'code'`, default `'password'`) and `StationManagerEntrance.tsx` (uses `mode="code"`, and once signed in calls `claimManagerInvites`, then lets `MyStationsPanel` load).

**Interfaces — Consumes:** `sendLoginCode`, `verifyLoginCode` from `useAuth` (existing), Task 3 `claimManagerInvites`. **Produces:** `CodeSignIn: React.FC<{ title: string; onExit: () => void; sendCode: (email: string) => Promise<{success: boolean; error?: string}>; verifyCode: (email: string, code: string) => Promise<{success: boolean; error?: string}> }>`: step 1 asks for the email and sends the code; step 2 asks for the code, with "Use a different email" and "Send a new code" (disabled for 30 seconds); errors shown in plain words; buttons disabled while busy.

- [ ] Step 1: Failing render tests: `step one shows an email field and a "Send me a code" button`; `an invalid email shows a message and sends nothing` (test the pure validation helper exported from the file); `the title and a Back to app link are shown`. Behaviour of the two-step state is covered by a small pure reducer `nextStep(state, event)` with tests: email sent → code step; wrong code → stays with error; "different email" → back to step one.
- [ ] Step 2: Run them. Expected: FAIL.
- [ ] Step 3: Implement `CodeSignIn` with the kit (gold primary button, labelled inputs, `autoComplete="one-time-code"` and numeric input mode for the code); wire it into the gate and the entrance; the entrance shows "You have no stations yet. Ask the app admin to invite this email." when the claim finds nothing and the list is empty.
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass. Browser check `localhost:3002/station-manager` shows the email step.
- [ ] Step 5: Commit `feat(manager): sign in with an emailed code, no driver account`.

### Task 5: Admin invites and labels

**Files:** Modify `StationManagersPanel.tsx` (the add form calls `inviteStationManager`; wording: "They don't need a CNG-Connect account. They sign in at /station-manager with a code sent to this email."; a pending-invites list per station with Cancel), `src/utils/stationManagerGroups.ts` + test (group pending invites with a `pending` flag), `UsersPanel.tsx` (loads manager user ids from `station_managers`), `UsersDirectory.tsx` + test (optional `managerIds?: Set<string>` prop; the Role cell shows a "Station manager" badge for those ids).

- [ ] Step 1: Failing tests: groupManagers keeps pending invites as separate entries marked pending and never merges them with real managers; the directory shows "Station manager" for ids in `managerIds` and nothing for others.
- [ ] Step 2: Run them. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] Step 5: Commit `feat(admin): invite managers by email; label manager accounts`.

### Task 6: Manager card and driver display

**Files:** Modify `StationQuickUpdate.tsx` (three buttons from `MANAGER_STATE_OPTIONS`, the current one highlighted while it is still showing, "Posted 20 min ago · drivers see it for 6 hours"), `MyStationsPanel.tsx` (the new columns), `src/components/common/StationSaysLine.tsx` + test (use `getManagerStatement` and `describeManagerState`; compact badge text "Station: open, gas available" / "Station: open, no gas yet" / "Station: closed"), `src/services/apiService.ts` (map `manager_state`, `manager_state_at`). Remove `getSellingStatement`/`describeSelling` and their tests once no caller remains.

- [ ] Step 1: Update `StationSaysLine.test.tsx` first (the three wordings, the legacy-flag fallback, nothing after 6 hours, the compact badge texts, pressure unchanged). Expected: FAIL.
- [ ] Step 2: Implement the card, the line and the mapping.
- [ ] Step 3: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] Step 4: Browser check of the driver map and a station page with no manager data: nothing extra, no errors.
- [ ] Step 5: Commit `feat(manager): three-state card and driver wording`.

### Task 7: Docs and final check

- [ ] Step 1: `README.md`: managers are invited by email and sign in with a code (no driver account); the three states; test counts.
- [ ] Step 2: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] Step 3: Commit `docs: manager access and three-state status`; tell the user the production order: apply the migration (after their yes), then deploy; the app shows the old two-state wording until the migration is applied.
