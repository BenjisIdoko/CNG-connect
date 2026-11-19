# Station manager access and three-state status: design

Status: choices confirmed by the user in chat (Option A, "they have email"); build plan awaiting approval. 2026-11-19.

## Intent and why

Most drivers are cab drivers covering 100 to 200 km a day, so they need CNG daily. Stations are often closed or
waiting for supply, and today they call regulars on WhatsApp. The owner wants station managers to tell drivers
inside the app, on the station page, "open for business and gas available". There is no push notification: the
status simply shows on the station page. Two things must change:

1. A manager must **not need a CNG-Connect (driver) account**. Today the admin can only add a manager whose email
   already signed up in the driver app.
2. The manager's status needs the three situations stations really have.

## Goals

- The admin adds a manager by email and station. The manager opens `/station-manager`, enters their email, gets
  a 6-digit code by email, and is in. No driver sign-up, no password.
- A manager taps one of: **Closed**, **Open, waiting for gas**, **Open, gas available**.
- Drivers see it on the station page ("Open for business · Gas available · updated 20 min ago") and as a small
  badge on list rows. It stays visible for 6 hours and always shows its age.
- The admin sees pending invites ("invited, hasn't signed in yet") and can cancel them; manager accounts are
  labelled in the Users directory so they do not look like drivers.

## Non-goals

- Push notifications, a follow button, location-based alerts, or any server keys (explicitly not wanted).
- Passwords for managers, or an admin-created login (that was Option B, not chosen).
- Any change to driver-reported statuses, pin colours, ranking, points or flags (manager status stays separate).
- Estimated-time-of-supply fields (not requested; can come later).

## Anti-goals

- Anyone becoming a manager without the admin inviting their email.
- An invite for one email being claimable by another person (the email must be the verified one on the login).
- A stale "gas available" misleading drivers: the age is always shown and it fades after 6 hours.

## Approaches considered

1. **Invite by email, claim on first code sign-in (chosen).** Uses the email-code login the app already has; no new
   keys or services; the invite is stored until the person signs in, then becomes an assignment.
2. Admin creates a login with a temporary password. Works without email but needs a private Supabase key in
   Vercel and hands out passwords. Not chosen because managers have email.
3. A shared station PIN with no real account. Weakest security (the database cannot tell who is posting).

## Calls I made (the user can correct)

- A manager status shows for **6 hours** (was 2). Named constant, easy to change.
- Old phones: the older "selling" field is kept in step (Open, gas available = selling; the other two = not
  selling) so phones that have not updated still show something sensible.
- Manager accounts exist in the database like any account (unavoidable) but appear with no name; the Users
  directory marks them "Station manager".
- The code email relies on the existing driver sign-in email setup (Resend); nothing new to configure.

## Left to the builder

Exact copy, the invite table's column names, and how the sign-in screen's two steps (email, then code) are laid out.
