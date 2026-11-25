---
name: CNG-Connect Admin (Security Print)
description: Banknote-green operator desk for the CNG-Connect admin dashboard; celadon paper, ink, and foil gold reserved for what can be pressed.
colors:
  note-green: "#0d3b2e"
  note-green-2: "#17503f"
  note-text: "#cfe3d8"
  foil-gold: "#c9a227"
  foil-gold-hover: "#b8921f"
  new-tint: "#f3e7b8"
  celadon-paper: "#e7f0ea"
  card-paper: "#f6faf7"
  ink: "#1a1f1c"
  mute-text: "#4a5a52"
  muted-wash: "#d6e5dc"
  engraved-line: "#b9cfc2"
  danger: "#a4262c"
  danger-soft: "#f6dcdc"
  warn: "#7a5200"
  warn-soft: "#f6e6bf"
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
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.foil-gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.foil-gold-hover}"
  button-secondary:
    backgroundColor: "{colors.note-green}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.note-green-2}"
  button-outline:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "36px"
  card:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  input:
    backgroundColor: "{colors.card-paper}"
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
    backgroundColor: "{colors.note-green}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  nav-item:
    textColor: "{colors.note-text}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  nav-item-active:
    backgroundColor: "{colors.note-green-2}"
    textColor: "#ffffff"
---

# Design System: CNG-Connect Admin (Security Print)

Scope: the admin dashboard (/admin) only: `src/components/admin/*`, the kit in `src/components/ui/*`, tokens prefixed `--color-adm-*` in `src/index.css`, scoped base styles in `src/components/admin/admin-theme.css`. The driver app is a different, untouched design and is not described here.

## Overview

**Creative North Star: "The Security Thread"**

The admin desk is dressed like banknote security print: a deep note-green sidebar, celadon paper for the page, ink for text, engraved hairline rules for every divider, and foil gold as the single mark of "you can press this". The signature is the thread on the Overview: a 2px green line carrying one notch per pending item (flagged reports red, suggestions green, pin reviews amber). Clearing the queue closes the thread into an unbroken line. It replaces the category default of grey sidebar over stat cards.

Density is operator-grade: plain, fast tables, 14px body, 36px controls, tabular figures everywhere. Nothing is decorative; depth comes from tone (card paper on celadon) and 1px rules, not shadows. The world is light only (`color-scheme: light`, `data-theme="light"` forced by `AdminRoot`).

**Key Characteristics:**
- Green ground (sidebar), celadon page, card-paper surfaces, 1px green-tinted rules.
- Gold is rationed: pressable primary actions, the new-row tint, selection highlight, and focus rings on dark ground.
- One family (Geist) plus Geist Mono for ids; tabular numerals on by default.
- Radius 6px on controls, 8px on cards and dialogs.
- Flat at rest; soft shadow only on floating layers (dialog, drawer, toast).

## Colors

A cool, desaturated green family with one warm metal accent and a disciplined status trio.

### Primary
- **Note Green** (#0d3b2e): sidebar ground, secondary buttons, default badge, active tab rule, focus ring on paper, thread line, dialog scrim (at 55%).
- **Note Green Raised** (#17503f): active and hovered nav item, secondary button hover.
- **Note Text** (#cfe3d8): text and chip fill on the green sidebar.

### Secondary
- **Foil Gold** (#c9a227): the default (primary) button fill and the selection highlight; focus ring on the green sidebar. Always carries ink text, never white.
- **Foil Gold Pressed** (#b8921f): primary button hover.
- **Gold Wash** (#f3e7b8): new or changed rows (`TableRow[data-state=new]` at 70%) and the `new` badge, with ink text.

### Neutral
- **Celadon Paper** (#e7f0ea): page ground (`AdminRoot`).
- **Card Paper** (#f6faf7): cards, header bar, inputs, outline buttons, dialogs.
- **Muted Wash** (#d6e5dc): hover fill for rows, ghost and outline buttons, secondary badge.
- **Engraved Line** (#b9cfc2): every border and divider.
- **Ink** (#1a1f1c): primary text.
- **Mute Text** (#4a5a52): secondary text, table headers, placeholders.

### Status
- **Danger** (#a4262c) on **Danger Wash** (#f6dcdc): flagged reports, errors, destructive button (danger fill, white text).
- **Warn** (#7a5200) on **Warn Wash** (#f6e6bf): pin reviews and cautions.

### Named Rules
**The Foil Rule.** Gold (#c9a227) is for things that can be pressed and for new rows, always with ink text, never white. A gold element that cannot be acted on, or a gold button with white text, is a defect.
**The Prefix Rule.** Admin colors are `adm-` tokens only. Never reuse the driver app's tokens in admin screens, and never use `adm-` tokens outside admin and the kit.

## Typography

**Display / Body Font:** Geist (with -apple-system, Segoe UI, Roboto fallbacks), self-hosted and shared with the driver app's phone screens. The driver app's own base styles put Inter on the body and Urbanist on every heading; `admin-theme.css` opts the admin out of both (`.admin-ui` sets Geist, and `h1`-`h6` inside it inherit), and `adminFonts.test.ts` keeps it that way.
**Label/Mono Font:** Geist Mono (with ui-monospace, Menlo), for ids and code (`.font-adm-mono`, `code`, at 0.92em).

**Character:** one neutral grotesque family, differentiated by weight (700 titles, 600 labels and buttons, 400 body); the mono face signals machine identifiers.

### Hierarchy
- **Page title** (700, 1.125rem, -0.025em, balanced wrap): the `h1` in the header bar.
- **Brand** (700, 0.875rem, -0.025em): sidebar wordmark.
- **Card title** (600, 0.9375rem, 1.25, -0.025em): `CardTitle`.
- **Body** (400, 0.875rem): prose and controls; table cells and sidebar items run at 0.8125rem. Tabular figures on (`font-variant-numeric: tabular-nums` on `.admin-ui`).
- **Label** (600, 0.75rem): badges, sidebar buttons, nav counts.
- **Overline** (600, 0.6875rem, uppercase, +0.05em): table headers (Mute Text), small field captions and group headings. Nothing in the admin is set below 0.6875rem.
- **Mono** (400, 0.92em): ids.

### Named Rules
**The Weight Ladder Rule.** Hierarchy is weight and size, not new faces. 700 titles, 600 controls and labels, 400 prose; no other family enters the admin.

## Layout

Operator shell, fixed full screen (`fixed inset-0`): a 240px (`w-60`) note-green sidebar from `md` up, replaced by a left Sheet drawer (min(20rem, 85vw)) on phones behind a menu button in a 56px (`h-14`) header bar. The work area is celadon; each panel owns its scrolling. Overview content is centered at max 72rem (`max-w-6xl`) with 16px padding (24px from `md`) and 24px gaps between cards. Card internals use 20px horizontal and 16px vertical padding; table cells 12px by 10px; controls 36px high (32px small, 44px large). Tables scroll sideways inside their container. Spacing runs on a 4px base (4, 8, 12, 16, 24).

## Elevation & Depth

Tonal and ruled, not shadowed. Surfaces separate by tone (Card Paper over Celadon Paper) and 1px Engraved Line borders; the active nav item and hover rows shift fill. The only shadows are on floating layers, all tinted note-green rather than black.

### Shadow Vocabulary
- **Dialog** (`box-shadow: 0 12px 32px rgba(13,59,46,0.22)`): `DialogContent`, over a Note Green 55% scrim.
- **Drawer** (`box-shadow: 0 0 32px rgba(13,59,46,0.3)`): mobile nav Sheet.
- **Toast** (`box-shadow: 0 6px 20px rgba(13,59,46,0.3)`): `useAdminToast`.

### Named Rules
**The Flat-At-Rest Rule.** Cards, rows, inputs and buttons carry no shadow. Shadow appears only when a layer floats above the page.

## Shapes

Gently squared: 6px (`rounded-md`) on buttons, inputs, badges, nav items and alerts; 8px (`rounded-lg`) on cards and dialogs; 4px (`rounded-sm`) on thread notches. Borders are always 1px Engraved Line (danger and warn alerts use their color at 30%). The thread notch (6px wide, 28px tall, 3px apart) is the one custom silhouette.

## Components

### Buttons
- **Shape:** 6px radius, 600 weight, 14px text, 36px high with 16px side padding; `sm` 32px, `lg` 44px, icon 36px/32px square; 16px icons (lucide-react), 8px icon gap.
- **Primary (default):** Foil Gold fill, Ink text; hover Foil Gold Pressed.
- **Secondary:** Note Green fill, white text; hover Note Green Raised.
- **Outline:** Card Paper fill, Engraved Line border, Ink text; hover Muted Wash.
- **Ghost / Link:** transparent with Muted Wash hover / Note Green underlined text.
- **Destructive:** Danger fill, white text.
- **Focus:** 2px Note Green ring with 2px paper offset; disabled at 50% opacity.

### Cards / Containers
- **Corner Style:** 8px. **Background:** Card Paper. **Border:** 1px Engraved Line. No shadow.
- **Structure:** header (title + description, bottom rule), content, footer (top rule), 20px by 16px padding.

### Inputs / Fields
- **Style:** 36px high, 6px radius, 1px Engraved Line, Card Paper fill, 14px Ink text, Mute Text placeholder, Note Green caret.
- **Focus:** border and 2px ring shift to Note Green. **Error:** `aria-invalid` turns the border Danger. **Disabled:** 50% opacity.

### Badges
- 6px radius, 12px 600 text, 8px by 2px padding. Variants: default (Note Green, white), secondary (Muted Wash), outline, destructive (Danger on Danger Wash), warning (Warn on Warn Wash), new (Gold Wash fill, Ink text, gold 60% border).

### Tables
- Hairline row rules, 40px header row with Mute Text 600 labels, 10px cell padding, Muted Wash 60% row hover, new rows tinted Gold Wash at 70%. Tabular figures.

### Tabs
- Underlined, not pilled: active tab gets a 2px Note Green rule and Ink text; inactive Mute Text. Gold is not used for tab state.

### Navigation
- Sidebar items: 14px 600, 10px by 12px padding, 18px lucide icon, 6px radius. Default Note Text; hover and active move to Note Green Raised, active with white text. Pending counts render as small Note Text chips with Note Green numerals. Focus ring is gold on the green ground. Foot holds the signed-in email and outlined white 20% buttons (Sign out, Back to app).

### Modals
- Built on Radix Dialog through `ModalFrame` (focus trap, Escape, restores focus). Callers supply their own header, body and footer; frame is 8px radius, Card Paper, max-w 2xl, no padding.

### The Thread (signature)
- A 2px Note Green hairline with grouped 6x28px notches, one per pending item, colored by kind (danger, green, warn). An unbroken line means nothing is waiting. Exposed as `role="img"` with a spoken summary.

## Do's and Don'ts

### Do:
- **Do** use Foil Gold (#c9a227) with Ink text for the one primary action in a view, and for new or changed rows (Gold Wash #f3e7b8).
- **Do** draw every divider as 1px Engraved Line (#b9cfc2).
- **Do** build new admin screens from the kit in `src/components/ui` and the `adm-` tokens, in `AdminRoot`.
- **Do** keep text AA on its ground: Ink or Mute Text on paper, Note Text or white on Note Green.
- **Do** keep tabular figures on counts and tables, and Geist Mono on ids.
- **Do** respect reduced motion (transitions collapse to 0.01ms under `prefers-reduced-motion`).

### Don't:
- **Don't** use gold on anything that cannot be pressed, or pair gold with white text.
- **Don't** put shadows on cards, rows, buttons or inputs; shadows belong to dialog, drawer and toast only.
- **Don't** fill the active tab or nav state with gold.
- **Don't** introduce another type family or dark mode in the admin.
- **Don't** use driver-app tokens or styles inside admin screens.
- **Don't** treat the legacy look of `AirtimePayouts.tsx` (behind an off feature flag) as part of this system.
