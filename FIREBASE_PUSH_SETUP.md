# Firebase FCM push (iOS + Android)

One **Firebase project** powers both platforms. You register **two apps** in that project and download **two different config files**. The **server** uses **one** service-account JSON to send pushes to both.

```
Firebase project (e.g. qarego-prod)
├── Android app  → google-services.json      → client/google-services.json
├── iOS app      → GoogleService-Info.plist  → client/GoogleService-Info.plist
└── Service account JSON                     → server/firebase-service-account.json
```

---

## Step 1 — Create / open Firebase project

1. [Firebase Console](https://console.firebase.google.com/) → create or select a project.
2. **Build** → **Cloud Messaging** is included by default.

---

## Step 2 — Android: `google-services.json`

1. **Project settings** (gear) → **Your apps** → **Add app** → **Android**.
2. **Android package name:** `com.qarego.client` (must match `client/app.json` → `android.package`).
3. Skip SHA-1 for now unless you use Google Sign-In.
4. **Register app** → **Download google-services.json**.
5. Save as:

   ```
   client/google-services.json
   ```

6. **Regenerate native Android project** (required — `ExpoPushTokenManager` only exists after this):

   ```bash
   cd client
   npx expo prebuild --platform android --clean
   npx expo run:android --device
   ```

   Or one command: `npm run android:rebuild`

   **Important:** Uninstall the old QareGO app from your phone first, then install the new build. Metro reload alone is not enough.

You do **not** use this file on iOS.

---

## Step 3 — iOS: `GoogleService-Info.plist`

iOS uses a **different** file (not `google-services.json`).

1. Same Firebase project → **Add app** → **Apple**.
2. **Apple bundle ID:** `com.qarego.client` (must match `client/app.json` → `ios.bundleIdentifier`).
3. **Register app** → **Download GoogleService-Info.plist**.
4. Save as:

   ```
   client/GoogleService-Info.plist
   ```

5. **APNs for FCM on iOS** (required for real devices):
   - [Apple Developer](https://developer.apple.com/) → Keys → create an **APNs** key (.p8).
   - Firebase → **Project settings** → **Cloud Messaging** → **Apple app configuration**.
   - Upload the **APNs Authentication Key** (.p8), plus **Key ID** and **Team ID**.

6. Rebuild iOS:

   ```bash
   cd client
   npx expo run:ios
   ```

---

## Step 4 — Server (send pushes to both platforms)

One service account sends FCM to Android and iOS tokens.

1. Firebase → **Project settings** → **Service accounts** → **Generate new private key**.
2. Save as `server/firebase-service-account.json` (gitignored).

In `server/.env`:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

Restart API — expect:

```text
[push] Firebase Cloud Messaging enabled
```

---

## Admin: edit push message templates

In the **admin dashboard** → **Push notifications**, you can customize every FCM title/body (ride offers, food order updates, test push). Use placeholders like `{{restaurantName}}`, `{{fare}}`, `{{pickup}}`.

Changes apply within ~15 seconds (server cache). Disabled templates are not sent.

API (admin auth):

- `GET /admin/push-templates`
- `PATCH /admin/push-templates` — body `{ "templates": { "food_placed": { "title": "...", "body": "...", "enabled": true } } }`
- `POST /admin/push-templates/preview` — body `{ "key", "title", "body", "variables": {} }`

---

## Step 5 — Verify in the app

1. Install the **development build** on a **physical device** (simulator push is limited).
2. Log in as a **rider**, allow notifications.
3. **Account** → **Test push notification**.
4. Check API logs / `POST /notifications/test` response.

When offers are dispatched, riders also get **“New trip offer”** / **“New delivery offer”** FCM messages.

---

## End-to-end test: food order → rider + customer push

### Prerequisites

1. API running (`cd server && npm start`) — log shows `[push] Firebase Cloud Messaging enabled`.
2. **Customer** and **rider** dev builds installed, each logged in once, notifications allowed (`[push] FCM registered firebase=true` in Metro).
3. **Merchant** kitchen open (`cd merchant && npm run dev`), logged in as the restaurant’s merchant.
4. Rider: **ON-DUTY**, **Food** enabled (Work mode / services — motorcycle).

### Flow

| Step | Who | Action | Push / in-app |
|------|-----|--------|----------------|
| 1 | Customer | Place food order (delivery) | Customer: **Order placed** |
| 2 | Merchant | Orders → **Accept** | Customer: **Order confirmed** |
| 3 | Merchant | **Mark ready** (broadcast) | Customer: **Finding a driver** · Rider(s): **New delivery offer** |
| 4 | Rider | Accept offer on home screen | Customer: **Driver assigned** |
| 5 | Rider | Arrive → start delivery → complete with customer **delivery code** | Customer: **On the way** → **Delivered** |

Rider must be **on duty**, **Food** on, and eligible (active driver, motorcycle). If no offer appears, check another rider isn’t closer or Food is paused in rider settings.

### Quick checks

- Rider **Account → Test push** still works.
- Server logs: no `[push] … notify failed` lines during the flow.
- Customer order screen (`/customer/food/order/[id]`) updates live via socket even if push is delayed.

---

## Quick reference

| Platform | Firebase console app type | File you download | Path in repo |
|----------|---------------------------|-------------------|--------------|
| Android  | Android                   | `google-services.json` | `client/google-services.json` |
| iOS      | Apple (iOS)               | `GoogleService-Info.plist` | `client/GoogleService-Info.plist` |
| Server   | (service account)         | `*-firebase-adminsdk-*.json` | `server/firebase-service-account.json` |

`client/app.config.js` resolves both files locally and on **EAS Build** (TestFlight / Play Store).

After adding or changing either file locally, run **`npx expo prebuild --clean`** or **`npx expo run:android` / `run:ios`** so native projects pick them up.

---

## EAS Build / TestFlight (files are gitignored)

`GoogleService-Info.plist` and `google-services.json` are **not** committed to git (secrets). EAS Build only uploads tracked files, so you must upload them as **EAS file environment variables** once.

### One-time setup (from `client/`)

1. Ensure your real Firebase files exist locally:
   - `client/GoogleService-Info.plist`
   - `client/google-services.json`

2. Upload to EAS (production + preview):

   ```bash
   cd client
   npm run eas:firebase-env
   ```

   Or manually:

   ```bash
   eas env:create --name GOOGLE_SERVICE_INFO_PLIST --type file --value ./GoogleService-Info.plist --environment production --visibility secret
   eas env:create --name GOOGLE_SERVICE_INFO_PLIST --type file --value ./GoogleService-Info.plist --environment preview --visibility secret
   eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production --visibility secret
   eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment preview --visibility secret
   ```

3. Build for TestFlight:

   ```bash
   eas build --platform ios --profile production
   ```

4. Submit:

   ```bash
   eas submit --platform ios --profile production
   ```

If a build fails with “GoogleService-Info.plist is missing”, the env vars were not created for that profile’s environment (`production` or `preview`).

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| No FCM token on Android | `google-services.json` present, package `com.qarego.client`, rebuild. |
| No FCM token on iOS | `GoogleService-Info.plist` present, bundle `com.qarego.client`, APNs key in Firebase, rebuild. |
| EAS prebuild: plist missing | Run `npm run eas:firebase-env` from `client/` (see **EAS Build / TestFlight** above). |
| Server won’t send | `FIREBASE_SERVICE_ACCOUNT_PATH` set, `[push] Firebase … enabled` in API logs. |
| Test push fails | Logged in, notification permission granted, token in DB (`pushTokens` on user). |

See also: `client/google-services.json.example` (structure only — download the real file from Firebase).
