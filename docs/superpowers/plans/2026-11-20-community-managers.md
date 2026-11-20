# Community managers, stage 1 — plan

**Goal:** Ordinary driver accounts marked as *community managers* can post **Gas available / Gas not available** for a station from the normal driver app. No separate dashboard. (Stage 2 = real push notifications; stage 3 = retire the station-manager dashboard. Not in this plan.)

**Decisions (user: "no station staff, only community managers", "go ahead with 1 first"; the rest are my calls from the earlier proposal, to be confirmed):**
- A community manager must be **within 150 m** of the station (checked on the phone and again by the database). No photo required (trusted role); easy to add later.
- The post shows on the station page and list as a **separate "Community manager says" line**, never changing pins, ranking, points or flags.
- *Gas available* lasts **6 hours**; *Gas not available* stays until someone posts again, shown greyed as "last said" after 6 hours, gone after 24 hours (reuses the existing last-said rule).
- The admin turns the role on or off per user in the Users page; community managers get a "Community manager" badge there. The role lives in its own table (`community_managers`), written only by an admin function, so no one can give it to themselves.
- The poster's name is not shown.

**Architecture:** reuse the existing `stations.manager_state*` columns and the "Station says" line: add a state `out` ("Gas not available"). New RPC `community_post_gas`, new table + admin RPC, a post card on the station page for community managers.

**Tests:** Vitest node env, `renderToStaticMarkup` component tests, pure helpers; no DOM library.

## Tasks
1. **DB** `supabase/community-managers.sql` + verify script: table `community_managers` (RLS: read own row, admins read all, no write policy), `admin_set_community_manager(uuid, boolean)`, `community_post_gas(text, boolean, double precision, double precision)` (role check, 150 m check, 2-minute duplicate guard, writes `manager_state` = `selling`/`out` with the legacy columns, logs to `station_manager_posts`), constraint allows `out`.
2. **State `out` in the app:** `ManagerState`, sentence "Gas not available", badge, last-said handling, `apiService` mapping; heading "Community manager says".
3. **Post card:** `communityPostService.ts` (+ friendly errors), `isCommunityManager` from `community_managers` in `AuthContext`, `CommunityGasPostCard` on the station page, wired in `App` (fresh GPS fix, local station update).
4. **Admin:** Users page loads community manager ids, shows the badge, the editor gets a switch calling the admin function.
5. **Docs and checks:** README, full tests/types/build, apply the migration, phone-size look, one whole-branch review.

## Constraints
- Never touch the user's main checkout (`feat/public-api`); work in this worktree on `feat/community-managers`.
- No referral/airtime wording. No change to `stations.status`, `station_reports`, points or flags.
- Old phones must keep working: the `stations` columns they read do not change.
