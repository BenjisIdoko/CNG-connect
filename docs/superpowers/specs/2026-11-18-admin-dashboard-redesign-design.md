# Admin dashboard redesign: design

Status: look approved by the user (chose "Security Print", 2026-11-18); build plan awaiting approval.
Direction contract: `.impeccable/surfaces/src-components-admin-adminscreen-tsx.md`. Product record: `PRODUCT.md`.

## Intent and why

The admin dashboard (`/admin`, and `/station-manager` which shares its shell) grew tab by tab and looks like a
generic slate-and-emerald template. The owner works alone, laptop first, and wants a completely new UI built
with shadcn components and a real point of view, with an Overview home that shows what needs attention.

## Goals

- A new look ("Security Print": deep note green, celadon paper, ink, foil gold used only for pressable things and
  new rows; hairline rules; Geist and Geist Mono) across every admin and manager screen.
- A new **Overview** home: the "security thread" (one notch per flagged report, suggestion and pin review, closing
  when the queue is clear), a ranked work queue, and counts (stations, users, managers).
- shadcn/ui components for the admin only (Button, Badge, Input, Label, Textarea, Card, Table, Separator,
  Skeleton, Dialog, Sheet, Tabs), themed with CSS variables scoped to the admin, loaded lazily.
- Laptop-first layout that still works on a phone (sidebar becomes a drawer, tables scroll or stack).
- Keyboard and screen-reader operable; AA contrast.

## Non-goals

- Any change to what the admin or a manager can do, to roles, routes, or the database.
- The driver-facing app's look (its tokens, fonts and components are untouched).
- New admin features beyond the Overview (no charts of history: there is no history data to show).

## Anti-goals

- The line work and gold turning into decoration where no data lives.
- Gold on anything that cannot be pressed, or white text on gold (fails contrast).
- Shipping a driver-bundle regression: nothing from the admin kit may land in the main entry chunk.
- A restyle that drops a function (CSV import, bulk delete, pin editor, moderation actions, payouts if enabled).

## Approaches considered

1. **Scoped theme plus shadcn kit, rebuild shell and Overview first, then restyle each panel (chosen).** The
   new tokens live under an `.admin-ui` class so the driver app cannot be affected; panels are converted one
   group at a time with the app working after every task.
2. Replace every admin file in one pass. Faster to describe, but a single broken screen blocks the whole
   dashboard and nothing can be reviewed along the way.
3. Re-theme the existing slate classes with CSS only. Cheapest, but gives no new structure, no Overview and no
   shadcn kit, so it is not the "complete new UI" asked for.

## Calls I made (the user can correct)

- shadcn is mostly present already (`components.json`, `cn()`, Radix dialog/tabs/popover, clsx, tailwind-merge,
  lucide-react). I add `class-variance-authority` only, and write the `ui` components into `src/components/ui/`.
- Fonts: Geist and Geist Mono, already bundled in `public/fonts`; no new font downloads.
- Overview counts use existing queries and RPCs only: pending `station_suggestions`, the moderation queue
  (`admin_moderation_queue`), stations with `needs_pin_review`, and totals for stations, profiles and
  `station_managers`. "New since your last visit" uses the browser's own stored last-visit time.
- Built in phases, each shippable: foundation and shell, Overview, queue panels, Stations and editors, manager
  entrance, finish. Merge and deploy only when the owner says so.

## Left to the builder

Exact component variants, the notch drawing (SVG or CSS), table column choices on narrow screens, and copy on
empty states.
