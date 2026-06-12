# QareGO

Multi-service mobility and commerce platform for Ghana — ride-hailing, food/grocery/pharmacy delivery, and parcel delivery. One mobile app serves **customers** and **riders**; separate web apps serve **merchants** (kitchen/store) and **platform admins**.

## Repository structure

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `client/` | Expo (React Native), Expo Router | Customer & rider mobile app (Android / iOS) |
| `server/` | Node.js, Express, Socket.IO, MongoDB | REST API, real-time events, payments webhooks |
| `admin/` | Next.js | Operations dashboard — drivers, trips, vendors, dispatch, finance |
| `merchant/` | Next.js | Store portal — menu, live orders, kitchen alerts, settings |

Each app has its own `package.json`. Install and run them independently.

## What the platform does

**Customers** book rides, order from restaurants/stores, send parcels, track deliveries live, and pay cash or mobile money.

**Riders** accept ride and delivery offers, navigate with maps, earn per trip, top up balance (Hubtel), and view earnings analytics.

**Merchants** manage menus, accept/reject orders, mark orders ready, assign riders, and pause order intake.

**Admins** onboard drivers and vendors, configure fares and fees, monitor dispatch, run payouts, and send notifications.

Commerce verticals: **Food**, **Grocery**, and **Pharmacy** (configured via store types in admin).

## Prerequisites

- **Node.js** 18+ and npm
- **MongoDB** (local or Atlas)
- **Google Maps** API key (Maps JavaScript, Directions, Places — restrict by app/platform)
- **Android Studio** / Xcode for native mobile builds (optional for Expo Go dev)
- Optional integrations: **Cloudinary** (images), **Firebase** (push), **Hubtel** (MoMo), **Arkasel** (SMS)

## Local development

### 1. API server

```bash
cd server
cp .env.example .env
npm install
```

Edit `server/.env`:

- `MONGO_URI` — MongoDB connection string
- `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` — strong random strings
- `PORT=2026` — local convention used across admin, merchant, and client
- `ADMIN_ORIGIN=http://localhost:3000`
- `MERCHANT_ORIGIN=http://localhost:3001`

Create the first admin user:

```bash
node seedAdmin.js
```

Start the API:

```bash
npm run dev
```

Health check: `http://127.0.0.1:2026/health`

### 2. Admin dashboard

```bash
cd admin
cp .env.example .env   # if present; otherwise see merchant/.env.example pattern
npm install
npm run dev
```

Open **http://localhost:3000**. Browser requests go to `/api/*`, which Next.js proxies to the backend (`API_PROXY_TARGET`, default `http://127.0.0.1:2026`).

### 3. Merchant portal

```bash
cd merchant
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:3001**. Same `/api` proxy pattern as admin.

For kitchen tablets on Wi‑Fi, set `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_SOCKET_URL` to your machine’s LAN IP (e.g. `http://192.168.1.10:2026`).

### 4. Mobile app

```bash
cd client
cp .env.example .env
npm install
npm start
```

- `EXPO_PUBLIC_APP_ENV=development` — auto-discovers local API (USB / LAN)
- `EXPO_PUBLIC_MAP_API_KEY` — JS maps (Places, geocoding)
- `GOOGLE_API_KEY` — native map tiles (`react-native-maps`)

For a physical Android device with a local server:

```bash
npm run android:device
```

For cloud API testing:

```bash
npm run start:cloud
```

Set `EXPO_PUBLIC_PRODUCTION_API_URL` in `.env` or EAS env.

## Environment variables

| App | File | Key settings |
|-----|------|--------------|
| Server | `server/.env` | `MONGO_URI`, JWT secrets, `PORT`, CORS origins, Cloudinary, Firebase, Hubtel, Arkasel |
| Admin | `admin/.env` | `API_PROXY_TARGET`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Merchant | `merchant/.env` | `API_PROXY_TARGET`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SOCKET_URL`, Maps, Firebase (optional web push) |
| Client | `client/.env` | `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_MAP_API_KEY`, `GOOGLE_API_KEY`, `EXPO_PUBLIC_PRODUCTION_API_URL` |

Copy from each directory’s `.env.example` — never commit real `.env` files.

## Production deployment (reference)

Typical layout:

| Component | Hosting | Notes |
|-----------|---------|-------|
| API | Render (or similar) | Set `ADMIN_ORIGIN` / `MERCHANT_ORIGIN` to Vercel URLs |
| Admin | Vercel | `API_PROXY_TARGET` → production API URL |
| Merchant | Vercel | Same three vars: `API_PROXY_TARGET`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SOCKET_URL` |
| Mobile | EAS Build | Preview/production profiles; set API URL and Firebase file secrets on EAS |

After changing `NEXT_PUBLIC_*` on Vercel, **redeploy** — those values are baked at build time.

Example production API: `https://qarego.onrender.com`

## Order pricing (who sees what)

| Party | Amount shown |
|-------|----------------|
| Customer | Full checkout: food + platform service fee + delivery |
| Merchant | **Food subtotal only** (menu items) — not delivery or platform fees |
| Rider | Delivery fare / ride fare (gross and net after commission) |

Merchant dashboard revenue aggregates use food subtotal, consistent with other delivery platforms.

## Additional docs

- [`FIREBASE_PUSH_SETUP.md`](FIREBASE_PUSH_SETUP.md) — FCM for iOS, Android, and merchant web
- [`server/HUBTEL_SETUP.md`](server/HUBTEL_SETUP.md) — driver top-up and weekly payouts
- [`server/ARKASEL_SETUP.md`](server/ARKASEL_SETUP.md) — SMS alerts to merchants

## Tech stack

- **Mobile:** Expo SDK 52, React Native, Expo Router, Socket.IO client, react-native-maps
- **Web:** Next.js 16, React 19, Tailwind CSS 4
- **Backend:** Express, Mongoose, Socket.IO, JWT auth, geolib, multer / Cloudinary

---

Built by QareGO / Qaretech.
