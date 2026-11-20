# Station manager signals: design

Status: approved by the user ("build natively"), 2026-11-18. Replaces
`2026-11-17-station-manager-updates-design.md` (kept in the main checkout, now superseded).

## Intent and why

A station's staff know what drivers cannot: that the gas truck has arrived, that selling has started,
and the pump pressure. A manager post is **not** a driver report. It says "we are open and selling" (or
"not selling") and gives the pressure. Drivers still decide availability and queue themselves.

## Goals

- An assigned manager posts **Selling now / Not selling** in one tap and **pressure in bar** in a few
  taps, from a phone, on the existing "My stations" page.
- Drivers see it as a separate line ("Station says: Selling now · updated 20 min ago · 220 bar") on the
  station page and a small badge on list rows.
- Only managers an admin assigned to a station can post for it. Admins can use the page for stations
  they are assigned to.

## Non-goals

- Changing the map pin colour, "best option" ranking, driver status, the Reports tab, driver points or
  flags. A manager post never touches any of them.
- Price, queue length, or any other manager field. Editing hours, photos and contact stays in the
  existing details editor.
- The public API (unchanged).

## Anti-goals

- A station post hiding or overriding a driver's "Out of gas" or "Queuing".
- Anyone other than the station's own manager being able to post for it.
- A post that earns points or reputation.

## Approaches considered

1. **Columns on the station row plus an append-only log (chosen).** The post is a station-level fact
   with a timestamp. The log keeps every post so a false claim can be reviewed. No report rows, so
   nothing in the driver-report code changes.
2. A station post stored as a report row (the earlier design). Rejected once the user clarified that
   manager posts are a different kind of signal: it would need a forgery guard, new freshness rules and a
   points exemption, for no benefit.
3. A separate table read by the app. More moving parts than a few columns.

## Calls I made (the user can correct)

- A "Selling now" or "Not selling" post shows with its age for **2 hours**, then disappears.
  A newer post replaces an older one. Named constant `SELLING_STATEMENT_MINUTES = 120`.
- A pressure reading shows for **12 hours** with its age ("220 bar · updated 2 hr ago"); after that the
  admin's fixed `pump_pressure` shows with no age (today's behaviour).
- Pressure is a whole number from **10 to 300 bar**, stepper in steps of **5**, starting at the last
  reading, else the admin's value, else 200.
- Posting is allowed only for stations the caller is assigned to (`station_managers`); no blanket admin
  access. The functions are `security definer` and return a friendly refusal otherwise.
- Posts are stamped by the server clock (`now()`), never the phone's.

## What drivers and managers see

```
Manager (My stations)             Driver (station page)
NIPCO · Jahi                      Driver reports: Queuing · 12 min ago
Station:  [Selling now][Not selling]   Station says: ● Selling now · updated 20 min ago · 220 bar
  Posted 20 min ago · shows 2 h
Pressure: [–] 220 bar [+]  [Update]
  updated 3 hr ago
```

## Left to the builder

Column and index details, the exact copy on the badge, and where on the station page the line sits.
