# Push notifications for community manager posts, stage 2 — plan

**Goal:** When a community manager posts *Gas available* / *Gas not available*, drivers who opted in get a push notification on their phone, even with the app closed.

**Decisions (user approved all four points on 2026-11-20):**
- **Audience:** drivers in the **same state** as the station, plus anyone who **favourited** that station. Never the poster.
- **Both** *available* and *not available* notify.
- A one-time **prompt when a driver favourites a station**: "Get an alert when gas arrives here?"
- The user adds five Vercel settings: `VAPID_PUBLIC_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_SERVICE_ROLE_KEY`. Until they exist the sender answers 503 and nothing is sent; the app ignores that quietly.

**My calls (defaults from the proposal):**
- Only when the status **changes**, and at most **once per station per 15 minutes**. A repeat of the same status within 6 hours is skipped.
- A newer notification for the same station **replaces** the older one (same `tag`); tapping opens `/?station=<id>`.
- No names or locations of any driver in a notification. Text: "Gas available at <station>" / "Gas not available at <station>", body "A community manager says · <city>".
- Signed-in drivers only (a subscription stores the driver's state and favourites).
- Dead subscriptions (HTTP 404/410 from the push service) are deleted.

**Architecture:** a `push_subscriptions` table (own rows only) written through functions; a client service that subscribes the phone and keeps state/favourites in sync; a self-contained serverless function `api/notify-gas-post.ts` (service role + `web-push`; no sibling imports) that verifies the poster, applies the rules, picks the audience and sends. The community post card calls it after a successful post (fire and forget).

## Tasks
1. **DB** `supabase/push-subscriptions.sql` + verify script: `push_subscriptions` (RLS: read/delete own rows; writes only via `save_push_subscription` / `remove_push_subscription`), `push_notification_log` (service role only), input limits (https endpoint ≤ 2000 chars, ≤ 100 favourites).
2. **Client service** `src/services/pushService.ts`: support check, key conversion, subscribe/unsubscribe/sync, plus the pure helpers it needs; wire the Profile toggle and favourites sync in `App.tsx`.
3. **Favourite prompt** component + wiring (once per device, remembered).
4. **Sender** `api/notify-gas-post.ts` with pure helpers (`shouldNotify`, `pickAudience`, `buildNotification`, state matching copied from `permissionManager`) and tests that mock `web-push` and Supabase; add `web-push` dependency; `notifyGasPost` client call from the post card.
5. **Docs and checks:** README, `.env.example`, full tests/types/build, apply the migration, one whole-branch review.

## Constraints
- Never touch the user's main checkout (`feat/public-api`); work in this worktree on `feat/push-notifications`.
- `api/*.ts` import nothing relative (guard test). No secrets in the client bundle except the public VAPID key.
- No referral/airtime wording. No change to reports, points, flags or the map status.
- Delivery to a real phone cannot be tested here: say so in the report.
