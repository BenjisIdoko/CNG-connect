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

OWN-WORLD: Sypher Clean (replaced the original banknote security print; see DESIGN.md). Soft sage canvas (#eef2ee); crisp white (#ffffff) sidebar, header bar and cards separated by 1px hairlines (#e3e9e5); charcoal ink (#111814); leaf green (#15803d) for active and selected state; mint (#86efac) with ink text only for the one primary thing to press; pale yellow (#fef9c3) for new/changed rows; emerald and lime as data colors; Geist for UI, Geist Mono for ids and key figures; 6px controls, 12px cards, shadows no heavier than a whisper at rest.

STORY: The owner opens /admin and sees at once what needs a decision, works the ranked queue top to bottom, and watches the thread close. Every other area (stations, managers, users) is a plain, fast table with the same rules and controls.

FIRST VIEWPORT: 1440x900. Left: 256px white sidebar (brand, nav items with pending counts, signed-in email and sign out at the foot). Right: page header (title; no global search, the Stations and Users tabs have their own) over the thread: a full-width strip of notches grouped by type with counts, then a ranked work queue table (left, ~70%) and a counts column (right, ~30%: stations, users, managers, pin reviews).

FORM: Operate dashboard, originally a banknote security-print world (seed:d25f5af4ff183ec9), now Sypher Clean. Raised: flags and suggestions that arrived since the owner last opened the Overview hold a pale yellow tint on the Overview (from Gate Board); pin reviews have no arrival time so are never tinted; mint appears only on the primary pressable thing (from Warm Consumer Cards).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
