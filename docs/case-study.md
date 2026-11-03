# CNG-Connect: a live station map for Nigeria's CNG drivers

**Role:** Solo designer and developer · **Timeline:** Aug 2026 – present · **Live:** [cngconnect.com.ng](https://cngconnect.com.ng)
**Stack:** React 19, TypeScript, Vite, Tailwind v4, Supabase (Postgres, Auth, Storage), Vercel, PWA

> Before publishing: the market figures below came from a summary of Pi-CNG and ministry statements, not from primary documents. Link the original sources next to each number, or soften the wording to "reported". Fill in every `[bracketed]` item with your own numbers and screenshots.

---

## In one paragraph

Nigeria's switch to compressed natural gas is moving faster than the information drivers need to use it. A driver with a converted car has no reliable way to know which station has gas, how long the queue is, or whether the status they are looking at is from ten minutes ago or ten days ago. I built CNG-Connect, an installable web app that shows live, crowd-reported station status on a map, and that is honest about how old each report is.

## The market behind it

These are reported estimates, not audited counts. Official sources disagree slightly on what they include (cars only, all light vehicles, or trucks, buses and tricycles as well).

| Measure | Reported figure |
| --- | --- |
| CNG vehicles in 2023 | about 11,000 |
| CNG vehicles, late 2025 / early 2026 | more than 100,000 |
| CNG vehicles, October 2026 | about 120,000 |
| Government target | 1,000,000 vehicles (2027 in some statements, 2030 in others) |

Two things follow from those numbers.

1. **The fleet grew roughly eleven-fold in about three years.** Refuelling information has not kept pace with that growth.
2. **The target implies another eight-to-nine-fold increase.** Every 1% of today's fleet is about 1,200 drivers, so even a small share of drivers is a real user base, and the audience only grows if the target is met.

The people most exposed are commercial drivers on Bolt, Uber and inDrive. A wasted trip to an empty or queued station costs them income, not only time. The initiative also grants free conversions at accredited workshops, which creates a second need: finding a workshop and understanding whether the switch pays back.

## The problem

Three questions drivers could not answer from a phone:

- **Where is the nearest station that is actually dispensing?** Lists of stations exist. Their status does not.
- **Is what I'm looking at current?** A "full" tag from last week is worse than no tag, because it sends someone to an empty pump.
- **Is converting worth it for me?** The savings depend on mileage and fuel price, and nobody does that arithmetic for you.

## What I built

- **A live map** of 100+ stations with filters for availability (full, queuing, low pressure, out of gas), pump pressure and distance, plus one-tap directions in Google Maps, Apple Maps or Waze.
- **An answer first, not a list.** The phone sheet opens on a "Best option now" card, chosen by trading distance against report quality. Pins are sized and faded by how fresh their report is, and a station with no report shows a quiet grey tile instead of a confident one.
- **Drive mode.** One tap swaps the sheet for a large, dark panel built for a driver in a queue at night: the best station's name, status and age in big type, a thumb-height Go button, two alternatives, and the screen kept awake.
- **One-tap reporting.** A driver at the pump picks a status, optionally adds a wait time, a live camera photo and what they paid per kg in naira, and submits in a few seconds. The price then shows on the map, with its age.
- **A conversion-centre directory** of 451+ accredited workshops, filterable by state and local government area.
- **A savings and payback calculator** in naira and CO₂, with a toggle between the free grant and a privately funded kit.
- **A driver community**, passwordless sign-in, proximity alerts, and an AI guide for CNG questions.
- **An installable PWA** that caches map tiles and station data so it still works on a weak connection, in light and dark, following the phone's setting.
- **Internal tools**: an admin dashboard for correcting station pins and data, and a scoped station-manager role so a station operator can edit only their own station.

[Screenshot: map with the best-option card] · [Screenshot: drive mode] · [Screenshot: the same screen in dark] · [Screenshot: report flow] · [Screenshot: calculator]

## Decisions worth explaining

**1. Show how old a status is, and stop trusting old ones.**
Crowdsourced data goes stale silently. Every station now carries an age ("Available · 12 min ago"), and reports fall into tiers: fresh (up to 1 hour), recent (up to 24 hours) and stale (older than a day). A stale report keeps its last-known status in grey but no longer counts as the station's current state, and stations never reported show "No report yet". The tiers recompute every minute and when the tab becomes visible again, so a card that says "55 min ago" does not stay frozen after the hour passes. The same tiers now drive the map pins (a fresh report is a larger, solid pin; a stale or missing one is smaller and faded) and the list rows, so the whole screen tells one story about how much to trust each station.

**2. Make cheating hard on the server, not in the interface.**
Drivers earn points for reports (50 for a status, 100 with a live photo), which invites gaming. Points are awarded by a database function that checks the report and refuses to pay twice, rather than by the client. Other writes that need more than "any signed-in driver" go through the same kind of authorised function, and database row-level security enforces who can read and write what. Rate-limit triggers cap how fast one account can post reports, comments and suggestions.

**3. Close the leaks a security review found.**
Along the way I fixed a privilege-escalation path on the admin flag, stopped exposing driver contact details through a public view and then removed that view entirely in favour of a leaderboard function, and moved to an enforced content-security policy. That policy once blanked the map for returning users because the service worker's tile requests were not allowed. It is fixed, and a test now guards the policy.

**4. Accessibility as a requirement.**
An automated axe-core audit of every main screen drove a round of WCAG 2.2 AA fixes. Later passes made button names match their visible text ("Go" announces as "Go to Station Name, opens directions"), marked the active navigation item, put all map text on a type scale with nothing below 13px, raised touch targets to 40–44px, and made motion stop after three pulses and respect reduced-motion settings.

**5. Keep a 100-card list fast on a cheap phone.**
The desktop station list skips layout and paint for off-screen cards, which keeps scrolling smooth without virtualising the list.

**6. Answer the question instead of listing the data.**
A list of 100 stations, mostly with no report, makes the driver do the work. The "best option" is the station with the lowest cost, priced in kilometres: its distance, plus about 5 km for a queue, about 8 km for low pressure, and about 3 km if the report is over an hour old. A station with no usable report gets no recommendation at all, rather than a guess. Those weights are my judgement, kept in one place so they are easy to tune; they have not been tested against real drivers' trips, and I would not claim more for them than that. The empty state is honest too: with no live reports it says so, and says that a report has to be filed within about 800 m of the pump.

**7. A price is a report, and it ages like one.**
Price per kg is the other number a driver cares about before driving, but production had no prices at all. Rather than an admin-maintained field that would go stale and look current, the price rides on the driver's own report. It is shown with its age, hidden after a week, bounded to a plausible range in both the app and the database, and sent only when a driver typed one, so an app update could never break ordinary reports. I wrote the migration, applied it to production only after approval, and tested it with inserts that were rolled back.

**8. Dark mode by roles, not by inversion.**
The first dark mode only changed overlays, because the main screens were forced light, and when I opened the app on my own iPhone 11 it did not work. The real fix was a design-token job. One colour was doing two jobs (dark text on light screens, and a dark surface), so I split it into text, surface, selected-state and constant-ink roles, gave every token a dark value, and added a test that fails if a darkened token is not restored for the screens that stay light. Map tiles darken at phone widths only, because the desktop panels are still light.

## Results

- Live in production at a custom domain, deployed continuously from `main`.
- 161 automated tests across 27 files, plus a written 15-minute production smoke test.
- 222 commits in about eleven weeks (19 Aug to 3 Nov 2026), by one person.
- Traction: `[drivers signed up]` · `[reports submitted]` · `[weekly active users]` · `[stations with a report in the last hour]` · `[reports that include a price]`

I'd rather leave these five blank than guess. The most persuasive one for this project is the share of stations with a fresh report, because it measures whether the core promise holds. The price feature shipped with no data behind it: as of its release no station and no report had a price, so the map shows none until drivers add them. Whether they do is the thing to measure next.

## What went wrong, and what I learned

- **The database paused itself.** On the free Supabase plan the project paused after a quiet stretch and the whole app stopped. I restored it and now treat "is the backend awake?" as step one of every release check. For a product people rely on at a petrol pump, that is a reason to pay for an always-on plan.
- **Security is a series of small holes, not one big one.** None of the fixes were exotic, and each came from reading my own policies adversarially. I would run that review earlier next time, before launch rather than after.
- **Honest empty states beat confident wrong ones.** The most valuable change in the product was not a feature but saying "No report yet" instead of showing an optimistic green dot.
- **The interface misstated points in several places.** Buttons and banners said a report earned "+10 pts" or "+15 pts" while the server paid 50, or 100 with a photo. The server was right and the copy had drifted. I fixed every instance I found and now treat any number shown to a driver as something to check against the source.
- **A card that collapsed to nothing.** The new "best option" card rendered at zero height whenever the list was taller than the sheet, because a flex child with hidden overflow shrinks. I only found it by measuring the element in a browser, and it may have affected real drivers whenever a notice pushed the content down. The lesson was to measure, not eyeball, and to test with the awkward amount of content, not the tidy one.
- **I shipped a dark mode that did not work.** My first pass made overlays dark and left every main screen forced light. It looked acceptable in my browser checks and failed on my own iPhone 11. The lesson is that "dark mode" is a promise about the whole app, not a few overlays, and that the device I actually use is part of the test. Fixing it properly took a token redesign and it is now covered by a test, but I have still only seen the result in a desktop browser at phone size, not on a physical phone.
- **Asking before changing production.** The price feature needed a database change. I wrote it, explained the deploy-order risk, and applied it only after approval, then tested it with inserts that rolled back. It cost one extra round trip and removed the chance of rejecting every report.

## What's next

- Get the first real cohort of drivers reporting, then measure report freshness per station and how many reports carry a price.
- Check the new work on real phones, especially dark mode and the report form, and bring the onboarding, sign-in and desktop screens into dark.
- Tune the best-option weights against real trips instead of my judgement.
- Push notifications for a restock at a favourite station.
- A paid backend plan, and monitoring that alerts me before drivers notice an outage.
- Partnerships with station operators, using the station-manager role that already exists.

---

*Sources for the market figures: Presidential Initiative on CNG and Electric Vehicles (Pi-CNG) and statements from the Minister of State for Petroleum Resources (Gas), as summarised in my own notes. Add direct links.*
