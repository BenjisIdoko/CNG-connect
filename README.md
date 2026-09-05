# ⛽ CNG-Connect

> **Nigeria's Premier Compressed Natural Gas (CNG) Driver Platform & Live Station Locator**

[![React](https://img.shields.io/badge/React-19.0-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-purple.svg?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%26%20Realtime-emerald.svg?logo=supabase)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless-black.svg?logo=vercel)](https://vercel.com/)
[![Tests](https://img.shields.io/badge/Tests-45%2F45%20Passed-success.svg)](https://vitest.dev/)

**CNG-Connect** is a high-performance web application built for Nigerian commercial (Bolt, Uber, inDrive) and private drivers transitioning to Compressed Natural Gas (CNG). Developed in support of the Presidential CNG Initiative (Pi-CNG), the platform provides real-time CNG station tracking, crowdsourced pump status and pressure reporting (up to 220 bar), directory of 451 accredited Pi-CNG conversion workshops, an interactive fuel savings & payback ROI calculator, and an AI-powered driver assistant.

---

## 🌟 Key Features

### ⛽ 1. Real-Time CNG Station Tracker & Leaflet Clustering
- **Geocoded Nationwide Data**: Track 90 real geocoded CNG refuelling stations across 28 states (Abuja FCT, Lagos, Ogun, Kano, Edo, Rivers, Delta, Oyo, Kaduna, etc.).
- **High-Density Marker Clustering**: Powered by `leaflet.markercluster` to group dense station markers into numeric badges (`3`, `12`, `25`), dynamically expanding upon zoom.
- **Filter Controls**: Filter stations by pump pressure (0 to 220 bar), distance radius (5km to 50km), and live availability status (*Full Stock*, *Queuing*, *Low Pressure*, *Out of Gas*, *No Recent Reports*).
- **One-Tap Native Navigation**: Deep-links directly to Google Maps, Apple Maps, or Waze (`https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`).

### ⏱️ 2. Human-Readable Station Report Age Copy
- **Age Transparency**: Displays human-readable age text everywhere stations appear (list cards, map drawers, photo carousels, and station details).
- **Clear Copy**: Formats timestamps into unambiguous driver-friendly text:
  - `"Updated Just now"`
  - `"Updated 5 min ago"`
  - `"Updated 2 hrs ago"`
  - `"No recent report"` (when status is unknown or `lastUpdated` is missing/stale like *"Seeded from PCI"*).
- **Trust-First UI**: Green status badges (*Full Stock*) are never rendered without visible report age text.

### ⚡ 3. Fast 1-Tap Driver Status Reporting
- **Driver-Centric UI**: Designed for fast operation by commercial and private Nigerian drivers (~28–70 years old).
- **Large Full-Width Action Buttons**:
  - 🟢 **Full stock (Fast pump)** (`bg-emerald-600`)
  - 🟡 **Long queue / Queuing** (`bg-amber-500`)
  - 🟠 **Low pressure** (`bg-orange-500`)
  - 🔴 **Out of gas** (`bg-rose-600`)
- **Optional Secondary Details**: Optional wait-time stepper, live camera photo capture (anti-fake verification), and driver notes are grouped into an expandable section (`+ Add details`), enabling single-tap submission.
- **Instant Confirmation**: Submitting a report instantly updates local storage and displays a friendly confirmation toast: `"Thanks. Other drivers can see this."`

### 🌐 4. Single Source of Truth Geolocation & Weak Network Resilience
- **Unified Location Engine**: Unified GPS acquisition in `App.tsx` prevents duplicate position watches, minimizes battery drain, and maintains consistent distance & drive time math (`Math.round(distKm * 2.5 + 2) min drive`).
- **Clear Permission State**: When GPS access is denied, displays a clear status notice: `"Turn on location to find nearby stations"`.
- **Reliable Offline Fallback**: Detects weak network connectivity and displays a plain-language banner (`"No network. Showing last known stations."`), persisting cached stations in `localStorage` (`gasfinder_stations_v7`). Automatically refetches and syncs when back online.

### 🛠️ 5. 451 Pi-CNG Accredited Conversion Centers
- Searchable directory of 451 certified conversion centers across Nigeria.
- Filter by LGA, State, or center code (e.g. `LA5137YGK`).
- In-app conversion appointment booking modal for dual-fuel kit installation and cylinder safety testing.

### 💰 6. Interactive Fuel Savings & Payback ROI Calculator
- **Real-Time Savings Simulator**: Calculate exact monthly and annual savings (₦) by adjusting daily driving distance (km/day), petrol vs. CNG prices, and vehicle mileage.
- **Pi-CNG Grant vs. Private Kit**: Toggle between the free Presidential CNG Initiative commercial driver grant (₦0) and private conversion kits (₦750,000) to compute payback period in months.
- **Environmental Impact**: Computes annual CO₂ emissions cut (tons/year).
- Embedded directly into driver profiles and accessible via modal dialogs.

### 📲 7. Passwordless Email Sign-In
- Real accounts via Supabase Auth's email-OTP flow (`signInWithOtp` / `verifyOtp`) — no password, no separate login/signup forms. The same email + 6-digit code either creates a new account or signs back into an existing one.
- Browsing (map, stations, community feed) stays open to guests; writing (reports, comments, likes, station suggestions) requires a verified session, enforced by Postgres RLS, not just the UI.
- A driver's profile (name, vehicle, reputation, points) lives in a `profiles` table keyed to their Supabase Auth user, so it's the same account across devices — not per-browser `localStorage`.

### 💬 8. Driver Community & CNG-Connect AI Guide
- **Live Discussion Forum**: Category-filtered forum (*Maintenance*, *Parts*, *Reviews*, *Deals*, *Conversions*) with photo attachments and upvoting.
- **CNG-Connect AI Guide**: Context-aware AI assistant tracking nationwide pump pressures, wait times, and station recommendations.

---

## 🏗️ Architecture & Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript 5.8 |
| **Build Tool & Bundler** | Vite 6 |
| **Styling & System UI** | TailwindCSS 4 + Vanilla CSS Design Tokens |
| **Map Rendering** | Leaflet 1.9 + `leaflet.markercluster` |
| **Database, Auth & Realtime Sync** | Supabase (PostgreSQL, Auth email-OTP, Realtime Subscriptions, RLS) |
| **Serverless API** | Vercel Serverless Functions (`/api/chat`) |
| **State Management** | React Context (`AuthContext`) |
| **Test Runner** | Vitest 4 |

---

## 📁 Repository Structure

```
CNG-connect/
├── api/                        # Vercel Serverless API Functions
│   └── chat.ts                 # Serverless Gemini AI endpoint
├── scripts/
│   └── seed-stations.ts        # Geocoding & seed generator script
├── src/
│   ├── components/             # UI Components & Modals
│   │   ├── common/
│   │   │   ├── Modal.tsx       # Accessible Modal Primitive (z-[100])
│   │   │   └── ImageWithFallback.tsx
│   │   ├── MapScreen.tsx       # Leaflet Map & Clustered Stations
│   │   ├── StationDetailScreen.tsx # Detailed station specs & live report timeline
│   │   ├── ReportStatusModal.tsx   # Fast 1-Tap Driver Report Modal
│   │   ├── ConversionCentersScreen.tsx # Accredited Workshop Directory
│   │   ├── CngRoiCalculatorModal.tsx # Fuel Savings ROI Calculator
│   │   ├── ProfileScreen.tsx   # Driver Profile & Editable Details
│   │   ├── CommunityScreen.tsx # Driver Forum & Discussion Cards
│   │   ├── AiAssistantModal.tsx# CNG-Connect AI Guide
│   │   ├── Header.tsx          # Top Bar Navigation
│   │   └── BottomNav.tsx       # Floating Bottom Navigation Bar
│   ├── context/                # React Context Providers
│   │   └── AuthContext.tsx     # Supabase Auth session + driver profile
│   ├── data/                   # Seed Data & Mock Sets
│   │   ├── pci-stations-seed.json
│   │   └── pci-conversion-centers-seed.json
│   ├── services/
│   │   ├── apiService.ts       # Supabase Client, Local Cache & Realtime Sync
│   │   └── supabaseClient.ts   # Supabase Client Initialization
│   ├── utils/
│   │   ├── timeUtils.ts        # Human-readable station age formatter
│   │   ├── phoneValidator.ts   # Nigerian phone number validation helper
│   │   └── permissionManager.ts# Presence & live update permission checks
│   ├── types.ts                # TypeScript Interfaces & Models
│   ├── App.tsx                 # Main Application Container & GPS Watcher
│   └── main.tsx                # Entrypoint & Context Provider Wrapping
├── index.html                  # HTML Shell
├── package.json
└── vite.config.ts
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/BenjisIdoko/CNG-connect.git
   cd CNG-connect
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   # Supabase Credentials (also powers sign-in — see .env.example for the
   # dashboard steps needed to make email-OTP delivery actually work:
   # custom SMTP + editing the Magic Link template to send a code)
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

   # Gemini AI Key (Optional for AI Guide)
   GEMINI_API_KEY=your-gemini-api-key
   ```
   See `.env.example` for the full list and setup notes.

4. **Start Local Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3002](http://localhost:3002) in your browser.

---

## 🧪 Verification & Testing

- **Run Automated Unit Tests**:
  ```bash
  npm test
  ```
  *(Executes 45 Vitest unit tests across station age formatting, OTP services, proximity alert engine, permissions, and phone validation).*

- **Run TypeScript Compiler Check**:
  ```bash
  npx tsc --noEmit
  ```

- **Build for Production**:
  ```bash
  npm run build
  ```

---

## 🌐 Live Production Deployment

The platform is deployed and hosted on Vercel:

- **Production URL**: [https://cng-connect.vercel.app](https://cng-connect.vercel.app)
- **Deployment Command**: `npx vercel --prod`

---

## 📄 License & Acknowledgments

- **Data Sourcing**: Geocoded refuelling station locations and accredited conversion workshop registries sourced from the **Presidential CNG Initiative (Pi-CNG / pci.gov.ng)**.
- **License**: MIT License.
