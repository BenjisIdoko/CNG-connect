# Production smoke test

Run this against https://cngconnect.com.ng after a deploy, after a database restore, or after
touching `vercel.json` (the CSP) or any `supabase/*.sql` file. It takes about 15 minutes.

**Set up once**

- Chrome, a normal window, **DevTools open on the Console and Network tabs** (tick *Preserve log*).
  Most failures here are silent in the UI and loud in the console.
- A **test driver account** (a phone number you control). Don't use your admin account for the driver steps.
- A second browser profile (or a private window) for the "other driver" checks.
- Know that the reports in steps 9–10 are **real data**: other drivers will see them. Pick one station
  and remove the reports afterwards (step 16).

Record a result next to each step: ✅ pass, ❌ fail (with the console error), ⏭ skipped.

---

## A. Backend is up

1. **Project is awake.** Supabase dashboard → project shows *Healthy*, not *Paused*.
   Free-plan projects pause after about a week without traffic, and the whole app stops working when they do.
   - Expect: `https://aomrrlxateneakvorzma.supabase.co/auth/v1/health` answers (a 401 is fine).
2. **Latest build is live.** Open `https://cngconnect.com.ng/version.json`.
   - Expect: an `id` and a `builtAt` matching the deploy you just pushed.

## B. Map and stations (signed out)

3. **Map loads.** Hard-reload (Cmd+Shift+R), allow or block location.
   - Expect: map tiles draw (no grey squares), station pins appear, no red errors in the Console.
   - Watch for: `Refused to connect` / `Content-Security-Policy` errors. That means a host is missing from `connect-src` in `vercel.json`.
4. **Tiles still load under the service worker.** Reload a second time, then DevTools → Application → Service Workers.
   - Expect: the worker is *activated and running*; map tiles still load; Cache Storage contains `cng-osm-tiles-v2`.
5. **Freshness chips are honest.** Open the station list (side panel on desktop, bottom sheet on phone).
   - Expect: stations reported in the last hour show a live dot, older ones show "Last: … · N days ago" in grey, never-reported ones show "No report yet".
   - Leave the tab open for 2–3 minutes: a "min ago" value should tick forward without a refresh.
6. **Filters and long list.** Tap *Available*, *Queuing*, *Low*; clear them; scroll the whole desktop list top to bottom.
   - Expect: counts change sensibly, every card renders as you scroll (no blank gaps), the scrollbar doesn't jump.

## C. Driver account

7. **Sign up / sign in.** Create the test account (phone is required), sign out, sign back in.
   - Expect: no console errors; the profile shows your name and 0 points.
   - Watch for: a `permission denied` or `42501` error in the Network tab on `profiles`.
8. **Leaderboard.** Open the Community tab and find the leaderboard.
   - Expect: a list of drivers with points and report counts (it calls `get_leaderboard`).
   - Fail signs: an empty list, or a request to `public_profiles` (that view no longer exists).

## D. Reporting (the part that changed most)

9. **Submit a report without a photo.** Open a station → *Report status* → pick a status → submit.
   - Expect: a success state, **+50 points**, the report appears in the station's list as "just now", the station's chip becomes live.
   - Then **refresh the page**: the points must still be there (they are awarded by the server, not just shown).
   - Fail signs: points appear, then vanish after refresh. Look for an `award_report_points` error in the Network tab.
10. **Submit a report with a live photo.** Same flow, using the camera.
    - Expect: the browser asks for camera permission, the preview shows, the capture works, **+100 points**, and the photo shows on the report.
    - Fail signs: a black preview or `NotAllowedError` (camera blocked by `Permissions-Policy`, which should read `camera=(self)`), or the photo uploads but never displays (image host not allowed in `img-src`).
11. **Double award is refused.** Submitting the same report twice must not give points twice. (The server raises "points already awarded for this report".)
    - Easiest check: after step 9, confirm your total went up by exactly 50, not 100.

## E. Other driver, same station

12. **Second profile sees it.** In the other browser, open the same station.
    - Expect: your report is listed, the chip is live, and the status matches.
13. **Chat/comment.** Post a comment on the station and a post in the community tab.
    - Expect: both appear for the other profile after a refresh.

## F. Limits (read, don't spam)

Rate limits are installed as database triggers. **Don't test them by flooding production.**
They were confirmed present after the restore on 2026-10-28:
`station_reports` 20 per 10 min, `station_comments` 30 per 10 min, `post_comments` 30 per 10 min,
`community_posts` 10 per 10 min, `station_suggestions` 10 per 60 min.
To re-check, run in the Supabase SQL editor:

```sql
select tgname, tgrelid::regclass from pg_trigger where tgname like 'zz_rate_limit%' and not tgisinternal;
```

Expect five rows. If you do want to see the message once, submit a station suggestion 11 times
from the test account; the 11th should say "Too many submissions — please wait a few minutes".

## G. Admin (use the admin account)

14. **Admin gate.** Open `https://cngconnect.com.ng/?admin=1` signed out, then as the test driver.
    - Expect: neither can see the dashboard; only the admin account can.
15. **Pin editor with Google Maps.** As admin → Stations → pick one → open its pin editor.
    - Expect: the Google map draws and the pin can be dragged and saved.
    - Fail signs: a grey box and a CSP error mentioning `maps.googleapis.com`, `maps.gstatic.com` or `fonts.gstatic.com`.
    - Save a pin back to its **original position** if you only wanted to test.
16. **Moderation.** The admin Reports panel is a queue of *flagged* reports. From the second profile,
    flag the test report from step 9 (the flag option on the report), then in the admin Reports panel
    choose *Remove* on it.
    - Expect: it shows up in the queue after flagging, and disappears from the station for the other profile after removing it.

## H. Clean up

17. Remove the test reports (step 16) and any test comments and posts you made.
18. If you created the test account only for this, delete it from Admin → Users.

---

## If something fails

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| Nothing loads, every request fails | Supabase project paused | Dashboard → project status; restore it |
| Blank map tiles after the second reload | CSP `connect-src` missing a host the service worker caches | `vercel.json`, `src/utils/csp.test.ts` |
| Points disappear after refresh | `award_report_points` failing | Network tab → RPC response body |
| `permission denied` on `profiles` | RLS lockdown hit a path that still reads other drivers' rows | `supabase/fix-public-profile-pii-exposure.sql` |
| Camera preview black | `Permissions-Policy` or browser permission | `vercel.json` header, site settings |
| Admin map grey | Google Maps host blocked by CSP | Console CSP error |
