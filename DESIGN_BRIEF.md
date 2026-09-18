# CNG-Connect — UI Redesign Brief

## How to use this document

This is a **content and functionality spec, not a layout mandate.** Every screen below lists what must be shown, why, and what the user needs to be able to do — not exact positions, colors, or component choices. Treat the current design (described briefly under "current visual language" for context only) as a baseline to improve on, not a constraint to match. Where a detail is load-bearing — it affects trust, safety, or a core interaction — it's flagged **[MUST KEEP]**. Everything else is fair game to reinvent.

---

## 1. What this app is

CNG-Connect is a PWA that helps Nigerian drivers (commercial: Bolt/Uber/inDrive, and private) who run on Compressed Natural Gas find working refuelling stations, report live pump status to each other, find accredited conversion workshops, and calculate their fuel savings. It's built in support of Nigeria's Presidential CNG & EV Initiative (Pi-CNG).

## 2. Who it's for

- **Primary**: commercial drivers, often on the road all day, checking the app in short glances between fares or while queuing. Low tolerance for friction — the reporting flow especially needs to stay fast.
- **Secondary**: private drivers researching whether to convert to CNG, more likely to browse calmly (ROI calculator, conversion centre directory).
- Real-world conditions to design for: mid-range Android phones, inconsistent mobile data, bright outdoor sunlight (contrast matters), and a wide range of tech comfort (some drivers are very online, some are not).

## 3. Design direction

**"Modern and premium"** — the brief is to move this from "functional utility app" to something that feels like a confident, trustworthy product a driver is proud to have on their home screen. Think the visual confidence of a premium fintech or ride-hailing app, not a government directory site. Concretely, that likely means:

- Bold, clear typographic hierarchy — the current type scale is workable but was under-differentiated before a recent pass; a redesign can be much more confident about size/weight contrast between hero numbers (pressure, price, savings), section titles, and body/meta text.
- Generous whitespace and fewer competing borders — the current UI leans on outlined cards and dividers everywhere; a premium feel usually means fewer, better-chosen surfaces (shadow/elevation instead of border-everywhere).
- A restrained, deliberate color story — right now there's a working set of role-based colors (see §5) but no strong signature look. There's room for a real brand identity here (a distinctive primary color pairing, not just "green because gas station").
- Status and trust signals (see §5.3) need to stay *instantly* legible even if the visual language changes completely — these are safety-relevant, not decorative.
- Motion/microinteraction is currently minimal (a few pulse animations, bounce on level-up). A premium feel benefits from purposeful transitions — but nothing that slows down the 1-tap reporting flow.

## 4. Current tech constraints worth knowing

- React + Tailwind, mobile-first, a `lg:` desktop breakpoint that currently swaps some list views to a sidebar/grid layout rather than reflowing the same components. A redesign is free to handle desktop differently, but both a phone-width and a desktop-width experience need to be specified.
- PWA — installable, works offline with cached map tiles/station data. The install-prompt and offline-state UI (§6.9) are real, not edge cases to ignore.
- Material Symbols is the current icon set. Open to any icon system in the redesign.

---

## 5. Global patterns (apply across screens)

### 5.1 Navigation shell
- **Bottom nav**, 4 tabs: **Map** (home/default), **Kits** (conversion centres), **Community**, **Profile**. Mobile only — desktop needs its own nav treatment (currently a left sidebar).
- Community tab carries an unread-count badge.
- A top header exists on most non-modal screens: either a logo/wordmark, or a back-button + screen title. One shortcut lives in the header nearly everywhere: opening the AI Assistant.

### 5.2 Shape/elevation convention (current, open to reinvention)
The current system uses a strict 3-tier shape rule: fully-rounded (pill) shapes are reserved for primary tappable actions and nav only; large-radius rounded rectangles are containers/modals; smaller-radius rounded rectangles are informational badges/chips (never CTAs). This kind of *consistent, meaningful* shape grammar is worth keeping as a concept even if the actual radii/style change — it's what currently gives the UI what little systemic coherence it has.

### 5.3 Status & trust language **[MUST KEEP the concepts, redesign the visuals]**
These are safety/trust-relevant signals a driver relies on to decide whether to drive somewhere expecting fuel:
- **4-state station availability**: Full stock/Available (positive), Queuing/Busy (caution), Low pressure/Most ports occupied (caution), Out of gas/Out of service (negative). Needs a color+icon+label system that reads instantly, including to colorblind users (don't rely on hue alone).
- **Report freshness**: "Updated 5 min ago" vs "No recent report" — age must always be visible next to any status, never shown bare.
- **Verification tiers**: unverified text report vs. verified-with-live-photo report are visually distinct (a badge/border/tag), and a **live-camera watermark** (burned into the photo itself: "verified live camera snapshot" + timestamp) is a real anti-fraud mechanism, not decorative chrome — don't design it away.
- **Location precision**: some station pins are exact, some are approximate (city-centroid fallback). Approximate pins get a visibly different marker/border treatment plus an accuracy-radius indicator and a "this location may be approximate — fix it" affordance.
- **Pi-CNG accreditation**: a distinct badge for government-accredited stations/conversion centres.

### 5.4 Gamification
Points, reputation tiers, badges, and a leaderboard exist to encourage reporting. This should feel like an *earned, premium* achievement system (think airline status tiers) rather than a gamey/childish one — locked badges are shown (grayed out) rather than hidden, to create aspiration.

### 5.5 Anti-misinformation photo capture **[MUST KEEP behavior]**
Reports and community posts require a **live in-app camera capture** — gallery/file uploads are explicitly blocked for these flows, with clear messaging about why ("gallery uploads blocked" / "live camera active"). This is a deliberate fraud-prevention choice, not a missing feature. (One exception exists today — the "suggest a new station" flow allows a normal gallery upload — flagged in §8 as worth resolving one way or the other during the redesign, not a pattern to copy elsewhere.)

### 5.6 Current color roles (for context, not to be treated as final)
- A deep-green primary + bright-mint accent pairing for brand/CTAs.
- Dedicated status colors for the 4-state availability system (green/orange/orange/red), independent from a separate WhatsApp-brand green used only for share buttons.
- A distinct "live now" pulse color for real-time presence indicators.
- A layered "surface" scale (background → card → elevated card) in soft green-tinted neutrals.
- A single typeface (Plus Jakarta Sans) throughout, one type-scale with ~7 named sizes from micro (badges) to display (hero/splash).

---

## 6. Screen-by-screen specification

### 6.1 Splash
- **Purpose**: brief branded loading moment on cold start.
- **Content**: full-bleed hero photo of a real CNG station, wordmark, a short value-prop headline, progress indicator.
- **Action**: none required — auto-advances; a "Let's Go" tap can skip ahead.
- **Notes**: ~4 seconds max. Progress bar can be cosmetic.

### 6.2 Onboarding (first-time users)
- **Purpose**: 4-screen value-prop carousel before sign-in.
- **Content per slide**: full-bleed photo + headline + one-sentence description. Topics: finding stations with live pressure/queue data, GPS distance & drive time, state-based alerts & proximity chat, browsing conversion centres.
- **Actions**: advance via tap or swipe, jump to any slide via dot indicators, "Log In" always reachable, and on the last slide: **Sign Up**, **Log In**, and **Explore as guest** all need to be available.
- **[MUST KEEP]**: guest browsing must remain an option — the app's map/directory content is intentionally open to non-signed-in users.

### 6.3 Sign up / Log in
- **Purpose**: single unified flow — email + one-time code, no password. The same 2-step flow logs an existing driver back in *or* creates a new account; only brand-new drivers see a 3rd step.
- **Step 1**: email entry.
- **Step 2**: numeric code entry, with a resend option (cooldown timer) and a note that a confirmation link can arrive instead of a code in some configurations.
- **Step 3 (new drivers only)**: name, phone, state/city, vehicle type (private/taxi/keke/truck — icon-tile picker, not a plain dropdown), vehicle make/year, current CNG status (installed/planning/interested — again a visual tile picker, since this state affects a later conditional field: tank size, only shown if "installed").
- **States**: per-step loading ("Sending…", "Verifying…", "Saving…"), inline validation errors, disabled resend during cooldown.
- **[MUST KEEP]**: returning users must be able to complete sign-in in exactly 2 steps (email + code) — never force step 3 on someone who already has a profile.

### 6.4 Map (home tab)
This is the screen most drivers open the app for — it deserves the most design attention.
- **Purpose**: find the nearest usable station, right now.
- **Content**: a map (clustering markers in dense areas), plus a station list that can be more or less prominent (currently a bottom sheet with 3 height states: collapsed to a thin header strip, standard showing the ~5 nearest, expanded showing all matching stations with pagination and a horizontal photo strip of the closest few). Each station entry needs: name, distance, live status + age, and (context-dependent) pump pressure/price or EV charging speed.
- **Actions**: search by name/city/state/operator; filter by pump pressure range, distance radius, and status; recenter/locate-me (with a visibly different state depending on whether GPS is active, denied, or unavailable); tap a station to preview it or open its full detail; get directions or share a station directly from the list; suggest a new station not yet listed.
- **States**: empty results (with a way to reset filters), GPS permission states, offline/stale-data indicator.
- **[MUST KEEP]**: the ability to go from "open the app" to "see the nearest station's status" in as few taps/as little scanning as possible — this screen's whole job is speed. Also keep the 3-tier disclosure idea (glance → shortlist → full list) in some form, even if not literally a bottom sheet.
- **Desktop**: needs its own considered layout, not just a stretched phone view — likely map + persistent list panel side by side.

### 6.5 Station detail
- **Purpose**: everything about one station — specs, live chat with other drivers there, verified report history, photos.
- **Content**: photo header, name/address, live "N drivers here now" presence, dominant status + freshness, price and pressure/charging-speed as prominent hero numbers (a pressure gauge visualization is used today and reads well — a redesign can reinterpret this but should keep pressure feeling like the "headline stat" it is), plus a way to browse: a group chat, a feed of individual driver reports (showing verification status, freshness, and up/down voting), and a photo gallery.
- **Actions**: report status (opens 6.6), get directions, share, favorite/follow for alerts, post a chat message, add a photo, fix an approximate pin.
- **States**: empty states for reports and photos, a warning treatment for unverified reports, first-visit policy explainer.
- **[MUST KEEP]**: status/price/pressure need to be scannable in under a second — this is the "should I drive here" decision screen.

### 6.6 Report station status
- **Purpose**: the core fast-reporting interaction — this needs to stay genuinely 1-tap-capable.
- **Content**: 4 large, clearly distinct status options (context-aware wording for CNG vs EV stations), with an optional expandable section for wait-time, a live-camera photo, and a note.
- **Actions**: tap a status, optionally expand details, submit.
- **States**: a real constraint to design for — submission can be blocked if the driver isn't geofenced at the station, with a clear explanation why, not a silent failure.
- **[MUST KEEP]**: full-width/large single-column buttons for the 4 statuses (not a compact grid) — this is a deliberate speed/accuracy choice for drivers glancing at their phone. Keep submission fast when a driver just wants to tap-and-go.

### 6.7 Live camera capture
- **Purpose**: enforce a genuine, unmanipulated photo for verification.
- **Content**: full-screen live camera view, front/rear toggle, shutter.
- **[MUST KEEP]**: no gallery/file-picker access anywhere in this flow; the captured image gets a visible verification watermark (text + timestamp) burned into the photo itself; a clear permission-denied fallback state with a way to retry.

### 6.8 Suggest a station / Fix a station's location
- **Suggest new station**: type (CNG/EV), name, address, city/state, operator, optional photo, notes → submitted for review. (Currently the one flow that allows gallery photo upload — see §8.)
- **Fix location**: three ways to correct a wrong pin — paste a Google Maps link/coordinates, use current device GPS, or type lat/lng manually. Keep all three options; different drivers will reach for different ones.

### 6.9 Proximity alert
- **Purpose**: a geofence-triggered nudge when a driver arrives near a station, prompting a super-fast status update.
- **Content**: arrival message, live presence count if available, a compact 2×2 grid of the same 4 quick-status options as the full report flow, an escalation option to the full report (with photo), dismiss.
- **States**: pre-submit → a brief confirmation with the points earned, then auto-dismiss.
- **[MUST KEEP]**: this needs to be even faster than the main report modal — it's designed to be actioned in a couple of seconds without breaking a driver's flow.

### 6.10 Kits tab — conversion centre directory
- **Purpose**: help a driver find and book an accredited workshop to install a CNG kit.
- **Content**: headline stats (accredited centre count, states covered, typical conversion time), then a list/grid of centres — code, accreditation badge, name, address, rating, services offered, cost range, estimated hours, and distance.
- **Actions**: call, get directions, book, search, filter by state, filter to accredited-only.
- **States**: empty results with reset.

### 6.11 Book a conversion
- **Purpose**: appointment request for a chosen centre.
- **Content**: selected-centre summary, vehicle make/year, tank size (with plain-language descriptions of each size), preferred date, phone, notes.
- **States**: submitting → a real confirmation screen with a booking reference and a visible rewards-points callout.

### 6.12 Fuel savings / ROI calculator
- **Purpose**: persuade a driver considering conversion by showing real numbers.
- **Content**: a live-updating "you'd save ₦X/month" headline driven by sliders (daily distance, vehicle mileage) and inputs (petrol price, CNG price), a toggle between the free government grant and a self-funded kit, and a payback-period + CO₂-reduction breakdown.
- **Note**: this calculator currently exists both as a full modal and in a condensed form embedded in the Profile tab — the redesign should deliberately choose whether to keep both or consolidate (see §8).
- **[MUST KEEP]**: the calculation needs to feel immediate/alive as inputs change — this is a persuasion tool, and instant feedback is what sells it.

### 6.13 Community tab
- **Purpose**: three distinct sub-experiences under one tab — worth real thought on whether a single segmented tab is still the right structure, or whether these deserve more differentiation.
  - **Station groups**: a directory of per-station chat groups (mirrors the map's station list, but framed as "communities").
  - **General discussion hub**: category-based forum (maintenance, parts, reviews, deals, plus a cross-link into the conversion-centre directory), each post showing author, category, excerpt, optional photo, likes/replies.
  - **Leaderboard**: ranked drivers by reputation points, with rank/avatar/tier/state.
- **Actions**: search (scoped to whichever sub-view is active), start a new post (persistent floating action), like/reply/share inline, notifications.
- **[MUST KEEP]**: the distinction that "gas availability/status talk happens in station groups, everything else happens in the general hub" — this is an active policy nudge in the current app and matters for keeping each space useful.

### 6.14 Post detail / discussion
- **Purpose**: full post + threaded comments.
- **Content**: full post (author, category, title, body, optional photo — deal posts show a price), comment feed with one level of replies.
- **Actions**: like, comment, reply to a specific comment (with a visible "replying to X" context), share.

### 6.15 Create a post
- **Purpose**: compose a new community post.
- **Content**: category picker (maintenance/parts/reviews/deals — icon tiles), title, conditional price field (deals only), description, live-camera photo (same anti-misinformation rule as reporting).

### 6.16 Direct chat
- **Purpose**: 1:1 messaging, primarily used around marketplace/deal posts (buying/selling a car or parts).
- **Content**: message thread with text/photo bubbles, read receipts, a pinned card showing which listing the conversation is about, typing indicator.
- **Actions**: send text or photo, go back to the listing.

### 6.17 Profile tab
- **Purpose**: a driver's identity + reputation + settings hub — no single dominant action, this is a dashboard.
- **Content**: identity card (avatar with photo upload, name, contact, active vehicle — switchable between saved vehicles), a stats row (points, reports made, reputation rating), a reputation/badges section (current tier, progress to next tier, a grid of tiers showing locked ones grayed-out for aspiration), the condensed savings calculator (see 6.12 note), and settings: home state (which scopes alerts), proximity notification toggle, share the app, help/FAQ, replay onboarding, sign out.
- **Actions**: edit profile fields, change avatar, switch vehicle, toggle settings.

### 6.18 Reputation level-up
- **Purpose**: a celebratory moment when a driver crosses a reputation tier threshold.
- **Content**: tier badge/icon, tier name, total points, 1-2 lines on what the new tier unlocks.
- **Actions**: go to profile, or dismiss and keep going.
- **[MUST KEEP]**: this should feel like a genuine reward moment, not an interruption — brief, celebratory, easy to dismiss.

### 6.19 AI assistant
- **Purpose**: conversational help for station/queue/savings questions.
- **Content**: chat thread, a handful of quick-suggestion starter chips, a loading state while it "checks live station status."
- **[MUST KEEP]**: responses should feel grounded in real, current station data (prices, pressures) even if generated locally as a fallback — avoid generic chatbot filler copy.

### 6.20 System / utility surfaces
- **Install prompt**: a compact banner above the bottom nav, offering a real one-tap install where the browser supports it, and step-by-step manual instructions where it doesn't (iOS Safari). Needs to disappear once installed or dismissed.
- **App update / offline status**: small toast-style notices — an update-available prompt with a reload action, a "your data is cached for offline use" confirmation, and an "you're offline" warning. These are reactive system chrome, not user-initiated screens, and should stay unobtrusive.
- **Policy info sheet**: a single-sentence explainer bottom sheet reused in a few places (report modal, post composer, community screen) — keep it lightweight, it's shown once per user then suppressed.

---

## 7. Non-negotiables checklist

However the visual language changes, these functional/UX commitments need to survive:

- [ ] Guest browsing works without an account; only writing (reports, posts, comments) requires sign-in.
- [ ] Returning users sign in in exactly 2 steps (email + code); only brand-new users see the profile-completion step.
- [ ] Every status shown to a driver is paired with its freshness/age — never a bare status with no sense of how current it is.
- [ ] Verified (live-photo) vs unverified reports are visually distinguishable at a glance.
- [ ] Live camera capture (report photos, post photos) never allows gallery upload, and the captured photo carries a visible verification watermark.
- [ ] Approximate/uncertain station locations are visually flagged as such, with a way to correct them.
- [ ] The 4-status reporting flow stays a fast, large-target, minimal-tap interaction — this is the app's core loop.
- [ ] The proximity-alert quick-report is even faster/lighter-weight than the full report modal.
- [ ] The app remains installable and usable offline (cached map + station data), with honest offline-state messaging.
- [ ] The "gas availability talk belongs in station groups, everything else in the general hub" distinction stays legible to users.

---

## 8. Open questions for the redesign to resolve (not yet decided, don't guess)

- The ROI/savings calculator exists in two places (a full modal and a condensed embed in Profile) — decide whether to keep both, or make one the canonical version and link to it from the other.
- "Suggest a new station" allows a normal gallery photo upload, while every other photo-attaching flow in the app is live-camera-only — decide whether to bring it in line or whether it's a deliberate exception (new stations aren't a live pump-status claim, so the anti-fraud rationale may not apply the same way).
- The direct-chat screen (6.16) currently simulates the other party's replies rather than connecting to a real backend — worth flagging to whoever implements the redesign that this may need real functionality, not just a new look.
- Community's 3-way split (station groups / general hub / leaderboard) under one tab may deserve a different information architecture entirely — this brief describes current content requirements, not a mandate to keep them fused.
