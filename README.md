# ⛽ CNG-Connect

> **Nigeria's Premier Compressed Natural Gas (CNG) Driver Platform & Live Station Locator**

[![React](https://img.shields.io/badge/React-19.0-blue.svg?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-purple.svg?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%26%20Realtime-emerald.svg?logo=supabase)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless-black.svg?logo=vercel)](https://vercel.com/)
[![Tests](https://img.shields.io/badge/Tests-39%2F39%20Passed-success.svg)](https://vitest.dev/)

**CNG-Connect** is a high-performance web and mobile web application built for Nigerian commercial and private drivers transitioning to Compressed Natural Gas (CNG). Developed to support the Presidential CNG Initiative (Pi-CNG), the platform provides real-time CNG station tracking, crowdsourced pump pressure reporting (up to 220 bar), directory of 451 accredited Pi-CNG conversion workshops, an interactive fuel savings & payback ROI calculator, and an AI-powered driver assistant.

---

## 🌟 Key Features

### ⛽ 1. Real-Time CNG Station Tracker & Leaflet Clustering
- **Geocoded Nationwide Data**: Track 90 real geocoded CNG refuelling stations across 28 states (Abuja FCT, Lagos, Ogun, Kano, Edo, Rivers, Delta, Oyo, Kaduna, etc.).
- **High-Density Marker Clustering**: Powered by `leaflet.markercluster` to group dense station markers into numeric badges (`3`, `12`, `25`), dynamically expanding upon zoom.
- **Filter Controls**: Filter stations by pump pressure (0 to 220 bar), distance radius (5km to 50km), and live availability status (*Full Stock*, *Queuing*, *Low Pressure*, *Out of Gas*, *No Recent Reports*).
- **One-Tap Native Navigation**: Deep-links directly to Google Maps, Apple Maps, or Waze (`https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`).

### 🛠️ 2. 451 Pi-CNG Accredited Conversion Centers
- Searchable directory of 451 certified conversion centers across Nigeria.
- Filter by LGA, State, or center code (e.g. `LA5137YGK`).
- In-app conversion appointment booking modal for dual-fuel kit installation and cylinder safety testing.

### 💰 3. Interactive Fuel Savings & Payback ROI Calculator
- **Real-Time Savings Simulator**: Calculate exact monthly and annual savings (₦) by adjusting daily driving distance (km/day), petrol vs. CNG prices, and vehicle mileage.
- **Pi-CNG Grant vs. Private Kit**: Toggle between the free Presidential CNG Initiative commercial driver grant (₦0) and private conversion kits (₦750,000) to compute payback period in months.
- **Environmental Impact**: Computes annual CO₂ emissions cut (tons/year).
- Embedded directly into driver profiles and accessible via modal dialogs.

### 📲 4. Serverless SMS OTP & Rate-Limited Security
- Serverless authentication powered by `/api/otp/send` and `/api/otp/verify`.
- SMS OTP dispatches via Termii and Africa's Talking API gateways.
- **Rate-Limiting & Cooldown**: Strict 60-second cooldown per phone number returning HTTP 429 (`Too Many Requests`) to prevent SMS credit depletion.

### 🔔 5. Geofenced Proximity Alerts & Offline Resilience
- **Automated Geofence Nudges**: Triggers location nudges when a driver arrives within 800m of a stale station needing a status report.
- **Offline Caching & PWA**: Persists station data in `localStorage` (`gasfinder_stations_v7`) with automated offline banner detection (`!navigator.onLine`).

### 💬 6. Driver Community & CNG-Connect AI Guide
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
| **Database & Realtime Sync** | Supabase (PostgreSQL, Realtime Subscriptions, RLS) |
| **Serverless API** | Vercel Serverless Functions (`/api/otp/*`, `/api/chat`) |
| **State Management** | React Context (`AuthContext`, `StationContext`) |
| **Test Runner** | Vitest 4 |

---

## 📁 Repository Structure

```
CNG-connect/
├── api/                        # Vercel Serverless API Functions
│   ├── chat.ts                 # Serverless Gemini AI endpoint
│   ├── otp/
│   │   ├── send.ts             # SMS OTP dispatch with 60s rate limiting
│   │   ├── verify.ts           # OTP verification handler
│   │   └── store.ts            # Persistent session store
├── scripts/
│   └── seed-stations.ts        # Geocoding & seed generator script
├── src/
│   ├── components/             # UI Components & Modals
│   │   ├── common/
│   │   │   ├── Modal.tsx       # Accessible Modal Primitive (z-[100])
│   │   │   └── ImageWithFallback.tsx
│   │   ├── MapScreen.tsx       # Leaflet Map & Clustered Stations
│   │   ├── StationDetailScreen.tsx
│   │   ├── ConversionCentersScreen.tsx
│   │   ├── CngRoiCalculatorModal.tsx # Fuel Savings ROI Calculator
│   │   ├── ProfileScreen.tsx   # Driver Profile & Editable Details
│   │   ├── CommunityScreen.tsx # Driver Forum & Discussion Cards
│   │   ├── AiAssistantModal.tsx# CNG-Connect AI Guide
│   │   ├── Header.tsx          # Top Bar Navigation
│   │   └── BottomNav.tsx       # Floating Bottom Navigation Bar
│   ├── context/                # React Context Providers
│   │   ├── AuthContext.tsx     # Driver Auth State & Profile
│   │   └── StationContext.tsx  # Live Stations & Supabase Realtime Sync
│   ├── data/                   # Seed Data & Mock Sets
│   │   ├── pci-stations-seed.json
│   │   └── pci-conversion-centers-seed.json
│   ├── services/
│   │   ├── apiService.ts       # Supabase Client & Realtime Sync
│   │   ├── otpService.ts       # Client OTP API Service
│   │   └── supabaseClient.ts   # Supabase Client Initialization
│   ├── types.ts                # TypeScript Interfaces & Models
│   ├── App.tsx                 # Main Application Container
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
   # Supabase Credentials
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

   # SMS OTP Provider Keys (Optional for serverless production SMS)
   TERMII_API_KEY=your-termii-api-key
   TERMII_SENDER_ID=CNGConnect

   # Gemini AI Key (Optional for AI Guide)
   GEMINI_API_KEY=your-gemini-api-key
   ```
   *Note: If no SMS API key is provided, the backend automatically operates in Key-Gated Dev Mode returning test code `123456`.*

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
  *(Executes 39 Vitest unit tests across OTP services, proximity alert engine, permissions, and phone validation).*

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
