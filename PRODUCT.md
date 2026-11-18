# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Drivers (the public app):** Nigerian CNG vehicle drivers, mostly on phones, standing at or driving to a station. They see live station status, report availability and queues, and read community posts. Not the subject of this record's admin work.
- **The super admin (the one profile with `is_admin`, today the app owner), at `/admin`:** runs the whole application alone, mostly from a laptop and occasionally from a phone. Jobs: review flagged driver reports, add and fix stations (names, details, photos, map pins, driver suggestions), manage station managers, see what needs attention.
- **Station managers, at `/station-manager`:** a driver an admin assigned to specific stations. They post "Selling now / Not selling" and pump pressure and edit only their own stations' details. They share the admin dashboard's shell and sign-in.

## Product Purpose

CNG-Connect is a crowd-sourced live status map of CNG stations in Nigeria (React PWA on Supabase, live at cngconnect.com.ng). Drivers' reports last 45 minutes; a station shows only its newest report. The admin dashboard exists so one person can keep the data trustworthy: correct stations, moderate reports, and control who may speak for a station.

## Capabilities and Constraints

- Admin tabs today: Stations (pin editor, full station editor, CSV bulk edit, bulk delete, add station), Suggestions (driver-suggested stations to approve or reject), Report moderation (flagged reports, photos), Users, Station managers. Sidebar shell: `AdminSidebarLayout` (dark sidebar on desktop, drawer on phones). Station manager page: "My stations" with a quick card (selling status, pressure) and the details editor.
- New in this redesign: an **Overview** home screen showing what needs attention (pending suggestions, flagged reports, stations needing a pin review) and counts. Its exact contents are not decided yet.
- Only the super admin can use `/admin`; only an assigned manager can use `/station-manager`. The database enforces this; the admin flag can only be changed by SQL.
- Stack: Tailwind v4, React 19, Vite. The user approved adding **shadcn/ui** (Radix, class-variance-authority, tailwind-merge, clsx, `components/ui`, CSS variables) for the admin dashboard only, loaded lazily so the driver app is untouched.
- The admin and manager screens must keep every current function; this is a redesign of the look and structure, not a feature cut.
- Terminology: "station manager", "super admin", "report moderation", "suggestions", "pin review".
- No referral or airtime promos anywhere (a standing product decision).

## Evidence on Hand

- A live production database (about 100 stations, about 160 profiles, one admin, no station managers assigned yet) and the existing admin code under `src/components/admin/`. No analytics or usage data about the admin screens exists; do not invent metrics or "trends".

## Product Principles

- Trustworthy data over speed of data entry: the admin's work is correcting and verifying, so every destructive action is explicit and reversible where possible.
- One person, many small jobs: the dashboard optimises for getting through a queue quickly (flagged reports, suggestions, pin reviews), not for browsing.
- The admin and manager entrances stay separate; the shared shell must never suggest a manager can reach admin tools.
- Laptop first, but never broken on a phone.

## Accessibility & Inclusion

- Keyboard and screen-reader operable dashboard (labelled controls, focus visible, dialogs that trap and restore focus); text contrast at WCAG AA. The owner works in Nigeria, often on mid-range devices and variable networks, so the dashboard should stay light.
