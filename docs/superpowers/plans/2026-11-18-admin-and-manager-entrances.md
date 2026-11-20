# Admin and Manager Entrances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended here) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `/admin` is the super admin's dashboard and `/station-manager` is the station manager's page, each refusing the other role; the super admin gets a Station managers tab; only SQL can make an admin.

**Architecture:** A pure route resolver maps a URL (path or legacy query) to an entrance; `App.tsx` renders `AdminScreen` or a new `StationManagerEntrance` from it, and Vercel rewrites both paths to the app. The database already enforces roles; this adds a tightened `is_admin` guard.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (logic in pure utils; `react-dom/server` render tests allowed), Supabase Postgres, Vercel.

**Spec:** `docs/superpowers/specs/2026-11-18-admin-and-manager-entrances-design.md`

## Global Constraints

- Entrance paths are exactly `/admin` and `/station-manager` (a trailing slash and deeper sub-paths also match).
- Legacy links: `?admin=1` and `?moderation=1` open the admin entrance; `?manager=1` opens the manager entrance. Other query params (for example `?station=`) never trigger an entrance.
- Only a profile with `is_admin` may use `/admin`; the manager page shows only stations in `station_managers` for the caller.
- No in-app or API path may change `profiles.is_admin`; only direct SQL can.
- Never show the "not for you" screen to an admin while their profile is still loading.
- Project rules: commit/push only when the user asks to merge/deploy; production DB changes only with explicit approval; work on branch `feat/admin-manager-entrances` (already created in this worktree). Do not touch the driver-facing screens.

## Review Focus

1. `/administrator`, `/admins`, `/station-managers`, `/Admin` casing and `/admin/` are resolved correctly (Task 1 tests).
2. A normal driver who opens `?station=abc` or `/` never lands in an entrance (Task 1 tests).
3. An admin whose profile loads slowly is not shown the "no access" screen (Task 3).
4. A direct request to `admin_update_profile` with `p_is_admin = true` leaves `is_admin` unchanged, and a user updating their own row cannot set it either (Task 5 smoke test).
5. Removing a manager takes effect immediately in the Station managers tab and their next post is refused (Task 4 behaviour; database refusal already covered by the earlier smoke test).

## File Structure

- Create `src/utils/adminRoutes.ts` + `.test.ts` (Task 1).
- Modify `vercel.json`, `src/App.tsx` (Task 2).
- Create `src/components/admin/StationManagerEntrance.tsx`, `src/components/admin/NotForYou.tsx`; modify `AdminScreen.tsx`, `MyStationsPanel.tsx` (Task 3).
- Create `src/utils/stationManagerGroups.ts` + `.test.ts`, `src/components/admin/StationManagersPanel.tsx`; modify `AdminScreen.tsx` (Task 4).
- Create `supabase/lock-admin-flag.sql`, `supabase/verify-lock-admin-flag.sql`; modify `src/components/admin/UserEditorModal.tsx` (Task 5).
- Modify `README.md` (Task 6).

---

### Task 1: Route resolver

**Files:** Create `src/utils/adminRoutes.ts`, `src/utils/adminRoutes.test.ts`.

**Interfaces — Produces:**
`type Entrance = 'admin' | 'manager'`;
`ADMIN_PATH = '/admin'`, `MANAGER_PATH = '/station-manager'`;
`entrancePath(entrance: Entrance): string`;
`resolveEntrance(pathname: string, search: string): { entrance: Entrance | null; canonicalPath: string | null }` — `canonicalPath` is the new path when the match came from a legacy query (so the caller can `replaceState`), otherwise `null`.

- [ ] Step 1: Write failing tests (names): `matches /admin, /admin/ and /admin/anything as the admin entrance`; `matches /station-manager and /station-manager/ as the manager entrance`; `is case-insensitive for the path`; `does not match /administrator, /admins, /station-managers or /adminx`; `maps ?admin=1 and ?moderation=1 to admin and ?manager=1 to manager with the new canonicalPath`; `an explicit path wins over a legacy query and gives no canonicalPath`; `returns no entrance for /, /?station=abc and empty strings`.
- [ ] Step 2: Run `npx vitest run src/utils/adminRoutes.test.ts`. Expected: FAIL (module missing).
- [ ] Step 3: Implement the module.
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run`. Expected: pass.
- [ ] Step 5: Commit `feat(admin): resolve /admin and /station-manager entrances`.

### Task 2: Serve the paths and wire the app

**Files:** Modify `vercel.json` (add `rewrites` sending `/admin`, `/admin/:path*`, `/station-manager`, `/station-manager/:path*` to `/index.html`; keep every existing header), `src/App.tsx` (replace the `adminMode` query check at ~line 90 with `resolveEntrance(window.location.pathname, window.location.search)`; when `canonicalPath` is set call `history.replaceState({}, '', canonicalPath)`; render `AdminScreen` for `admin` and `StationManagerEntrance` for `manager`; both `onExit` go to `'/'`, not to `window.location.pathname`).

**Interfaces — Consumes:** Task 1. **Produces:** `App` mounts `<StationManagerEntrance onExit={() => void} />` (Task 3 creates it).

- [ ] Step 1: Make the edits. The `StationManagerEntrance` import is lazy, like `AdminScreen` (use the existing `safeLazy` helper) so drivers never download it.
- [ ] Step 2: Run `npx tsc --noEmit && npm run build`. Expected: pass (Task 3 must exist first for the import; create a one-line placeholder export in Task 3's file path only if needed to keep this task's build green, and replace it in Task 3).
- [ ] Step 3: Check `vite.config.ts` workbox settings keep a navigation fallback so an installed phone opens `/admin` and `/station-manager` offline-first without a 404; add `navigateFallbackDenylist` only if an `/api` route would be caught. Record what you found in the ledger.
- [ ] Step 4: Commit `feat(admin): serve /admin and /station-manager and route to them`.

### Task 3: Role gating and the manager entrance

**Files:** Create `src/components/admin/NotForYou.tsx` (`React.FC<{ title: string; message: string; linkLabel: string; linkHref: string }>`), `src/components/admin/StationManagerEntrance.tsx` (`React.FC<{ onExit: () => void }>`: `AdminAuthGate` titled "Station manager", `AdminSidebarLayout` with the single item "My stations", renders `MyStationsPanel`); modify `AdminScreen.tsx` (remove `MANAGER_NAV` and the `mystations` item/route; after sign-in, if the profile has loaded and the user is not an admin, render `NotForYou` pointing at `/station-manager`), `MyStationsPanel.tsx` (empty-state text: drop the SQL hint; for an admin say "You're the app admin. Open the admin dashboard at /admin").

- [ ] Step 1: Implement. Decide "profile loaded" from what `AuthContext` exposes (a loading flag, or the profile's `email` being set). Never render `NotForYou` while that is unknown. Add a render test (`react-dom/server`) for `NotForYou` showing the message and link.
- [ ] Step 2: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] Step 3: Browser check at `localhost:3002/admin` and `/station-manager`: both show their sign-in screen; the driver app at `/` is unchanged. A signed-in check needs real accounts: say so if not possible.
- [ ] Step 4: Commit `feat(admin): separate manager entrance and role gating`.

### Task 4: Station managers tab

**Files:** Create `src/utils/stationManagerGroups.ts` + `.test.ts`, `src/components/admin/StationManagersPanel.tsx`; modify `AdminScreen.tsx` (nav item `{ key: 'managers', label: 'Station managers', icon: 'groups' }` after Users, and its route).

**Interfaces — Produces:**
`interface ManagerLink { stationId: string; stationName: string; userId: string; email: string; name: string }`;
`interface ManagerGroup { userId: string; email: string; name: string; stations: { id: string; name: string }[] }`;
`groupManagers(links: ManagerLink[]): ManagerGroup[]` — one group per user, groups sorted by email, stations sorted by name, duplicates (same user and station) collapsed.

- [ ] Step 1: Failing tests: `groups links by user and sorts groups by email and stations by name`; `collapses a duplicate user and station pair`; `returns an empty list for no links`.
- [ ] Step 2: Run `npx vitest run src/utils/stationManagerGroups.test.ts`. Expected: FAIL.
- [ ] Step 3: Implement `groupManagers`.
- [ ] Step 4: Implement the panel: load `station_managers` (all rows, allowed for admins by the existing policy), then `stations` (`id,name`) and `profiles` (`id,email,name`) for those ids, build `ManagerLink[]`, show `groupManagers` output as cards (manager email and name, their stations, a Remove button per station calling `admin_remove_station_manager`). An "Add manager" form: email input and a station `<select>` (all stations, sorted by name) calling `admin_assign_station_manager`; reload after each success; show the friendly database error text (for example "no user found with email …") in the panel; buttons disabled while pending.
- [ ] Step 5: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] Step 6: Commit `feat(admin): Station managers tab`.

### Task 5: Only SQL can make an admin

**Files:** Create `supabase/lock-admin-flag.sql` (idempotent), `supabase/verify-lock-admin-flag.sql`; modify `src/components/admin/UserEditorModal.tsx` (remove the admin switch, the `isAdmin` state and `p_is_admin`; show "Admin" as a read-only badge when the profile is an admin).

- [ ] Step 1: Write the migration: `create or replace function protect_profile_admin_flag()` that reverts `is_admin` to its old value (or false on insert) whenever `auth.role() is not null`, with no `app.admin_action` allowance; `create or replace function admin_update_profile(...)` with the identical signature and admin check but no `is_admin` assignment (keep `p_is_admin` as an ignored parameter so older app builds do not error).
- [ ] Step 2: Write the smoke test as one `begin; ... rollback;` block with the migration text inside, then checks (claims must include `'role','authenticated'` so `auth.role()` is set): (a) as the admin, `admin_update_profile(other_user, p_is_admin => true)` leaves that user's `is_admin` false; (b) an authenticated user updating their own row cannot set `is_admin`; (c) with no claims (direct SQL) setting `is_admin` still works, proving SQL remains the only way; (d) the admin's other profile edits (for example `p_name`) still apply. Print PASS/FAIL per check.
- [ ] Step 3: Run the smoke test against production (rolled back). Expected: all PASS; confirm nothing persisted. **Ask the user before applying the migration for real.**
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] Step 5: Commit `feat(admin): only SQL can make an admin`.

### Task 6: Docs and final check

- [ ] Step 1: `README.md`: replace the `?admin=1` / `?manager=1` / `?moderation=1` descriptions with the two entrances and who may use each; update test counts.
- [ ] Step 2: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] Step 3: Commit `docs: admin and station-manager entrances`.
- [ ] Step 4: Tell the user the order for production: apply `lock-admin-flag.sql` (after their yes), then deploy. The routes work without the migration; the migration only tightens the admin flag.
