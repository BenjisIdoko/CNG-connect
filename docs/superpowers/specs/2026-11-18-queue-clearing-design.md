# Queue clearing: design (revised 2026-11-18)

Status: draft for approval. Nothing is built yet. (The station-manager feature stays paused.)
Revised after the owner's note: "the status changes when there is no car available at the geofence".

## Intent and why

A driver reports "Queuing", gets gas and leaves, and nobody updates it. The station keeps saying "Queuing"
for up to 24 hours, because every report counts as current for 24 hours. The live app showed stations as
"Queuing · 6 hr ago", "7 hr ago", "2 hr ago" at the same moment, and one of them was recommended as "Best
option now". A queue is cars standing at a station, so when no car is at the station any more, the queue
status should stop being shown as current.

## Goals

- **A queue status stays current only while there is evidence of a car at the station.** The evidence is a
  fresh report, or a driver whose phone says they are at the station's geofence right now.
- When neither holds, the station shows grey: "Last: Queuing · 6 hr ago", like any old report today. It never
  turns into "Available" by itself.
- The line "1 car here - queuing" becomes true: it counts cars at the geofence, not people who opened the page.
- The driver who reported the queue can say what happened when they leave (one tap), which is the only way a
  station becomes "Available" or "Out of gas" again.

## Non-goals

- Tracking drivers in the background. A phone web app cannot, so only drivers with the app open and location
  allowed count as "a car here".
- Guessing that a queue cleared, or marking a station Available because nobody is there.
- Points or reputation for these answers.
- Changing how "Available" and "Out of gas" age (24 hours stays).

## Anti-goals (a failure even if it technically works)

- Showing "Available" because no car is present. Absence of data is not an empty queue.
- Letting the public read who is at which station. The count must be public; the people must not.
- Nagging: more than one prompt per queue report, or a prompt while the driver is still at the station.

## Constraints

- Only drivers running the app with location on are visible. A real queue with no app user at it will fade
  to "last known" after the grace period. That is honest, but it means "last known" is common.
- GPS jitters by tens of metres, so "at the station" needs a margin and a short expiry.
- The table `station_presence` (station, user, last ping, expiry) exists, but today it is written only when a
  driver opens a station's page, with a 20-minute expiry, and its rows are publicly readable (the user ids in
  it are account ids, not emails or phones).
- The freshness rules live in `src/utils/stationFreshness.ts` and are shared with the public API (on
  `feat/public-api`), which would need the presence counts too once that branch is merged.
- Storage or location can be unavailable; then the rules fall back to the grace period alone.

## Approaches considered

1. Early expiry only (2 hours). Simple, but ignores the owner's point: a queue that is still there would
   vanish and an empty one would linger until the timer ends.
2. Leave prompt only. Live, but only when the reporter's app is open.
3. **Presence at the geofence (chosen after the owner's note), plus the leave prompt.** The status follows
   the cars that are actually at the station, with a short grace so a fresh report is never hidden.

## Decisions made together

- Both an automatic rule and a prompt (option 3 of the earlier choice), now with the automatic rule driven
  by cars at the geofence.
- "1 car here" means a car at the geofence.

## Calls I made (please check these)

- **"At the station" = within 250 m**, seen on the driver's GPS while the app is open. The app records it
  automatically (no need to open the station page): a presence ping every 2 minutes while inside the
  geofence, expiring **6 minutes** after the last ping, so a driver who leaves or closes the app drops out
  within minutes.
- **Queue rule:** a Queuing report is current when it is **under 30 minutes old** (grace, so a fresh report
  is shown even if nobody's phone is there) **or** at least one car is at the geofence now. Either way it
  stops being current **3 hours** after the report, however many cars are there (someone refuelling is not
  proof the queue is still the one reported). After that it is last-known.
- **What drivers see when it stops being current:** grey "Last: Queuing · 6 hr ago", the same as any stale
  report, and the station drops out of "Best option now".
- **"N cars here - queuing"** uses the live car count. It shows only while the status is current Queuing; with
  cars but no queue it shows "N cars here".
- **Counts only, no names:** a small database function returns the number of cars per station, and the public
  can no longer read the presence rows themselves. (They show which account was at which station and when.
  Automatic pings would make that a continuous trail, so I'd close it as part of this.)
- **Leave prompt** (kept from the earlier design): the driver who reported Queuing in the last 3 hours and is
  now more than 250 m away is asked once, "Left {station}? Is the queue still there?", with **Queue cleared**
  (posts Available), **Still queuing** (posts Queuing again), **Out of gas**, and **Not sure** (posts nothing).
  No points. It appears only while their app is open, or when they reopen it within the 3 hours.
- Cars counted are the **other** drivers too, not only the reporter: any app user inside the geofence keeps
  the queue current.

## What the driver sees

```
Portland Gas - Kubwa
● 1 car here - queuing            (a car is at the geofence now)

Portland Gas - Kubwa              (nobody there, report older than 30 min)
🕘 Last: Queuing · 6 hr ago       (grey, not recommended as best option)
```

## Left to the builder

- Exact names and layout. Suggested: pure functions in `stationFreshness.ts` for the queue rule (inputs: the
  newest report, the car count and now), a pure `queueWatch.ts` for the leave prompt, a small migration for
  the counts function and the policy change, and a `'left'` variant of `ProximityAlertBanner`.
- Where the GPS handler in `App.tsx` pings presence, and how it avoids hammering the database (every 2 minutes
  per station while inside the geofence, not on every GPS fix).
- How the station list loads car counts for all stations in one query.
- Tests: the queue rule (under 30 minutes; over 30 minutes with 0 and with 1+ cars; at 3 hours with cars;
  non-queue reports keeping 24 hours; newest-report-wins unchanged); the leave watch (inside 250 m: no
  prompt; outside: one prompt; expired; a newer report clears it; storage failure); and the counts function
  never returning user ids.
