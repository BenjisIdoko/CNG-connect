# Admin and station-manager entrances: design

Status: approved by the user ("approved, write the plan"), 2026-11-18.

## Intent and why

The app has one hidden dashboard behind `?admin=1`, `?manager=1` and `?moderation=1`, shared by everyone
with any admin-side access. The owner wants two clearly separate roles with their own entrances:

- **Super admin** (the only profile with `is_admin`, today the owner): manages the whole application.
- **Station manager**: manages only the stations an admin assigned to them.

Production has exactly one admin and no station managers assigned yet, so no migration of people is needed.

## Goals

- `cngconnect.com.ng/admin`: the super admin's dashboard (Stations, Suggestions, Report moderation, Users,
  and a new **Station managers** tab). Nobody else can use it.
- `cngconnect.com.ng/station-manager`: the manager's page, "My stations" only.
- A signed-in person at the wrong entrance is told it is not for them and given a link to the right one.
- The super admin can see every manager and their stations, add a manager by email to a station, and
  remove one, in one place.
- Only the super admin can ever make another admin, and not from inside the app at all.
- Old links keep working: `?admin=1` and `?moderation=1` open `/admin`; `?manager=1` opens `/station-manager`.

## Non-goals

- A third "regular admin" role, or an in-app way to add more super admins (new ones are made by SQL).
- Any change to what managers can do on a station (selling status, pressure, details editor stay as built).
- Changing driver-facing screens.

## Anti-goals

- Hiding a link and calling it security. The database already refuses non-admin and non-assigned callers;
  the separate URLs are the clean front door, not the lock.
- Any path in the app or the API that lets a non-SQL caller change `profiles.is_admin`.
- An admin being shown "no access" while their profile is still loading.

## Approaches considered

1. **Path-based routes on the same site, one app (chosen).** `/admin` and `/station-manager` read from the
   URL; Vercel serves the app for both paths. Cheapest, shares auth and components, installed phones keep
   working.
2. Separate subdomains (`admin.cngconnect.com.ng`). Cleaner on paper, but a second deployment and DNS to
   maintain for a solo project.
3. Keep query strings and only change the sidebar. Does not give the separate addresses the owner asked for.

## Calls I made (the user can correct)

- "Add new admins" means adding **station managers**. A new super admin is added by SQL, as the first was.
- The manager page lives at `/station-manager`, not under `/admin`, so the two entrances never share a path.
- "My stations" moves out of the admin sidebar; the super admin edits any station through Stations.
- The Users tab loses its "make admin" switch, and the database ignores any attempt to change `is_admin`
  from the app (the existing trigger is tightened so no function can bypass it).
- Legacy query links forward to the new path without a page reload.

## Left to the builder

Exact copy on the "not for you" screens, how to tell "profile still loading" from "not an admin" with what
the auth context exposes, and the layout of the Station managers tab.
