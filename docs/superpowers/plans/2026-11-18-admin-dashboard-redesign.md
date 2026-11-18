# Admin Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the user prefers native). Steps use checkbox (`- [ ]`) syntax. Before any UI edit read the Impeccable craft floor (`.../skills/impeccable/reference/craft-floor.md`).

**Goal:** A completely new, shadcn-based "Security Print" UI for `/admin` and `/station-manager`, with an Overview home, without losing any function.

**Architecture:** A theme scoped to an `.admin-ui` wrapper (CSS variables named as shadcn expects) plus a `src/components/ui/` kit, both reached only from the lazily loaded admin chunk. A new shell, a pure "thread" helper feeding a new Overview, then each existing panel restyled in place with the kit, keeping its data logic.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Radix (dialog, tabs, popover already installed), class-variance-authority (new), Vitest (pure utils + `react-dom/server` render tests).

**Spec:** `docs/superpowers/specs/2026-11-18-admin-dashboard-redesign-design.md`. **Direction contract:** `.impeccable/surfaces/src-components-admin-adminscreen-tsx.md`.

## Global Constraints

- Palette: deep note green `#0d3b2e`, celadon paper `#e7f0ea`, ink `#1a1f1c`, foil gold `#c9a227`. Gold is only for pressable things and new/changed rows; text on gold is ink, never white. State colours (red, amber) only where they mean something.
- Type: Geist (UI) and Geist Mono (ids, numerals, tabular figures); 8px radius; 1px green-tinted rules; no heavy shadows.
- The admin theme lives under `.admin-ui` and must not leak into the driver app. Nothing from `src/components/ui/` may land in the main entry chunk (check after `npm run build`).
- Keep every function of every panel (moderation actions, suggestions approve/reject, station add/edit/pin/CSV/bulk delete, user edit/delete, manager add/remove, manager quick card, payouts when `ENABLE_REFERRALS`).
- Text contrast AA, visible focus, labelled controls, dialogs trap and restore focus. Laptop-first; phone must not break (sidebar drawer, scrollable tables).
- Project rules: commit per task on branch `feat/admin-redesign` (cut from `main`); push/merge/deploy only when the user asks; no database changes in this plan.

## Review Focus

1. A station manager at `/station-manager` sees only "My stations" and none of the admin chrome (Task 3, Task 7).
2. Overview with zero pending items shows a closed thread and an honest empty state, not a broken layout (Task 4 tests).
3. Counts that fail to load show "—" and a retry, never a wrong number (Task 4).
4. Long names, many notches (hundreds pending) and narrow screens do not overflow (Task 2 test, Task 8 screenshots).
5. The driver app bundle and look are unchanged (Task 1 build check, Task 8).

## File Structure

- Create `src/components/admin/admin-theme.css`, `src/components/admin/AdminRoot.tsx`, `src/components/ui/*.tsx` (Task 1).
- Create `src/utils/adminThread.ts` + `.test.ts` (Task 2).
- Rewrite `AdminSidebarLayout.tsx`, `AdminAuthGate.tsx`, `NotForYou.tsx`; modify `AdminScreen.tsx`, `StationManagerEntrance.tsx` (Task 3).
- Create `src/components/admin/OverviewPanel.tsx`, `src/utils/adminQueue.ts` + `.test.ts` (Task 4).
- Restyle `ReportsPanel.tsx`, `SuggestionsPanel.tsx`, `StationManagersPanel.tsx`, `UsersPanel.tsx`, `UserEditorModal.tsx`, `AirtimePayouts.tsx` (Task 5).
- Restyle `StationsPanel.tsx`, `AddStationModal.tsx`, `PinReviewModal.tsx`, `PositionPicker.tsx`, `FullStationEditorModal.tsx` (Task 6).
- Restyle `MyStationsPanel.tsx`, `StationQuickUpdate.tsx` (Task 7).
- Modify `README.md`; create `DESIGN.md` via the Impeccable documenter (Task 8).

---

### Task 1: Foundation (theme and shadcn kit)

**Files:** Create `src/components/admin/admin-theme.css`, `src/components/admin/AdminRoot.tsx`, `src/components/ui/{button,badge,input,label,textarea,card,table,separator,skeleton,dialog,sheet,tabs}.tsx`, `src/components/ui/ui.test.tsx`; modify `package.json` (add `class-variance-authority`).

**Interfaces — Produces:** `AdminRoot: React.FC<{ children: React.ReactNode; className?: string }>` (renders `<div className="admin-ui ...">`, imports `admin-theme.css`); shadcn exports with their usual names (`Button` + `buttonVariants` with variants `default` (gold, ink text), `outline` (green hairline), `ghost`, `destructive`, `link`; `Badge` variants `default|secondary|outline|destructive|new`; `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`; `Card*`; `Dialog*`; `Sheet*` (Dialog-based side drawer); `Tabs*`; `Input`, `Label`, `Textarea`, `Separator`, `Skeleton`).

- [ ] Step 1: Failing render tests in `ui.test.tsx` (`react-dom/server`): `Button default carries the gold action background and ink text`; `Button destructive is not gold`; `Badge new uses the gold tint`; `Table renders a semantic table with thead and tbody`; `Input forwards its label via aria-label`.
- [ ] Step 2: Run `npx vitest run src/components/ui/ui.test.tsx`. Expected: FAIL (modules missing).
- [ ] Step 3: Install `class-variance-authority`; fetch the shadcn component sources with the Shadcn MCP (`get_component`) and adapt them to Tailwind v4 and the `.admin-ui` variables (`--background`, `--foreground`, `--primary` = gold, `--primary-foreground` = ink, `--secondary` = green, `--muted`, `--border` = green hairline, `--ring`, `--radius: 8px`). Write `admin-theme.css` (scoped under `.admin-ui`, including Geist/Geist Mono mapping and a visible focus ring) and `AdminRoot`.
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass. Confirm the main entry chunk size is unchanged within ~1 KB and that `class-variance-authority` appears only in the lazy admin chunks.
- [ ] Step 5: Commit `feat(admin-ui): scoped Security Print theme and shadcn kit`.

### Task 2: Thread helper

**Files:** Create `src/utils/adminThread.ts`, `src/utils/adminThread.test.ts`.

**Interfaces — Produces:** `type ThreadKind = 'flagged' | 'suggestion' | 'pin'`; `interface ThreadCounts { flagged: number; suggestion: number; pin: number }`; `interface ThreadSegment { kind: ThreadKind; count: number; notches: number }`; `totalPending(c: ThreadCounts): number`; `isThreadClosed(c: ThreadCounts): boolean`; `buildThread(c: ThreadCounts, maxNotches?: number): ThreadSegment[]` (default `maxNotches` 48; order flagged, suggestion, pin; segments with count 0 are omitted; when the total exceeds `maxNotches` notches scale down proportionally but every non-zero segment keeps at least 1 notch and the sum never exceeds `maxNotches` unless there are more non-zero segments than notches).

- [ ] Step 1: Failing tests: `a closed thread has no segments and isThreadClosed is true`; `notches equal counts when the total fits`; `large counts scale down to at most 48 notches and keep a notch for every non-zero kind`; `order is flagged, suggestion, pin`; `negative or NaN counts are treated as 0`.
- [ ] Step 2: Run it. Expected: FAIL.
- [ ] Step 3: Implement.
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run`. Expected: pass.
- [ ] Step 5: Commit `feat(admin-ui): security thread helper`.

### Task 3: Shell, sign-in and "not for you"

**Files:** Rewrite `AdminSidebarLayout.tsx` (same props plus optional `title?: string` and `badgeTone`), `AdminAuthGate.tsx`, `NotForYou.tsx` with the kit and `AdminRoot`; modify `AdminScreen.tsx` (wrap in `AdminRoot`; add `overview` as first nav item, default tab; toast via the kit) and `StationManagerEntrance.tsx` (wrap in `AdminRoot`). Existing tests (`NotForYou.test.tsx`) keep passing.

- [ ] Step 1: Write a failing render test for the layout (`AdminSidebarLayout.test.tsx`): `renders every nav item with its label and a badge count`, `marks the active item with aria-current="page"`, `shows the signed-in email and a Sign out button`.
- [ ] Step 2: Run it. Expected: FAIL.
- [ ] Step 3: Implement: 240px deep-green sidebar (brand, nav with pending badges, email and sign out at the foot), page header (title), main area on celadon; below `md` the sidebar becomes a `Sheet` opened from a header button; the sign-in card and the not-for-you card use the kit.
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass. Browser check `localhost:3002/admin` and `/station-manager` sign-in screens at desktop and phone width.
- [ ] Step 5: Commit `feat(admin-ui): new shell, sign-in and no-access screens`.

### Task 4: Overview

**Files:** Create `src/utils/adminQueue.ts` + `.test.ts`, `src/components/admin/OverviewPanel.tsx`; modify `AdminScreen.tsx` (route `overview`, pass `onNavigate`).

**Interfaces — Produces:** `interface QueueItem { id: string; kind: ThreadKind; title: string; detail: string; createdAt: string | null }`; `rankQueue(items: QueueItem[]): QueueItem[]` (oldest first by `createdAt`; items with no date last; ties by kind order flagged, suggestion, pin; stable); `isNewSince(createdAt: string | null, lastVisitMs: number | null): boolean` (true only when both are valid and `createdAt` is later than `lastVisitMs`). `OverviewPanel: React.FC<{ flash: (m: string) => void; onNavigate: (key: 'reports' | 'suggestions' | 'stations') => void }>`.

- [ ] Step 1: Failing tests: `rankQueue puts the oldest first, undated last, and breaks ties flagged before suggestion before pin`; `rankQueue does not mutate its input`; `isNewSince is false without a last visit, with a bad date, or when the item is older`; `isNewSince is true for an item created after the last visit`.
- [ ] Step 2: Run them. Expected: FAIL.
- [ ] Step 3: Implement the helpers, then `OverviewPanel`: load counts and the top items with the existing queries (pending `station_suggestions`, `admin_moderation_queue` flagged, `stations` with `needs_pin_review`, head counts for stations/profiles/`station_managers`); draw the thread from `buildThread`; ranked queue with a gold tint on items new since the stored last visit (`localStorage`, try/catch), each row opening its tab; a counts column; a closed-thread empty state; per-section "—" and Retry on load failure; store the new last-visit time on unmount.
- [ ] Step 4: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] Step 5: Commit `feat(admin-ui): Overview with the security thread and ranked queue`.

### Task 5: Queue and people panels

**Files:** Restyle `ReportsPanel.tsx`, `SuggestionsPanel.tsx`, `StationManagersPanel.tsx`, `UsersPanel.tsx`, `UserEditorModal.tsx`, `AirtimePayouts.tsx` with the kit. Logic, queries and RPC calls stay as they are.

- [ ] Step 1: Convert each panel (Table, Badge, Button, Dialog, Input); flagged rows and anything new use the gold tint; destructive actions use the destructive variant and keep their confirmations; empty and loading states use `Skeleton` and plain copy.
- [ ] Step 2: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass; existing tests still pass.
- [ ] Step 3: Browser check each panel's empty state at desktop and phone width (no signed-in data available: say so).
- [ ] Step 4: Commit `feat(admin-ui): restyle reports, suggestions, managers and users`.

### Task 6: Stations and editors

**Files:** Restyle `StationsPanel.tsx`, `AddStationModal.tsx`, `PinReviewModal.tsx`, `PositionPicker.tsx`, `FullStationEditorModal.tsx` with the kit (Dialog for modals); keep the CSV import, bulk delete, pin editor, accuracy and duplicate warnings exactly as they work now.

- [ ] Step 1: Convert, one file at a time, running `npx tsc --noEmit` between files.
- [ ] Step 2: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] Step 3: Commit `feat(admin-ui): restyle stations and station editors`.

### Task 7: Manager entrance

**Files:** Restyle `MyStationsPanel.tsx`, `StationQuickUpdate.tsx`; confirm `StationManagerEntrance.tsx` shows only "My stations".

- [ ] Step 1: Convert with the kit (selling toggle and pressure stepper keep 44px targets; gold only on the pressable buttons).
- [ ] Step 2: Run `npx tsc --noEmit && npx vitest run && npm run build`. Expected: pass.
- [ ] Step 3: Commit `feat(admin-ui): restyle the station manager page`.

### Task 8: Finish

- [ ] Step 1: Run the Impeccable detector once: `impeccable detect --json --changed`; fix mechanical findings.
- [ ] Step 2: Capture desktop (1440) and phone (390) screenshots of the sign-in, not-for-you and every state reachable without a login into `.impeccable/review/`; validate each file.
- [ ] Step 3: Spawn the shipped `impeccable-finish-reviewer` with the packet the playbook lists; act on its disposition (fix batch, one recapture, one verdict pass).
- [ ] Step 4: Spawn `impeccable-documenter` to write `DESIGN.md` and `.impeccable/design.json` from the built admin.
- [ ] Step 5: `README.md`: one line on the new dashboard, test counts. Run `npx tsc --noEmit && npx vitest run && npm run build`.
- [ ] Step 6: Commit `docs: admin dashboard redesign`; tell the user the branch is ready and ask before merging or deploying.
