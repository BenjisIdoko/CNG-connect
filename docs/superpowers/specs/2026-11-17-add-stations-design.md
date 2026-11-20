# Add new stations: design

Status: draft for approval, 2026-11-17. Nothing is built yet. (The station-manager updates feature is
paused; its spec and plan stay as they are.)

## Intent and why

A station can only be added by editing the database today. The 104 stations come from the Presidential
CNG Initiative registry, and real stations open that it does not list. Admins need to add a station
themselves, one at a time. Drivers can already send a "Suggest station" form, but nobody can see or act
on it (one is pending in production), and it carries no map position.

**Admin adding a station directly is the main feature and is built first.** Reviewing driver suggestions
comes second and reuses the same station-creating step.

## Goals

- **Phase 1 (priority):** an admin adds a station from the admin dashboard in one short form and it
  appears on the map for drivers, with a correct position.
- **Phase 2:** an admin sees pending driver suggestions, approves one (which creates the station through
  the same path) or rejects it.
- Few duplicates: the admin is warned about a similar station nearby, and an identical name is refused.

## Non-goals

- Adding many stations at once (CSV). Possible later.
- Station managers or drivers creating stations directly.
- Driver GPS on suggestions ("I'm at the station"). Possible later; for now the admin sets the position.
- Notifying a driver when their suggestion is approved or rejected.
- EV charging stations (EV is switched off in the app; the database function still accepts the type).

## Anti-goals (a failure even if it technically works)

- A station that appears at a wrong or blank map position.
- A new station that silently never shows up (see the name rule below).
- Anyone other than an admin creating a station, or one suggestion creating two stations.

## Constraints

- The `stations` table has no insert rule for the app, so creation must be an admin-only server function
  (the same pattern as `admin_update_station`, `admin_set_station_pin`).
- The app drops any station whose name, lower-cased with punctuation removed, equals an earlier one
  (`deduplicateStations`). A new station with such a name would never be shown, so the function must
  refuse it rather than save a ghost.
- Positions must be inside Nigeria (lat 4 to 14, lng 2.5 to 15), with an accuracy tier
  (`source_exact`, `rooftop`, `street`, `area`, `city`) as the existing pin editor does.
- The Google Maps key may be missing in some environments; the paste-a-link or paste-coordinates path
  must work without it.
- Drivers' phones cache the station list and refresh it on the next fetch, so a new station can take a
  moment to appear.

## Approaches considered

1. **One admin-only database function that creates a station (chosen).** The admin form and, in phase 2,
   approving a suggestion both call it.
2. Adding stations through the CSV upload. Good for bulk; clumsy for one; kept as a possible later extra.
3. Inserting straight from the browser with a new open write rule. Leaves id creation and checks to the
   browser; rejected.

## Decisions made together

- Admins add directly; drivers suggest too; admin adding is the more important feature.
- One at a time for now.
- Phase 2 suggestions: the admin sets the position at review time (driver GPS later).

## Calls I made (please check these)

- **Form:** "Add station" button in the Stations panel opens a short form: name, operator, address, city,
  state (required except operator), station type (CNG, since EV is off), and a **required** map position
  with its accuracy tier (default `rooftop`). The position is placed on the map or pasted from a Google
  Maps link or "lat, lng", reusing the existing pin editor's code.
- **After saving,** the new station opens in the existing full editor for price, hours, photos and phone.
- **New station defaults:** status "No recent reports", not Pi-CNG accredited, data source "Admin added"
  with today's date, `created_by` set to the admin, id like `admin-nipco-ikeja-x7k2q9`.
- **Duplicates:** the server refuses a name that matches an existing one after case and punctuation are
  ignored. The form also warns (but allows "Add anyway") about stations within 300 m or with a similar name,
  listed by name and distance.
- **Phase 2 screen:** a "Suggestions" tab with a pending count. Each card shows the driver's details and
  photo and any similar stations nearby. "Approve" opens the add form prefilled with the suggestion; saving
  creates the station and marks the suggestion approved in the same step. "Reject" marks it rejected.
- **Order of work:** phase 1 is built and can ship on its own before phase 2 starts.

## What the admin sees

```
Stations                         [ Add station ]
┌─ Add station ────────────────────────────┐
│ Name*  [ NIPCO CNG · Ikeja            ]  │
│ Operator [ NIPCO ]   Type [ CNG ]        │
│ Address* [ Adeola Odeku St...         ]  │
│ City* [ Ikeja ]  State* [ Lagos ▾ ]      │
│ Position*  [ map pin / paste link ]      │
│ Accuracy   [ Rooftop (±30 m) ▾ ]         │
│ ⚠ Similar: "NIPCO Ikeja" · 120 m away    │
│            [ Cancel ]  [ Add station ]   │
└──────────────────────────────────────────┘
```

## Left to the builder

- Whether to extract the map and paste-link logic from `PinReviewModal` into a shared position picker used
  by both the review and add screens (preferred) or to copy a minimal version.
- Exact column list, id slug rules, error wording, and the migration file name.
- Phase 2: how admins read `station_suggestions` (check its row-level security), and the function that marks
  a suggestion approved or rejected in the same transaction as the station is created.
- Tests: the function refusing non-admins, positions outside Nigeria, and duplicate names; the duplicate
  warning (distance and name similarity); and an end-to-end check that a new station appears in the app's
  station list.
