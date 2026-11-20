# Manager password sign-in — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the user chose native execution for the previous plan; same here). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Station managers sign in with email + password, so a code (and its email) is sent only on first sign-in or a forgotten password.

**Architecture:** The existing admin password gate gains a `manager` mode: a password form with a switch to the existing emailed-code flow. After a code sign-in the manager is prompted to set a password (Supabase `updateUser`). The invite-claim database function additionally requires a verified email.

**Tech Stack:** React 19 + TypeScript, Supabase Auth (email OTP + password), Vitest (node env, `renderToStaticMarkup` component tests; no DOM library), Tailwind v4.

**Spec:** the approved design in the conversation of 2026-11-20 (no separate spec file): password form on `/station-manager`; "First time, or forgot your password? Email me a code"; set-password card after a code sign-in with "Not now"; 8+ characters typed twice; invite email wording; invite claim requires a verified email. `/admin` and the driver app are unchanged.

## Global Constraints

- Managers choose their own password; the app never creates or shows one.
- Password rules: at least **8** and at most **72** characters (bcrypt limit), both entries equal.
- No relative imports between files under `api/` (guard test `api/api-files.test.ts`).
- Wrong password and "no password set yet" give the same message (no account probing): `That email and password don't match. First time, or forgot your password? Email yourself a code.`
- Tap targets `min-h-[44px]`, field text 16px on phones, password-manager attributes: email `autoComplete="username"`, sign-in password `current-password`, new password `new-password`.
- Never touch the user's main checkout (`feat/public-api`); work only in this worktree on `feat/manager-password`.
- No referral/airtime wording anywhere.

## Review Focus

1. An invite for an email must not be claimable by an account whose email is unverified (database).
2. After a **code** sign-in the set-password card shows even if the person already has a password (forgot-password path), and after a **password** sign-in it does not.
3. Password sign-out → password screen again, no email sent; "Not now" must not block the manager from using the page.
4. Password too short/long/mismatched never reaches Supabase; Supabase errors (same password, weak password, expired session) show plain text, never raw messages.

---

### Task 1: Invite claim requires a verified email (database)

**Files:** Create `supabase/manager-claim-verified-email.sql`, `supabase/verify-manager-claim-verified-email.sql`.

- [ ] **Step 1:** Migration (idempotent): `create or replace function claim_station_manager_invites()` identical to the current body, plus: return `0` when `auth.users` has no row for `auth.uid()` with `email_confirmed_at is not null`. Keep `security definer`, `set search_path = public`, and re-issue `revoke … from public, anon` / `grant execute … to authenticated`.
- [ ] **Step 2:** Verify script in the style of `verify-station-post-details.sql` (inlined migration, temp `verify_results`, abort-with-results trick for running through `execute_sql`): (a) a confirmed user with a matching invite claims it (count 1, `station_managers` row exists); (b) a user whose `email_confirmed_at` is null claims nothing and the invite row remains; (c) a different email claims nothing; (d) anon cannot execute. Run it through Supabase `execute_sql` in an aborted transaction; expected every row PASS; then confirm the live database is unchanged.
- [ ] **Step 3:** Commit `feat(db): an invite is only claimed by a verified email`.

### Task 2: Password rules and the set-password prompt flag

**Files:** Create `src/utils/passwordRules.ts`, `src/utils/passwordPrompt.ts`; tests `src/utils/passwordRules.test.ts`, `src/utils/passwordPrompt.test.ts`.

**Produces:**
- `validateNewPassword(password: string, confirm: string): string | null` — plain-language error or null. Messages: `Use at least 8 characters`, `Use 72 characters or fewer`, `The two passwords don't match`.
- `friendlyPasswordError(message: string): string` — maps Supabase text: contains `different from the old` → `Choose a password you haven't used here before`; `weak`/`easy to guess`/`pwned` → `That password is too easy to guess. Try a longer one`; `session`/`jwt`/`not authenticated` → `Sign in again, then set your password`; anything else → `Could not save the password. Try again`.
- `SIGN_IN_FAILED_MESSAGE` (the Global Constraints sentence) and `friendlySignInError(message: string): string` → that sentence for invalid-credential text, `Could not sign in. Try again` otherwise; network-ish text → `No connection. Check your internet and try again`.
- `passwordPrompt` helpers taking an optional `Storage`-like (`{ getItem, setItem, removeItem }`, default `sessionStorage` guarded by try/catch): `markSetPasswordPrompt()`, `shouldPromptSetPassword(): boolean`, `clearSetPasswordPrompt()`; never throw when storage is unavailable (then `shouldPromptSetPassword` is false).

- [ ] **Step 1:** Tests: 7 chars → short error; 8 ok; 72 ok; 73 → long; mismatch; empty. Friendly mappings above incl. an unknown message never echoed. Prompt flag: mark → true; clear → false; throwing storage → false and no throw.
- [ ] **Step 2:** Run `npx vitest run src/utils/passwordRules.test.ts src/utils/passwordPrompt.test.ts` → FAIL (modules missing).
- [ ] **Step 3:** Implement. **Step 4:** run again plus `npx tsc --noEmit` → PASS. **Step 5:** commit `feat(auth): password rules and the set-password prompt flag`.

### Task 3: Manager sign-in screen (password first, code on request)

**Files:** Create `src/components/admin/PasswordSignInForm.tsx` (extracted from `AdminAuthGate`); modify `src/components/admin/AdminAuthGate.tsx`, `src/components/admin/CodeSignIn.tsx`, `src/components/admin/StationManagerEntrance.tsx`; tests `src/components/admin/PasswordSignInForm.test.tsx`, extend `CodeSignIn.test.tsx`.

**Consumes:** Task 2 helpers. **Produces:**
- `PasswordSignInForm` props: `{ title; description; onSubmit(email, password): Promise<{ success: boolean; error?: string }>; onExit(); footer?: React.ReactNode }` — the existing admin form markup (labels, 44px, `autoComplete`) moved here; email field uses `autoComplete="username"`.
- `AdminAuthGate` `mode?: 'password' | 'code' | 'manager'`. `password` renders `PasswordSignInForm` exactly as today (admin copy unchanged). `manager` renders `PasswordSignInForm` (description `Sign in with your email and password.`) with a footer link button `First time, or forgot your password? Email me a code`; choosing it shows `CodeSignIn` with `onUsePassword` to return; the code branch's `verifyCode` is wrapped so a successful verification calls `markSetPasswordPrompt()`. Manager password errors go through `friendlySignInError`. The `code` mode stays for any existing caller.
- `CodeSignIn` new optional props `onUsePassword?: () => void` (renders a link button `Use my password instead` on both steps) and `intro?: string` (replaces the email-step description; manager text: `Enter your email and we will send you a code. After you sign in you can set a password, so you won't need a code next time.`).
- `StationManagerEntrance` uses `mode="manager"`.

- [ ] **Step 1:** Tests (static markup): form has labelled email + password inputs, `autocomplete="username"` and `current-password`, 44px controls, renders the `footer` node when given and not otherwise; `CodeSignIn` renders `Use my password instead` only when `onUsePassword` is passed and shows the custom `intro`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement per Interfaces. **Step 4:** `npx vitest run src/components/admin && npx tsc --noEmit` → PASS. **Step 5:** commit `feat(auth): managers sign in with a password, with a code on request`.

### Task 4: Set-password card after a code sign-in

**Files:** Create `src/components/admin/SetPasswordCard.tsx`; modify `src/components/admin/StationManagerEntrance.tsx`; test `src/components/admin/SetPasswordCard.test.tsx`.

**Consumes:** `validateNewPassword`, `friendlyPasswordError`, prompt flag helpers, `useAuth().updatePassword`. **Produces:** `SetPasswordCard` props `{ onSave(password: string): Promise<{ success: boolean; error?: string }>; onDone(): void }`: heading `Set a password`, text `So you won't need an emailed code next time.`, two labelled password fields (`New password`, `Type it again`, both `autoComplete="new-password"`, 16px on phones), button `Save password` and button `Not now`; validates with `validateNewPassword` before calling `onSave`; shows `friendlyPasswordError` text on failure; calls `onDone()` after success and on `Not now`.
`ManagerBody` shows the card above `MyStationsPanel` while `shouldPromptSetPassword()`; `onDone` clears the flag; success flashes `Password saved. Next time, sign in with it`.

- [ ] **Step 1:** Tests: static markup has both labelled fields with `new-password`, both buttons 44px, no password echoed; (logic is in Task 2 tests).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** run + `tsc` → PASS. **Step 5:** commit `feat(auth): ask a manager to set a password after a code sign-in`.

### Task 5: Invite email and admin wording

**Files:** Modify `api/invite-manager.ts` (builder text and HTML), `api/invite-email.test.ts`, `src/components/admin/StationManagersPanel.tsx` (description), `README.md`, `.env.example` only if it mentions the code flow.

- [ ] **Step 1:** Update tests first: email text and HTML contain a step like `The first time, we email you a code. After you sign in, set a password so you don't need a code again.`; still contain the sign-in link and the station name; still no code or password.
- [ ] **Step 2:** Run `npx vitest run api` → FAIL. **Step 3:** Update the builder (inline; no sibling imports) and the panel description (`…sign in with the code that follows, then set a password…`). **Step 4:** `npx vitest run api src/components/admin` → PASS. **Step 5:** README: manager paragraph (password sign-in; codes only first time or forgotten; `supabase/manager-claim-verified-email.sql`); commit `feat(auth): invite email and wording for password sign-in`.

### Task 6: Whole check, live database, phone-size look

- [ ] **Step 1:** `npm test`, `npx tsc --noEmit`, `npm run build` → all green; update the README test count.
- [ ] **Step 2:** Apply Task 1's migration with Supabase `apply_migration` (name `manager_claim_verified_email`); confirm with `execute_sql` that the function body contains `email_confirmed_at` and that anon cannot execute it.
- [ ] **Step 3:** Run `npx vite --port=3011 --strictPort` from this worktree, open `/station-manager` at 375 px in the Browser pane: password form shows, no horizontal overflow, controls ≥ 44 px, "Email me a code" switches to the code screen and back; stop the server. A real signed-in password flow is not testable without a manager account (report that).
- [ ] **Step 3b:** Commit. **Do not merge or push**; wait for "merge and deploy".
