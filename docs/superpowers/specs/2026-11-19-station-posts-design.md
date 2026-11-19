# Station posts that say why and until when — design

Status: awaiting approval. Size: a small project (one SQL migration, four small UI changes, tests).

## Intent and the why

Most CNG-Connect drivers are cab drivers covering 100–200 km a day. They need gas daily, so they already have a reason to open the app. What loses them is a wasted trip to a station that is shut or waiting for a gas supply truck. Stations today phone their regulars on WhatsApp when supply arrives. We want station managers to use the app for this, and we want the app to tell a driver the reason and the expected time, so they can decide before they drive.

This slice (A) changes what drivers *see*. It adds no push notifications (that is slice B, designed separately).

## Goals

1. A manager's post can carry an optional reason and an expected time ("Waiting for supply · expected about 2 pm").
2. A station that is closed or waiting for gas is never mistaken for "Out of gas" or "No report yet" when its manager has said otherwise.
3. A station outside its opening hours says so ("Closed · opens 6 am") instead of "No report yet".
4. A manager can share their update to WhatsApp in one tap, pre-filled, so the regulars they already message get it from the app.

## Non-goals

- No push notifications and no server-side favourites (slice B).
- No new *driver-report* status. Drivers still report Available, Queuing or Out of gas. Adding a fourth would touch reports, pins, ranking, points and the database constraint.
- No change to pin colours, ranking, points or flags.
- No referral or airtime wording anywhere (standing rule: plain app link only).

## Anti-goals (would make this a failure even if it works)

- A manager post that quietly outlives the truth. An expired expected time must read as "not confirmed", never as still-true.
- Telling drivers a station is closed when it is only outside the hours someone typed in years ago. Hours only fill the gap when there is no report and no manager post, and they read as "usually", not as a fact.
- Reversing the 45-minute rule (see below).

## Constraints

- Reports older than 45 minutes are never shown, not even as "last known". This is a deliberate rule. **The grey "Last reported 3 hr ago" idea from earlier is NOT in this slice** because it reverses that rule. It can be added if you decide to change the rule.
- Manager status shows 6 hours today; pressure 12 hours.
- Existing phones keep working: old columns (`manager_selling`) stay in step; new fields are optional.
- `api/*.ts` functions import nothing relative (not touched here).
- Tap targets 44 px, 16 px field text on phones.

## Approaches considered

1. **Extra optional fields on the existing manager post (chosen).** `manager_state` keeps its three values; add `manager_state_reason` and `manager_state_until`. Smallest change, old phones unaffected, reuses the post log.
2. A fourth driver-report status "Closed / waiting". Rejected: touches reports, pins, ranking, points and the constraint, for a signal managers can already give.
3. Free-text note on posts. Rejected: unreviewed text shown to drivers, harder to scan, harder to translate into the one-line map badge.

## Design (decisions, mine unless marked)

**1. Reason and expected time (database + manager card)**
- `stations.manager_state_reason text` (check: null or one of `supply`, `fault`, `power`, `other`) and `stations.manager_state_until timestamptz` (null allowed). Same two columns in `station_manager_posts` for the log.
- `manager_post_state(p_station_id, p_state, p_reason default null, p_until default null)` keeps its checks (caller manages the station, state valid). Reason is allowed only with `closed` or `open`; `p_until` must be in the future and at most 24 h ahead, else it is stored as null. Posting `selling` clears both.
- Manager card: the three status buttons still post in one tap. Under them, for Closed / Open-waiting only, an optional row "Why?" (chips: Waiting for supply, Technical fault, No power, Other) and "Expected back" (chips: In 1 hour, In 2 hours, Later today… plus a time field). Tapping a chip updates the current post's details (the same RPC, same state). Nothing is required.
- Visibility: a post with an expected time stays visible until that time plus 1 hour (capped at 24 h from the post); without one it stays 6 hours, as now. After the expected time passes the line reads "Was expected back 2 pm · not confirmed".

**2. What drivers read**
- Station page "Station says" line: `Not selling · Waiting for supply · expected about 2 pm · updated 20 min ago`.
- Map/list badge: `Station: closed · back ~2 pm` / `Station: waiting for gas · ~2 pm`.
- Precedence for the chip shown when a station has no fresh driver report: fresh manager post → opening hours → "No report yet". A fresh driver report (under 45 min) still wins the chip; the manager line shows beside it as it does now.

**3. Opening hours as a fallback**
- Uses `opensAt`, `closesAt`, `is24Hours`, `hoursNote` already on each station. Time zone is fixed WAT (UTC+1).
- When there is no fresh report and no manager post: outside hours → grey "Closed · opens 6 am" (or "Opens tomorrow 6 am"); inside hours → "No report yet" unchanged. 24-hour or unknown hours → unchanged. `hoursNote` ("Closed Sundays") is shown if present. Copy says "Hours listed" so it is clear it is not a live report.
- Pins and ranking unchanged.

**4. Share to WhatsApp (manager card)**
- A "Share update on WhatsApp" button on the manager card, enabled when a post exists. Opens `https://wa.me/?text=…` with: station name, the manager's sentence, reason and expected time, the time it was posted, and the plain station link (`/?station=<id>`). Reuses `openWhatsAppShare`'s approach; no tracking beyond the existing `share_clicked`. No referral text.

## Left to the builder

- Exact chip labels and layout within the existing `StationQuickUpdate` card; time-field UX on phones.
- Test layout: unit tests for visibility/expiry and the hours fallback (including midnight-crossing hours and WAT conversion), RPC checks in a `verify-*.sql` like the other migrations, component tests for the manager card and the line.

## Rollout

- Migration `supabase/station-post-details.sql` (idempotent, with a verify script), applied before the app deploys. The new RPC arguments are optional, so the old app keeps posting fine.
- One build to `main` after you say "merge and deploy".

## Open question for you

Do you want the grey "last reported" line after all? It would change the 45-minute rule, so I have left it out.
