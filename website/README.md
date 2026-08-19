# QareGO launch website

Marketing site for the QareGO app launch — App Store & Google Play download CTAs.

## Run locally

```bash
cd website
cp .env.example .env   # then paste real store URLs
npm install
npm run dev
```

Open **http://localhost:5173**.

## Configure store links

Edit `website/.env`:

```env
VITE_APP_STORE_URL=https://apps.apple.com/app/idXXXXXXXX
VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.qarego.client
VITE_STORES_LIVE=true
```

## Build & host

```bash
npm run build
```

Static output is in `dist/`. Deploy that folder to Vercel, Netlify, Cloudflare Pages, or any static host.

Example (Vercel from repo root):

```bash
cd website && npx vercel
```
