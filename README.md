# ⛽ CNG-Connect

> **Nigeria's Premier Compressed Natural Gas (CNG) Driver Platform & Live Station Locator**

[![React](https://img.shields.io/badge/React-19-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple.svg?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2C%20Auth%20%26%20Storage-emerald.svg?logo=supabase)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless-black.svg?logo=vercel)](https://vercel.com/)
[![Tests](https://img.shields.io/badge/Tests-498%2F498%20Passed-success.svg)](https://vitest.dev/)

**CNG-Connect** is a driver-facing PWA built for Nigerian commercial (Bolt, Uber, inDrive) and private drivers running on Compressed Natural Gas. Built in support of the Presidential CNG & EV Initiative (Pi-CNG), it provides a live, crowdsourced map of CNG refuelling stations, a directory of accredited conversion centres, a fuel-savings calculator, a driver community, and an internal toolset for keeping the underlying station data accurate.

**Live**: [cngconnect.com.ng](https://cngconnect.com.ng)

---

## 🌟 Driver-Facing Features

### ⛽ Live Station Map
- Crowdsourced CNG station tracker across Nigeria, rendered on a Leaflet map with marker clustering for dense areas.
- Filter by pump pressure, distance radius, and live availability (*Available*, *Queuing*, *Out of Gas*).
- One-tap turn-by-turn navigation via Google Maps, Apple Maps, or Waze.
- Every station shows a plain-language report age (`"Updated 5 min ago"`, `"No recent report"`) so drivers know how fresh a status actually is.
- A *Queuing* status only stays current while a car is actually at the station (a signed-in driver's phone within 250 m), or for 30 minutes after it is reported, up to the 45 minutes a report lasts. Otherwise it reads `"Last: Queuing · 6 hr ago"` in grey. Only counts of cars per station are public; who is where stays private.

### 📍 Proximity Alerts
- Background location watch detects when a driver is near a station they'd want to know about, and surfaces a push notification/in-app banner — the point being drivers find out about a nearby restock without needing to have the app open.

### ⏱️ Fast Driver Status Reporting
- Pick a status (Available / Queuing / Out of gas), then take a live in-app photo as proof: the pump meter, the queue, or the empty pump. The phone must be within 150 m of the station (checked when the photo is taken and again on submit), and the photo's position is saved with the report. Wait time, price and a note are optional.
- A station shows one report: the newest, for 45 minutes. A newer report replaces it, and once it is over 45 minutes old nothing is shown ("No report yet"). Older records are kept but never listed.
- Reports build a driver's reputation score and community points, with unlockable tiers as they contribute more.

### 🛠️ Conversion Centre Directory
- Searchable directory of 451+ Pi-CNG accredited conversion workshops, filterable by state/LGA, with in-app booking.

### 💰 Fuel Savings & Payback Calculator
- Computes monthly/annual naira savings and CO₂ reduction from switching to CNG, with a toggle between the free Pi-CNG driver grant and a privately-funded conversion kit.

### 📲 Passwordless Sign-In
- Real accounts via Supabase Auth's email-OTP flow — no password. Browsing stays open to guests; posting a report, comment, or joining the community requires a verified session, enforced at the database layer (Postgres RLS), not just the UI.
- Profiles (name, vehicle, reputation, points) are tied to the Supabase Auth account, so they follow a driver across devices.

### 💬 Driver Community & AI Guide
- Category-filtered discussion forum (Maintenance, Parts, Reviews, Deals, Conversions) with photo attachments and upvoting.
- An in-app AI assistant for CNG-related questions and station recommendations.

### 📱 Installable PWA
- "Add to Home Screen" prompt on both Android (native install banner) and iOS (guided Share → Add to Home Screen), plus offline-cached map tiles and station data so the app stays usable on a weak connection.

---

## 🔧 Internal Tools

Two hidden, authentication-gated routes exist for keeping station data accurate — neither is linked from the regular app UI:

- **`/admin` — Super admin dashboard.** Redesigned in the "Security Print" look (deep note green, celadon paper, foil gold for pressable things), built on shadcn/ui components scoped to the admin (`src/components/ui`, `adm-` tokens; see `DESIGN.md`). The **Users** tab is a directory: search, role, state and CNG-kit filters, sortable columns, paging and a CSV export of the current view. The dashboard opens on an **Overview**: a "security thread" with one notch per flagged report, driver suggestion and station pin waiting, a ranked work queue and totals. Only the app admin (the one profile with `is_admin`) can use it; anyone else who signs in there is pointed to their own page. The old `?admin=1` and `?moderation=1` links forward here. The **Station managers** tab lists every manager and their stations, invites a manager by email (no account needed; pending invites are shown until they first sign in) and removes managers. Accounts that manage a station are labelled in the Users tab. Nobody can make an admin from inside the app: the flag changes only by SQL (`supabase/lock-admin-flag.sql`). It lets the admin add a new station (name, address, a required map position and accuracy; a similar-station warning guards against duplicates), review driver "Suggest station" submissions (approve to create the station, or reject), drag a station's map pin to correct its location, edit every field on a station (name, address, hours, pricing, photos — uploaded straight to Supabase Storage), bulk-import corrections from a CSV spreadsheet, and bulk-delete stations.
- **`/station-manager` — Station manager.** Its own entrance (the old `?manager=1` link forwards here). A lighter role: the admin invites an email to one or more specific stations. The manager needs **no CNG-Connect account**: the invite also emails them a link (sent by `api/invite-manager.ts` through Resend; needs `RESEND_API_KEY` and `INVITE_FROM_EMAIL` in Vercel, otherwise the invite is saved and the admin screen says the email did not go out). They open `/station-manager`, enter that email, get a code by email and sign in. A manager with one station lands straight on its editor; with several they pick from a list. They see and edit only their stations (pricing, hours, photos, contact info). From the same "My stations" page a manager posts the station's status — **Closed**, **Open, waiting for gas** or **Open, gas available** — and the pump pressure in bar. A **Closed** or **Open, waiting for gas** post can also say why (waiting for supply, technical fault, no power, other) and when the manager expects it to change ("expected about 2 pm", read on the Lagos clock). Drivers see it as a separate "Station says" line on the station page and as a short badge in lists ("Station: closed · back ~2 pm"). A status shows for 6 hours, or, with an expected time, until an hour after that time (never more than 24 hours): once the time passes it reads "Was expected back 2 pm · not confirmed". A pressure reading shows for 12 hours. A **Share update on WhatsApp** button on the manager's card sends the status, reason, expected time, the time it was posted and a plain station link to the drivers the station already messages. None of this changes the driver-reported status, pin colour or ranking. When a station has no report in the last 45 minutes and no current manager post, a station outside its listed opening hours reads "Listed hours: closed, opens 6 am" instead of "No report yet" (24-hour stations and stations with no hours listed are unchanged). There are no push notifications. Needs `supabase/station-manager-signals.sql`, `supabase/manager-access-and-states.sql` and `supabase/station-post-details.sql`.

---

## 🏗️ Architecture & Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript 5.8 |
| **Build Tool & Bundler** | Vite 6 |
| **Styling** | TailwindCSS 4 (custom design-token type scale in `src/index.css`) |
| **Map Rendering** | Leaflet 1.9 + `leaflet.markercluster` (driver-facing); Google Maps JS API (admin pin editor only) |
| **Backend** | Supabase — Postgres with Row Level Security, Auth (email-OTP), Storage (avatars + station photos), and SQL functions (`SECURITY DEFINER` RPCs) for every privileged write |
| **Hosting** | Vercel, custom domain via Cloudflare DNS |
| **AI Assistant** | Vercel Serverless Function (`api/chat.ts`) calling Gemini |
| **PWA** | `vite-plugin-pwa` (Workbox) — offline caching, installability |
| **State Management** | React Context (`AuthContext`) + component state; no global store |
| **Test Runner** | Vitest (498 tests) |

The app runs as a client-only SPA — there's no traditional application server. The React client talks to Supabase directly with a public anon key; every write that needs privilege beyond "any signed-in driver" (station edits, admin actions, point awards) goes through a Postgres RPC function that checks authorization server-side, rather than trusting the client.

---

## 📁 Repository Structure

```
CNG-connect/
├── api/
│   └── chat.ts                      # Serverless AI Guide endpoint (Gemini)
├── scripts/                         # One-off data enrichment/geocoding scripts
├── supabase/
│   ├── schema.sql                   # Full DB schema: tables, RLS policies, triggers
│   └── *.sql                        # Incremental migrations (run in the SQL editor)
├── src/
│   ├── components/
│   │   ├── MapScreen.tsx            # Leaflet map, filters, station list
│   │   ├── StationDetailScreen.tsx  # Station detail, photos, live report feed
│   │   ├── ReportStatusModal.tsx    # 1-tap driver status reporting
│   │   ├── ConversionCentersScreen.tsx
│   │   ├── CngRoiCalculatorModal.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── CommunityScreen.tsx / ChatScreen.tsx / DiscussionScreen.tsx
│   │   ├── AiAssistantModal.tsx
│   │   ├── InstallPrompt.tsx        # PWA "Add to Home Screen" banner
│   │   ├── AdminPinsScreen.tsx      # ?admin=1 dashboard
│   │   ├── FullStationEditorModal.tsx # Full station editor (used by both admin & manager)
│   │   ├── StationManagerScreen.tsx # ?manager=1 scoped editor
│   │   ├── Header.tsx / BottomNav.tsx
│   │   └── common/
│   ├── context/
│   │   └── AuthContext.tsx          # Supabase Auth session + driver profile
│   ├── data/                        # Bundled seed data (stations, conversion centres)
│   ├── services/
│   │   ├── apiService.ts            # All Supabase reads/writes + local-cache fallback
│   │   └── supabaseClient.ts
│   ├── utils/                       # Formatting, validation, proximity/push logic, etc.
│   ├── types.ts
│   ├── App.tsx                      # App shell, GPS watcher, routing between screens
│   └── main.tsx
├── index.html
├── package.json
└── vite.config.ts
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+
- **npm** v9+

### Installation

```bash
git clone https://github.com/BenjisIdoko/CNG-connect.git
cd CNG-connect
npm install
```

### Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values — it documents each one in detail, including the Supabase dashboard steps needed to make email-OTP sign-in actually deliver a code (disable "Confirm email", set up custom SMTP, edit the email template). At minimum you need:

```env
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_ANON_PUBLIC_KEY"
```

Then, in the Supabase SQL editor, run `supabase/schema.sql` followed by the other `supabase/*.sql` files in the order they were added (each is a self-contained, idempotent migration — safe to re-run).

### Run locally

```bash
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

---

## 🧪 Verification & Testing

```bash
npm test           # Vitest — 498 tests across formatting, validation, proximity/push logic, etc.
npx tsc --noEmit   # TypeScript compiler check
npm run build      # Production build
```

---

## 🌐 Deployment

- **Production**: [cngconnect.com.ng](https://cngconnect.com.ng), hosted on Vercel with DNS on Cloudflare.
- **Deploy**: pushes to `main` auto-deploy via Vercel's GitHub integration.

---

## 📄 License & Acknowledgments

- **Data sourcing**: Refuelling station locations and accredited conversion-workshop registries sourced from the **Presidential CNG & EV Initiative (Pi-CNG / pci.gov.ng)**.
- **License**: MIT.
