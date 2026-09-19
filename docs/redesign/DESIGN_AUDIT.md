# CNG-Connect — Design Audit

Findings from reviewing the live app (cngconnect.com.ng) against the redesign, and the specific fixes applied. For developers: treat this as the rationale behind each change in `CNG-Connect-Redesign.html`, not a spec in itself — the README and the HTML file are the spec.

## 1. Visual identity was generic
**Issue:** Default "green because it's a gas app" palette, no distinct type direction, read as a template rather than a product with its own brand.
**Fix:** Adopted a specific palette — Fruit Salad green `#319A3F` (brand/status), International Orange `#F85B23` (primary actions), Heavy Metal `#1F2923` (dark surfaces), Spring Wood `#F6F5EF` (background) — and Urbanist as the single typeface across all weights. See README for full token list.

## 2. Status color semantics were inconsistent
**Issue:** Early drafts used blue as a generic "accent" for both status and actions, and red for "out of service," which reads as an error/danger state rather than a neutral fact.
**Fix:** Green = available/live, orange = attention (queuing, low pressure — same family, different label, matching how drivers actually triage these two), a desaturated neutral = out of service (a fact, not a warning), orange reserved as the *action* color (buttons) so it never gets confused with the *status* meaning of "queuing."

## 3. Verification badges were overloaded
**Issue:** A single driver-report card carried three separate pill badges ("Verified Reporter," "Fresh · Just now," "Photo Verified") plus a thumbs-up/down pair — five distinct chip shapes competing for attention on one card.
**Fix:** Consolidated to one small checkmark badge on the avatar (verification) and a plain muted timestamp next to the name (freshness). Removed the redundant thumbs-down affordance. One visual signal per fact.

## 4. Segmented tabs didn't match in-app patterns
**Issue:** Group Chat / Driver Reports / Photos was rendered as a heavy bordered pill switcher, inconsistent with how lightweight this navigation actually is.
**Fix:** Switched to an underlined text-tab row (active tab gets a 2px green underline + dark text, inactive tabs are muted) — quieter, and matches the real app's tab weight.

## 5. Footer CTA hierarchy was backwards
**Issue:** The station-detail footer showed three competing actions (an unlabeled pencil icon circle, a dark "Get Directions" pill, an outlined "Share" pill) with no visual indication of which mattered most — and the pencil icon's meaning (report status) wasn't legible at all.
**Fix:** "Report Status" is the app's core loop, so it is now the single filled primary CTA (orange, full width, labeled). "Directions" and "Share" are demoted to two equal-weight outlined secondary buttons beneath it.

## 6. Empty/unreported states used mismatched treatments
**Issue:** "No price data" and "no pressure data" each had their own pill/badge/copy pattern, adding visual weight to the absence of information.
**Fix:** Both now share one calm typographic treatment (muted large value + one shared helper line below), instead of colored badges.

## 7. Proximity alert didn't match the live app's real pattern
**Issue:** The first pass used a generic white bottom sheet for the geofence alert.
**Fix:** Rebuilt as a dark translucent card (matching the real app's night-mode alert) with outlined status pills in the map's own color language, plus the real copy pattern ("Add pressure & photo report" / "Not now").

## 8. Map felt like a generic list-with-a-map-behind-it
**Issue:** Flat light map, plain teardrop pins, no sense of a live, premium ride-hail-category product.
**Fix:** Full "night mode" map treatment, glowing solid-fill status pins, horizontally-scrolling photo cards for nearby stations, and a floating pill bottom nav with a raised active-tab bubble — closer to the Uber/Bolt/InDrive visual bar the brief named as the target category.

## 9. No app icon
**Issue:** None existed.
**Fix:** Recreated the requested "flat 3D gas-pump" reference concept in the product's own palette rather than the stock icon's red/pink: green gradient body, dark-framed digital screen, orange fuel-drop badge, hose-to-nozzle detail, on a dark radial ground. Tested at iOS squircle, Android adaptive-circle, and real 52px home-screen scale — see "App icon" section of the design file.

## Open items / recommend follow-up
- Real station and vehicle photography is needed everywhere placeholders currently sit (diagonal-hatch blocks).
- Pick one production icon library (e.g. SF Symbols on iOS, Material Symbols on Android, or a shared set like Phosphor for a cross-platform app) — the redesign uses Unicode glyphs as stand-ins only.
- Confirm real petrol/CNG reference prices and the emissions factor used in the ROI calculator (`CNG-Connect-Redesign.html` currently uses placeholder figures — see README's State Management section).
