# Photo proof for reports, and nothing stale after 24 hours: design

Status: draft for approval, 2026-11-18. Nothing is built yet. (The station-manager feature stays paused.)

## Intent and why

Two rules from the owner:

1. **Nothing stale.** After 24 hours a station report is gone: no "Last: Available · 5 wks ago", no old
   reports in the station's list. A station with no report in the last 24 hours says "No report yet".
2. **Proof for every status.** Today a report can be a single tap with no photo, from anywhere within 800 m
   (the sheet's text says 150 m). The owner wants each status backed by a photo taken at the station:
   - **Available:** a photo of the pump meter.
   - **Queuing:** a photo of the queue, taken from the station's geofence.
   - **Out of gas:** a photo that shows it.

The point is that a status can be trusted because someone was there and showed it.

## Goals

- A report cannot be posted without a live photo taken within 150 m of the station, in the app or by any
  other route (the database refuses it too).
- After 24 hours a status and its report disappear from every screen. The data stays stored.
- The one-tap prompts cannot sidestep the photo rule.

## Non-goals

- Checking what the photo shows (a meter, a queue) automatically. People and the existing flag flow judge that.
- Deleting reports or photos from the database.
- Gallery photos. The camera in the app is the only source.
- Changing the 250 m "car here" geofence for the queue status (a different purpose from the 150 m photo
  rule).
- Reports from guests (still signed-in drivers only).

## Anti-goals (a failure even if it technically works)

- Any path that posts a status without a photo: the report sheet, the arrival and follow-up prompts, an old
  app version, or a direct call.
- A photo taken somewhere else being accepted because the app only checked once.
- An old status coming back on screen after 24 hours through a side screen (search, Community, share text).

## Constraints

- The camera needs the driver's permission and a good GPS fix (accuracy 100 m or better). Without either they
  cannot report, and the sheet must say why.
- The database cannot see the phone's GPS, only the position the app sends with the photo, so it checks that
  the sent position is within 150 m of the station. It stops casual bypasses, not a determined forger.
- Old installed app versions do not send the new fields. If the database rule starts first they would
  silently fail to post, so the rule is switched on **after** the new app is live.
- The existing "queue current while a car is here" rule and the per-report flagging stay as they are.

## Approaches considered

1. **App and database enforce it (chosen).** The app makes the photo and position mandatory; a database
   trigger refuses a new report that lacks a photo or a position within 150 m of the station.
2. App only. Faster, but a modified app or direct call could skip the proof.
3. Allow gallery photos too. Easier for drivers, but the owner's point is proof from the station.

## Decisions made together

- Hide after 24 hours everywhere and keep the data.
- Live camera only, within 150 m, enforced by the app and the database.
- The arrival and follow-up prompts open the report sheet; the "Left the station?" prompt is removed (a queue
  already goes grey on its own when no car is at the station).

## Calls I made (please check these)

- **24 hours:** past 24 hours a station has no status of any kind (the freshness rule returns "none", so
  every screen that reads it shows "No report yet"), and the Reports tab on a station lists only reports from
  the last 24 hours. A Queuing report between 30 minutes and 24 hours with nobody there still shows grey
  "Last: Queuing · 6 hr ago" (the approved queue rule); after 24 hours that goes too.
- **One photo is required per report** (the report holds a single photo). "Pics" for a queue is one photo for
  now; say if you want several.
- **Guidance in the sheet** when a status is chosen: Available "Photograph the pump meter", Queuing
  "Photograph the queue", Out of gas "Photograph the pump showing it's out".
- **Position proof:** the app records the phone's position when the photo is taken and sends it with the
  report. If the fix is poorer than 100 m, or the driver is more than 150 m away, the camera button explains
  why and posting stays disabled. The check runs again when the report is submitted.
- **The sheet's text** ("Reports unlock within 150 m") becomes true; the 800 m check goes. Drivers who used to
  report from 800 m must now be close.
- **Points:** every report now has a photo, so each earns the photo rate (100). The "+50 pts" and "live photo
  earns 100" copy is updated.
- **The arrival and follow-up prompts** open the report sheet with the tapped status chosen; the photo step is
  required there like any report. The "Left the station?" prompt, its phone storage and its two analytics
  events are removed.
- **Database rule:** new reports from signed-in users must have a photo and a position within 150 m of the
  station (two new columns, `photo_lat` and `photo_lng`). Admin or SQL-editor inserts are not blocked, and
  existing reports are untouched. It is applied after the new app has been live for a while.

## What the driver sees

```
How's the pump now?
 ( ) Available    Photograph the pump meter
 ( ) Queuing      Photograph the queue
 ( ) Out of gas   Photograph the pump showing it's out
 [ Take photo ]   (disabled until within 150 m, with the reason)
 [ Submit report +100 pts ]   (disabled until a photo is taken)
```

## Left to the builder

- File layout. Suggested: pure functions in `geofencePresence.ts` (or a sibling) for the 150 m report check,
  the freshness change in `stationFreshness.ts`, a `photo`/position pair carried through `DriverReport`, the
  sheet in `ReportStatusModal.tsx`, the prompts in `ProximityAlertBanner.tsx` and `App.tsx`, and a migration
  with a smoke test.
- How the sheet is opened from a prompt with a status already chosen.
- Tests: freshness returns "none" past 24 hours and the lists hide old reports; the 150 m and 100 m accuracy
  rules; a report without a photo or position is refused; the database trigger (own smoke test); removal of
  the leave prompt leaves no dead references.
