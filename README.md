# ⛽ CNG-Connect

> **Nigeria's Premier Compressed Natural Gas (CNG) Driver Platform & Live Station Locator**

[![React](https://img.shields.io/badge/React-19-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple.svg?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2C%20Auth%20%26%20Storage-emerald.svg?logo=supabase)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless-black.svg?logo=vercel)](https://vercel.com/)
[![Tests](https://img.shields.io/badge/Tests-87%2F87%20Passed-success.svg)](https://vitest.dev/)

**CNG-Connect** is a driver-facing PWA built for Nigerian commercial (Bolt, Uber, inDrive) and private drivers running on Compressed Natural Gas. Built in support of the Presidential CNG & EV Initiative (Pi-CNG), it provides a live, crowdsourced map of CNG refuelling stations, a directory of accredited conversion centres, a fuel-savings calculator, a driver community, and an internal toolset for keeping the underlying station data accurate.

**Live**: [cngconnect.com.ng](https://cngconnect.com.ng)

---

## 🌟 Driver-Facing Features

### ⛽ Live Station Map
- Crowdsourced CNG station tracker across Nigeria, rendered on a Leaflet map with marker clustering for dense areas.
- Filter by pump pressure, distance radius, and live availability (*Full Stock*, *Queuing*, *Low Pressure*, *Out of Gas*).
- One-tap turn-by-turn navigation via Google Maps, Apple Maps, or Waze.
- Every station shows a plain-language report age (`"Updated 5 min ago"`, `"No recent report"`) so drivers know how fresh a status actually is.

### 📍 Proximity Alerts
- Background location watch detects when a driver is near a station they'd want to know about, and surfaces a push notification/in-app banner — the point being drivers find out about a nearby restock without needing to have the app open.

### ⏱️ Fast Driver Status Reporting
- One-tap status buttons (Full stock / Queuing / Low pressure / Out of gas) with optional wait-time, live camera photo attachment, and notes.
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

- **`/?admin=1` — Admin dashboard.** Gated on an `is_admin` flag. Lets an admin drag a station's map pin to correct its location, edit every field on a station (name, address, hours, pricing, photos — uploaded straight to Supabase Storage), bulk-import corrections from a CSV spreadsheet, and bulk-delete stations.
- **`/?manager=1` — Station manager.** A lighter role: an admin can assign a specific driver's email to one or more specific stations, and that driver can then sign in to edit only those station(s)' details (pricing, hours, photos, contact info) — without seeing or touching any other station.

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
| **Test Runner** | Vitest (87 tests) |

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
npm test           # Vitest — 87 tests across formatting, validation, proximity/push logic, etc.
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
