---
name: CNG-Connect Admin (Sypher Clean)
description: Clean operator desk for the CNG-Connect admin dashboard; crisp white sheets on a sage canvas, charcoal ink, leaf-green for what is active, mint for the one thing to press.
colors:
  canvas-sage: "#eef2ee"
  card-white: "#ffffff"
  ink: "#111814"
  mute-text: "#607066"
  muted-wash: "#f3f6f4"
  hairline: "#e3e9e5"
  leaf-green: "#15803d"
  leaf-green-deep: "#166534"
  leaf-tint: "#dcfce7"
  emerald: "#16a34a"
  lime: "#84cc16"
  mint-action: "#86efac"
  mint-action-hover: "#4ade80"
  new-tint: "#fef9c3"
  danger: "#dc2626"
  danger-soft: "#fef2f2"
  warn: "#d97706"
  warn-soft: "#fffbeb"
typography:
  page-title:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  brand:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    letterSpacing: "-0.025em"
  card-title:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
    fontFeature: "tnum"
  label:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
  overline:
    fontFamily: "Geist, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.05em"
    textTransform: "uppercase"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.92em"
    fontWeight: 400
rounded:
  xs: "2px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.mint-action}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.mint-action-hover}"
  button-secondary:
    backgroundColor: "{colors.leaf-green}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.leaf-green-deep}"
  button-outline:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "36px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "16px 20px"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  badge-new:
    backgroundColor: "{colors.new-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-default:
    backgroundColor: "{colors.leaf-green}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  nav-item:
    textColor: "{colors.mute-text}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  nav-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
  nav-count:
    backgroundColor: "{colors.leaf-tint}"
    textColor: "{colors.leaf-green}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: CNG-Connect Admin (Sypher Clean)

Scope: the admin dashboard (/admin) only: `src/components/admin/*`, the kit in `src/components/ui/*`, tokens prefixed `--color-adm-*` in `src/index.css`, scoped base styles in `src/components/admin/admin-theme.css`. The driver app is a different, untouched design and is not described here. This file replaces the earlier "Security Print" system (note-green sidebar, celadon paper, foil gold); that look is retired.

## Overview

**Creative North Star: "The Clean Desk"**

The admin is a well-lit desk: a soft sage canvas, crisp white sheets (cards, sidebar, header bar) separated by hairlines, charcoal ink for text, and leaf green for everything that is active or selected. One pale mint marks the single thing to press in a view. Nothing competes: no tinted sidebar, no gold, no heavy shadow.

The signature is the thread on the Overview: a hairline carrying one notch per pending item (flagged reports red, driver suggestions emerald, pin reviews lime). Clearing the queue closes the thread into an unbroken emerald line. Beside it sit the quiet data marks of the same family: slim emerald and lime bars, and a dotted-leader list of totals.

Density is operator-grade: plain, fast tables, 14px body with 13px table cells, 36px controls (44px on phones), tabular figures everywhere. Depth is tone and hairline first; shadows are whispers at rest and real only on floating layers. The world is light only (`color-scheme: light`, `data-theme="light"` forced by `AdminRoot`).

**Key Characteristics:**
- Sage canvas, white surfaces, 1px green-grey hairlines.
- Leaf green means active (selected tab, link, focus ring, default badge, toast); mint means "press me"; ink fills the active nav item.
- One family (Geist) plus Geist Mono for ids and key figures; tabular numerals on by default.
- Radius 6px on controls, 8px on nav items and dialogs, 12px on cards.
- Emerald and lime are data colors (thread, bars, dots), not interface chrome.

## Colors

A cool sage-and-white family with one confident green, one pale mint, and a disciplined status trio.

### Primary
- **Leaf Green** (#15803d, `adm-note`): selected tab rule, link text, focus ring and outline, caret, default badge, secondary button fill, toast fill, dialog and drawer scrim (at 55%).
- **Leaf Green Deep** (#166534, `adm-note-2`): secondary button hover.
- **Leaf Tint** (#dcfce7, `adm-note-text`): nav count chip and avatar fill, text selection fill; always with Leaf Green text on it.

### Secondary
- **Mint Action** (#86efac, `adm-foil`): the default (primary) button fill. Always carries ink text, never white.
- **Mint Action Hover** (#4ade80, `adm-foil-hover`): primary button hover; also the icon color on the active (ink) nav item.
- **New Tint** (#fef9c3, `adm-new`): new or changed rows (`TableRow[data-state=new]` at 60%) and the `new` badge, with ink text.

### Data
- **Emerald** (#16a34a, `adm-emerald`): driver-suggestion notches, the closed thread, bars, the Stations dot, the active nav count chip.
- **Lime** (#84cc16, `adm-lime`): pin-review notches, bar gradients, the Users dot. Graphic use only; never text (1.98:1 on white).

### Neutral
- **Canvas Sage** (#eef2ee, `adm-paper`): page ground (`AdminRoot`).
- **Card White** (#ffffff, `adm-card`): cards, sidebar, header bar, inputs, outline buttons, dialogs, drawer.
- **Muted Wash** (#f3f6f4, `adm-muted`): hover fill for rows, ghost and outline buttons, nav items and icon buttons; table head at 40%; sidebar foot at 40%; secondary badge.
- **Hairline** (#e3e9e5, `adm-line`): every border and divider (card header and footer rules at 80%, row dividers at 70%).
- **Ink** (#111814, `adm-ink`): primary text, active nav fill, brand tile.
- **Mute Text** (#607066, `adm-mute-text`): secondary text, table headers, overlines, placeholders, inactive nav.

### Status
- **Danger** (#dc2626) on **Danger Wash** (#fef2f2): flagged reports, errors, destructive button (danger fill, white text).
- **Warn** (#d97706) on **Warn Wash** (#fffbeb): cautions and the warning badge; also the header status dot when items are pending.

### Named Rules
**The Mint Rule.** Mint (#86efac) is the one pressable primary action in a view, always with ink text, never white. Leaf green carries selection and state; ink carries the active nav item. A mint element that cannot be acted on, or a mint button with white text, is a defect.
**The Prefix Rule.** Admin colors are `adm-` tokens only. Never reuse the driver app's tokens in admin screens, and never use `adm-` tokens outside admin and the kit.
**The Data Colors Rule.** Emerald and lime are for marks that show amounts and kinds (thread, bars, dots). Never set text in them, and never let a kind ride on color alone: every notch group has a count and a spoken label.

## Typography

**Display / Body Font:** Geist (with -apple-system, Segoe UI, Roboto fallbacks), self-hosted and shared with the driver app's phone screens. The driver app's own base styles put Inter on the body and Urbanist on every heading; `admin-theme.css` opts the admin out of both (`.admin-ui` sets Geist, and `h1`-`h6` inside it inherit), and `adminFonts.test.ts` keeps it that way.
**Label/Mono Font:** Geist Mono (with ui-monospace, Menlo), for ids, code and key totals (`.font-adm-mono`, `font-geist-mono`, `code`, at 0.92em).

**Character:** one neutral grotesque family, differentiated by weight (700 titles, 600 labels and buttons, 400 body); the mono face signals machine identifiers and counted figures.

### Hierarchy
- **Page title** (700, 1.125rem, -0.025em, balanced wrap): the `h1` in the header bar; dialog titles share it.
- **Brand** (700, 0.875rem, -0.025em): sidebar wordmark.
- **Card title** (600, 0.9375rem, 1.25, -0.025em): `CardTitle`.
- **Body** (400, 0.875rem): prose and controls; table cells and sidebar items run at 0.8125rem. 1rem on form inputs under 768px so phones do not zoom. Tabular figures on (`font-variant-numeric: tabular-nums` on `.admin-ui`).
- **Label** (600, 0.75rem): badges, buttons in dense bars, card descriptions at 400.
- **Overline** (600, 0.6875rem, uppercase, +0.05em): table headers and the sidebar "Workspace" heading (Mute Text), small field captions, nav count chips (700). Nothing in the admin is set below 0.6875rem.
- **Mono** (400 to 600, 0.92em): ids and the Overview totals.

### Named Rules
**The Weight Ladder Rule.** Hierarchy is weight and size, not new faces. 700 titles, 600 controls and labels, 400 prose; no other family enters the admin.

## Layout

Operator shell, fixed full screen (`fixed inset-0`): a 256px (`w-64`) white sidebar with a hairline right edge from `md` up, replaced by a left Sheet drawer (min(20rem, 85vw)) on phones behind a menu button in a 56px (`h-14`) white header bar. The header carries the page title and, from `sm` up, a status pill ("N pending review" with a warn dot, or "Queue clear" with an emerald dot). The work area is the sage canvas; each panel owns its scrolling. Overview content is centered at max 80rem (`max-w-7xl`) with 16px padding (24px from `md`), 20px gaps between cards and a 12-column grid from `lg`. Card internals use 20px horizontal and 16px vertical padding; table cells 14px by 12px; controls 36px high (32px small, 44px large). Under `md`, buttons, inputs and tabs rise to a 44px touch target. Spacing runs on a 4px base (4, 8, 12, 16, 20, 24). The Table primitive scrolls sideways inside its container; Stations, Users and Reports lay out so they do not need to.

## Elevation & Depth

Tone and hairline first. Surfaces separate by color (white over sage) and 1px Hairline borders; hover rows shift to Muted Wash. At rest, surfaces get at most a whisper of shadow. Real shadows belong to layers that float above the page.

### Shadow Vocabulary
- **Card whisper** (`box-shadow: 0 1px 2px rgba(17,24,20,0.03)`): `Card`; nearly a hairline.
- **Active nav** (`box-shadow: 0 1px 3px rgba(17,24,20,0.12)`): the ink nav item.
- **Dialog** (`box-shadow: 0 12px 32px rgba(13,59,46,0.22)`): `DialogContent`, over a Leaf Green 55% scrim.
- **Drawer** (`box-shadow: 0 0 32px rgba(13,59,46,0.3)`): mobile nav Sheet.
- **Toast** (`box-shadow: 0 6px 20px rgba(13,59,46,0.3)`): `useAdminToast`.

### Named Rules
**The Whisper Rule.** At rest: no shadow on buttons, inputs, rows or tabs, and no more than a 1 to 3px, 12%-opacity shadow on cards and the active nav item. Anything bigger means the layer floats.

## Shapes

Softly rounded, graded by size: 6px (`rounded-md`) on buttons, inputs, badges, the toast and icon buttons; 8px (`rounded-lg`) on nav items, sidebar buttons, brand tile, dialogs and inset panels; 12px (`rounded-xl`) on cards and inline alerts; full pills on nav counts, the status pill and bar tracks; 2px (`rounded-xs`) on thread notches and legend dots. Borders are always 1px Hairline (danger and warn alerts use their color at 30%). The thread notch (6px wide, 24px tall, 3px apart) is the one custom silhouette.

## Components

### Buttons
- **Shape:** 6px radius, 600 weight, 14px text, 36px high with 16px side padding; `sm` 32px, `lg` 44px, icon 36px/32px square; 44px under `md`; 16px icons (lucide-react), 8px icon gap.
- **Primary (default):** Mint Action fill, Ink text; hover Mint Action Hover.
- **Secondary:** Leaf Green fill, white text; hover Leaf Green Deep.
- **Outline:** Card White fill, Hairline border, Ink text; hover Muted Wash.
- **Ghost / Link:** transparent with Muted Wash hover / Leaf Green underlined text.
- **Destructive:** Danger fill, white text.
- **Focus:** 2px Leaf Green ring with 2px canvas offset; disabled at 50% opacity.

### Cards / Containers
- **Corner Style:** 12px. **Background:** Card White. **Border:** 1px Hairline. **Shadow:** card whisper.
- **Structure:** header (title + 12px Mute Text description, bottom rule at 80%), content, footer (top rule), 20px by 16px padding.

### Inputs / Fields
- **Style:** 36px high (44px under `md`), 6px radius, 1px Hairline, Card White fill, 14px Ink text (16px under `md`), Mute Text placeholder, Leaf Green caret.
- **Focus:** border and 2px ring shift to Leaf Green. **Error:** `aria-invalid` turns the border Danger. **Disabled:** 50% opacity.

### Badges
- 6px radius, 12px 600 text, 8px by 2px padding. Variants: default (Leaf Green, white), secondary (Muted Wash), outline, destructive (Danger on Danger Wash), warning (Warn on Warn Wash), new (New Tint fill, Ink text, mint 60% border).

### Tables
- Hairline row rules at 70%, 40px header row on Muted Wash 40% with overline-style Mute Text labels, 14px by 12px cell padding at 13px, Muted Wash 50% row hover, new rows tinted New Tint at 60%. Tabular figures.

### Tabs
- Underlined, not pilled: active tab gets a 2px Leaf Green rule and Ink text; inactive Mute Text; 16px apart. Mint is not used for tab state.

### Navigation
- White sidebar, 256px. Brand block: 32px Ink tile with a white "C", wordmark, and an "Admin Operations" line with a 6px emerald dot. Heading "Workspace" in overline style. Items: 13px 600, 10px by 12px padding, 8px radius, 16px icon; inactive Mute Text with Muted Wash hover, active Ink fill with white text and a Mint Action Hover icon. Pending counts are full pills: Leaf Tint with Leaf Green numerals, or Emerald with white when active. Foot sits on Muted Wash 40% with a 28px Leaf Tint avatar, the signed-in email, "Administrator", and two outline buttons (Sign out, Back to app).

### Modals
- Built on Radix Dialog through `ModalFrame` (focus trap, Escape, restores focus). Callers supply their own header, body and footer; frame is 8px radius, Card White, max-w 2xl, no padding. The base `DialogContent` is max-w 32rem with 24px padding and a Mute Text close icon button.

### The Thread (signature)
- A 28px-tall row with a 2px Hairline track and grouped 6x24px notches (3px apart within a group, 12px between groups, on a white lead-in), one per pending item, colored by kind (flagged Danger, suggestion Emerald, pin review Lime). Closed (nothing waiting) it becomes a full-width 6px Emerald pill. Exposed as `role="img"` with a spoken summary.

### Data marks
- Stacked bar: 8px high pill on Muted Wash, one segment per pending kind (Danger, Emerald, Lime) 2px apart, proportional to its count. Mini bars: 16px high Emerald columns 2px apart. Gradient bar: Lime to Emerald. Dotted-leader list: 8px 2px-radius dots (Emerald stations, Lime users, Ink community managers), labels in Mute Text, figures in Geist Mono 600.

## Do's and Don'ts

### Do:
- **Do** use Mint Action (#86efac) with Ink text for the one primary action in a view, and New Tint (#fef9c3) for new or changed rows.
- **Do** use Leaf Green (#15803d) for selection and state: the active tab rule, links, focus, default badge.
- **Do** draw every divider as 1px Hairline (#e3e9e5).
- **Do** build new admin screens from the kit in `src/components/ui` and the `adm-` tokens, in `AdminRoot`.
- **Do** keep text AA on its ground: Ink or Mute Text on white or sage, white on Leaf Green, Ink on Mint.
- **Do** keep tabular figures on counts and tables, and Geist Mono on ids and key totals.
- **Do** reach for `adm-emerald`, `adm-lime` and `adm-foil-hover` rather than raw hex when adding data marks.
- **Do** respect reduced motion (transitions collapse to 0.01ms under `prefers-reduced-motion`), keep touch targets at 44px under `md`, and keep form inputs at 16px there.

### Don't:
- **Don't** put white text on Mint Action, or use mint on anything that cannot be pressed.
- **Don't** fill the active tab with mint; the active nav item is Ink, the active tab is a Leaf Green rule.
- **Don't** set text in Lime, or in Mint on white. Neither passes AA.
- **Don't** put shadows on buttons, inputs, rows or tabs; real shadows belong to dialog, drawer and toast.
- **Don't** reintroduce the retired Security Print look: deep note-green sidebar, celadon page, foil gold (#c9a227).
- **Don't** introduce another type family or dark mode in the admin.
- **Don't** use driver-app tokens or styles inside admin screens.
- **Don't** treat the legacy look of `AirtimePayouts.tsx` (behind an off feature flag) as part of this system.

## Known Gaps

Measured against this system on the shipped code; delete each line when it is fixed.
- **Contrast below AA:** Warn text on Warn Wash is 3.07:1 (warning badge, 12px); Danger text on Danger Wash is 4.41:1 (destructive badge and inline alerts); white on the Emerald active nav count chip is 3.30:1 (11px).
- **Mobile drawer close button:** `sheet.tsx` still colors the X `adm-note-text` (#dcfce7) on a now-white drawer, 1.10:1, which is effectively invisible. The dialog's close button (Mute Text, Muted Wash hover) is the model to copy.
- **Retired tint on floating layers:** dialog, drawer and toast shadows still use the old deep green `rgba(13,59,46,…)`; the neutral equivalent is `rgba(17,24,20,…)`.
- **Raw hex in components:** `OverviewView.tsx` and `AdminSidebarLayout.tsx` hard-code `#16a34a`, `#84cc16` and `#4ade80` where `adm-emerald`, `adm-lime` and `adm-foil-hover` exist.
