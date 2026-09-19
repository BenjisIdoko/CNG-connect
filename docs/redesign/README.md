# Handoff: CNG-Connect Premium UI Redesign

## Overview
A full visual redesign of CNG-Connect, a PWA connecting CNG (compressed natural gas) drivers in Nigeria to live station availability, pricing, and pressure data, plus community, kit-conversion, and gamification features. This redesign moves the product from a generic green/bordered UI to a premium, Uber/Bolt/InDrive-class visual language.

## About the Design Files
The file in this bundle (`CNG-Connect-Redesign.html`) is a **design reference built in HTML** — a static prototype showing intended look, layout, and a couple of live interactions (ROI calculator sliders, Community tab switching). It is NOT production code to copy directly. The task is to **recreate these screens in the target codebase's existing environment** (React Native, Flutter, SwiftUI/Kotlin, or web React — whichever the app already uses) following its established component patterns, navigation, and state management. If no environment exists yet, choose the framework best suited to a cross-platform driver PWA.

Each screen is mocked inside an iPhone-style device frame purely for presentation; the frame itself is not part of the design.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final/near-final. Recreate pixel-close using the codebase's component library where one exists; introduce the design tokens below where it doesn't.

## Design Tokens

### Color
- Primary brand green — `#319A3F` ("Fruit Salad") — active nav state, links, live-status pulse, progress bars, "Available" status
- Accent orange — `#F85B23` ("International Orange") — primary CTA buttons (Report Status, Submit Report, Verify & continue, Book, Show stations), "Low pressure" status
- Dark surface — `#1F2923` ("Heavy Metal") — headers, dark map mode, nav bar, hero stat cards
- Background cream — `#F6F5EF` / `#F1EFE6` ("Spring Wood" family) — page and card backgrounds
- Light green tint — `#E3F5E6` / `#BAE9C0` ("Madang" family) — selected/active chip backgrounds, OTP input fill
- Status — Queuing `#F5A623`, Out of service `#E5484D` (semantic, kept outside brand palette for universal recognition)
- Text — primary `#1F2923`, secondary `#5C6B60`, tertiary `#8B9389`

### Typography
- Font family: **Urbanist** (Google Fonts), weights 400/500/600/700/800
- Headlines/hero numbers: 700–800 weight, tight letter-spacing (-0.02 to -0.03em)
- Body/labels: 400–600 weight
- Small labels/eyebrows: 10–11px, uppercase, letter-spacing 0.04–0.08em

### Shape & Elevation
- Cards: 14–18px border radius
- Buttons: full pill (999px radius)
- Elevation via soft shadows (e.g. `0 4px 14px rgba(14,20,32,0.06)`), not borders

## Screens
1. **Onboarding carousel** — 4-slide swipeable intro, full-bleed photo, dot pagination, skip + arrow CTA.
2. **Sign up / Log in — OTP step** — 6-digit code entry, resend timer, single dark "Verify & continue" pill CTA.
3. **Map (home)** — dark "night mode" map, floating search + filter chips, photo-pin station markers, draggable bottom sheet with horizontal station photo-cards, floating bottom nav (Map/Kits/Community/Profile) with active state raised as a circular bubble.
4. **Map (desktop)** — persistent left list panel + map, not a stretched mobile view.
5. **Filters** — bottom sheet: distance chips, status checklist, pressure range slider, dynamic "Show N stations" CTA.
6. **Station detail** — hero photo, live "N drivers here now" pulse indicator, pressure/price stat cards, Reports/Chat/Photos segmented tabs, verified-photo report card, sticky "Report Status" CTA.
7. **Report status flow** — 4 full-width single-tap status buttons (Available/Queuing/Low pressure/Out of service), optional wait-time chips, camera-only photo attach (no gallery), submit CTA.
8. **Live camera capture** — full-screen viewfinder, disabled gallery access, burned-in timestamp watermark, shutter button.
9. **Proximity alert** — geofence-triggered bottom sheet, live driver count, 2×2 quick-status grid, lighter-weight than the full report flow.
10. **Profile** — dark header with avatar/stats, driver tier progress bar with locked (greyed, not hidden) future tiers, savings summary card linking to the calculator, settings list.
11. **ROI / fuel savings calculator** — live sliders (daily distance, vehicle mileage) recomputing a headline monthly-savings number instantly; grant vs self-funded toggle; payback period + CO₂ avoided stat cards. One canonical instance, linked from Profile.
12. **Reputation level-up modal** — celebratory, dismissible card shown on tier-up.
13. **Community** — single tab, three sub-views (Groups = per-station chat, Hub = maintenance/parts/deals discussion, Leaderboard = point rankings), switched via segmented control.
14. **Kits — conversion centre directory** — stats strip, accredited-badge distinct from star rating, price/time estimate, Call/Directions/Book three-up actions.
15. **AI assistant** — chat interface grounded in live station data, quick-reply chips, typing indicator.
16. **System chrome** — install prompt, offline banner, update-available toast.

## Interactions & Behavior
- Onboarding: swipe/tap between slides; dot indicator updates; Skip always visible.
- Report status buttons: single tap selects (no multi-select); selected state is a solid-fill orange card.
- ROI calculator: two range sliders drive a real-time recalculation of savings, payback period, and CO₂ figures (see formula below); a segmented toggle switches between "Government grant" (free/no payback period) and "Self-funded kit" (shows months to payback).
- Community tabs: tapping Groups/Hub/Leaderboard swaps the list content below with no page navigation.
- Camera capture: gallery/photo-library access is disabled everywhere in the reporting flow — live camera only, with a burned-in timestamp.
- Bottom nav: active tab renders as a raised circular bubble in the accent color; inactive tabs are flat icon+label.

## State Management
- Report flow: selected status (enum: available/queuing/low_pressure/out_of_service), optional wait-time bucket, optional photo attachment.
- ROI calculator: `distance` (km/day, 20–400), `mileage` (km/l, 4–20), `grantOn` (boolean) — drive derived `monthlySavings`, `paybackMonths`, `co2Avoided`.
  - `litresPerMonth = (distance / mileage) * 30`
  - `monthlySavings = litresPerMonth * (petrolPricePerLitre − cngPricePerLitre)`, using ₦1200 petrol / ₦230 CNG as placeholder reference prices — replace with live pricing data.
  - `paybackMonths = kitCost / monthlySavings` (kitCost placeholder ₦350,000), shown only when self-funded.
  - `co2AvoidedKg = litresPerMonth * 2.3 * 0.4` (placeholder emissions factor — confirm with real figures).
- Community: active sub-tab (groups/hub/leaderboard).
- Map: user location, selected filters (status/pressure/distance), bottom sheet position (collapsed/standard/expanded).

## Assets
No real photography is used — station/vehicle imagery is represented with diagonal-hatch placeholder blocks. Replace with real station photos, vehicle photos, and user avatars before shipping. No icon font/library is used; icons are Unicode glyphs standing in for a proper icon set (e.g. Phosphor, SF Symbols, Material Symbols) — pick one during implementation.

17. **App icon** — a full gas-pump-machine mark: rounded green body, dark-framed digital screen, an orange fuel-drop badge, and a hose curving to a nozzle, all in the brand palette on a dark radial ground. Shown masked for iOS (squircle) and Android (adaptive/circle), plus the flat 1024×1024 source with safe-zone guide and a 52px home-screen legibility check.

## Design Audit
See `DESIGN_AUDIT.md` in this bundle for the specific problems found (in both the live app and earlier drafts of this redesign) and the fix applied for each — badge overload, CTA hierarchy, status color semantics, tab styling, etc. Read it before implementing; it explains *why* certain screens look the way they do, which the screen list above doesn't cover.

## Files
- `CNG-Connect-Redesign.html` — full design reference, all 17 screens + app icon, built as a self-contained HTML file (open directly in any browser).
- `DESIGN_AUDIT.md` — itemized audit of issues found and fixes applied.
