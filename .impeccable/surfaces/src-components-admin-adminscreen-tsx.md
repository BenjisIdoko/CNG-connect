---
version: 1
slug: "src-components-admin-adminscreen-tsx"
primary_target: "src/components/admin/AdminScreen.tsx"
related_targets: ["src/components/admin/StationManagerEntrance.tsx"]
---

# Admin dashboard (/admin, shared shell for /station-manager)

Mode: Operate. Visitor: the one super admin, laptop first, sometimes a phone; station managers see the same shell with only "My stations".
Job: keep the data trustworthy: clear flagged reports, review suggestions and pins, fix stations, manage station managers.
Constraints: keep every current function; shadcn/ui components (admin only, lazy-loaded); Tailwind v4; text contrast AA; light on mid-range devices.
Unresolved: exact Overview counts beyond pending suggestions, flagged reports, pin reviews, station/user/manager totals.

## Direction contract

THESIS: A security thread runs through the admin desk: every pending item (flagged report, suggestion, pin review) is one notch in it, and clearing the queue closes the thread. It refuses the category default of a grey sidebar over stat cards.

OWN-WORLD: Banknote security print. Deep note green (#0d3b2e) sidebar and thread ground; celadon paper (#e7f0ea) page; ink (#1a1f1c) text; foil gold (#c9a227) used only for things that can be pressed and for new/changed rows; hairline engraved rules (1px, tinted green) as dividers and table rules; Geist for UI, Geist Mono for ids and tabular numerals; 8px radius, no shadows heavier than a hairline.

STORY: The owner opens /admin and sees at once what needs a decision, works the ranked queue top to bottom, and watches the thread close. Every other area (stations, managers, users) is a plain, fast table with the same rules and controls.

FIRST VIEWPORT: 1440x900. Left: 240px deep-green sidebar (brand, five nav items with pending badges, signed-in email and sign out at the foot). Right: page header (title; no global search, the Stations and Users tabs have their own) over the thread: a full-width strip of notches grouped by type with counts, then a ranked work queue table (left, ~70%) and a counts column (right, ~30%: stations, users, managers, pin reviews).

FORM: Operate dashboard with a banknote security-print world; the assigned direction, roll position 3 of my grounded list, seed:d25f5af4ff183ec9. Raised: flags and suggestions that arrived since the owner last opened the Overview hold a gold tint on the Overview (from Gate Board); pin reviews have no arrival time so are never tinted; gold appears only on pressable things (from Warm Consumer Cards).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
