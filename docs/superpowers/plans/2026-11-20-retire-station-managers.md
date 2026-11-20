# Retire the station manager, stage 3 — plan

**Goal:** There is no station manager role any more. Community managers (stage 1) post gas status from the normal driver app; the admin is the only back-office user. (Decision: user, 2026-11-20: "retire station manager".)

## Remove from the app
- The `/station-manager` page and everything only it used: `StationManagerEntrance`, `MyStationsPanel`, `StationQuickUpdate`, `ManagerSignIn`, `ManagerProfilePanel`, `SetPasswordCard`, `CodeSignIn` (+ `codeSignInState`), `StationManagersPanel`; the manager password/profile helpers (`passwordRules`, `passwordPrompt`, `contactDetails`, `managerPostForm`, `expectedBack`, `managerLanding`, `stationManagerGroups`); `managerAccessService`, the manager parts of `stationManagerService`; the WhatsApp manager share; `saveContactDetails` in `AuthContext`.
- The invite email function `api/invite-manager.ts` (+ tests) and its settings in the docs.
- The admin dashboard's **Station managers** tab, the **Station manager** badge in Users, and the manager-assignment section of the station editor.
- `/station-manager` and the old `?manager=1` link: `/station-manager` redirects to the home page.

## Keep (still used by community posts)
`managerState.ts` (the "Community manager says" line and its states), `StationSaysLine`, `stationManagerSignals` (pressure display), `RpcClient` (moved to `src/services/rpcClient.ts`), `PasswordSignInForm`/`AdminAuthGate` (the admin still signs in with a password), the `station_manager_posts` log table (community posts use it).

## Database (applied at deploy, after approval)
- Revoke execute from signed-in users on the manager-only functions: `manager_post_state`, `manager_post_pressure`, `manager_post_selling`, `my_managed_stations`, `claim_station_manager_invites`, `admin_invite_station_manager`, `admin_cancel_station_manager_invite`, `admin_assign_station_manager`, `admin_remove_station_manager`. Reversible with `grant execute … to authenticated`.
- **Nothing is dropped or deleted**: the tables `station_managers` (1 test assignment) and `station_manager_invites`, and all their rows, stay until the user decides.

## Tasks
1. Delete the dead files and fix imports (move `RpcClient`; trim `AdminAuthGate`, `AdminScreen`, `UsersPanel`, `UsersDirectory`, `FullStationEditorModal`, `adminRoutes`, `App.tsx`, `AuthContext`, `shareMessageBuilder`, api guard test).
2. Redirect `/station-manager` in `vercel.json`.
3. Migration `supabase/retire-station-managers.sql` + verify script.
4. README and `.env.example`; full tests/types/build; whole-branch review.

## Constraints
- Never touch the user's main checkout. Work in this worktree on `feat/retire-station-managers` (based on `feat/push-status-change`, so both merge in order).
- Do not delete or alter data. The community manager posting path, pushes, and the admin dashboard must keep working.
