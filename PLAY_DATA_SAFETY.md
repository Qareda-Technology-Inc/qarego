# Google Play: Data safety and App content answers

Answers for Play Console → **Policy and programs → App content**, worked out from the code and
matching the live privacy policy at https://www.qarego.com/privacy. If the app starts collecting
something new, update this file, the privacy page and the Play form together.

## Privacy policy

- Privacy policy URL: `https://www.qarego.com/privacy`

## Data safety: overview questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (the API, uploads and maps all use HTTPS) |
| Which of the following methods of account creation does your app support? | **Username and other authentication** → phone number with a one-time SMS code |
| Do you provide a way for users to request that their data is deleted? | **Yes** |
| Delete account URL | `https://www.qarego.com/delete-account` (in the app: Account → Delete Account) |

**Shared: answer "No" for every data type.** Play does not count these as sharing:
- service providers that process data for QareGO (Render, Vercel, Google Maps, Firebase,
  Cloudinary, Arkesel, Hubtel);
- data passed to another user because the user asked for it (the rider or store fulfilling a
  booking sees the customer's name, phone and address).

QareGO has no ads, no analytics SDK and no advertising ID, and sells nothing.

## Data safety: data types

For every row below: **Collected = Yes, Shared = No, Processed ephemerally = No.** "Required"
means the app can't be used without it; "Optional" means the user can choose not to give it.

| Play category → data type | Required or optional | Purposes to tick | What it is in QareGO |
|---|---|---|---|
| Location → **Approximate location** | Required | App functionality | Nearby stores and riders, pickup suggestions |
| Location → **Precise location** | Required | App functionality | Pickup point, prices, live tracking; riders' live position on duty. Foreground only, no background location |
| Personal info → **Name** | Required | App functionality, Account management | Shown to the rider or store on a booking |
| Personal info → **Email address** | Optional | Account management | Optional profile field |
| Personal info → **Phone number** | Required | App functionality, Account management, Fraud prevention, security and compliance | Sign-in with an SMS code; contact between rider, customer and store; a parcel recipient's number |
| Personal info → **Address** | Required | App functionality | Pickup, drop-off and delivery addresses |
| Personal info → **Other info** | Optional (riders only) | App functionality, Fraud prevention, security and compliance | Rider date of birth, gender, licence number, national ID and police clearance, used to approve riders |
| Financial info → **Purchase history** | Required | App functionality, Account management | Trips and orders, prices, fees and payment status |
| Financial info → **Other financial info** | Required for riders | App functionality, Account management | Rider earnings, commission balance and payouts; whether a customer chose cash or mobile money. No card numbers, no MoMo PIN |
| Health and fitness → **Health info** | Optional | App functionality | Pharmacy items ordered and prescription photos |
| Messages → **Other in-app messages** | Optional | App functionality | Chat between customer and rider during a trip |
| Photos and videos → **Photos** | Optional | App functionality | Profile photo, parcel photo, prescription, rider documents. Only photos the user picks or takes |
| App activity → **Other user-generated content** | Optional | App functionality | Ratings and comments, parcel descriptions and notes |
| Device or other IDs → **Device or other IDs** | Required | App functionality | Push notification token (FCM / Expo) |

**Leave unticked:** Race and ethnicity, Political or religious beliefs, Sexual orientation,
User payment info, Credit score, Fitness info, Emails, SMS or MMS, Videos, Audio, Files and docs,
Calendar, Contacts, App interactions, In-app search history, Installed apps, Other actions,
Web browsing, Crash logs, Diagnostics, Other app performance data.

Notes on the edge cases:
- **Address search text** goes to Google Places to suggest addresses and is not stored by
  QareGO beyond the address the user picks, so it is covered by "Address" and "Precise location".
- **IP address and app version** are only in server request handling and logs, used to run and
  secure the service. Play does not ask for these as a separate type.
- **No crash reporting SDK** is in the app. If Sentry or Crashlytics is added later, tick
  Crash logs and Diagnostics.
- **Payment info:** card numbers and MoMo PINs are never collected. When mobile money returns,
  the MoMo number goes to the payment provider. Review "User payment info" at that point.

## Other App content declarations

| Section | Answer |
|---|---|
| Ads | **No**, the app doesn't contain ads |
| App access | **All or some functionality is restricted**. Give the review logins: customer `22222222`, rider `11111111` (8 digits; the review OTPs are in the review login config). Say that the rider account is pre-approved |
| Target audience | **18 and over** only (the Terms of Service require users to be 18+) |
| Content rating | Answer the IARC questionnaire: users can communicate (in-trip chat), the app shares location with other users (live tracking), there's no gambling or violence. Pharmacy orders: mention that medicines are sold by licensed pharmacies |
| News app | No |
| Health apps | Choose **"My app doesn't have any health features"** unless Play flags pharmacy ordering; if it does, pick "Medication and treatment management" only as an ordering service, no medical advice |
| Financial features | **None**. Riders' cash collection isn't a financial product |
| Government apps | No |
| Location permission | Foreground only. No background location declaration is needed |
| Photo and video permissions | Not needed. The app uses the system photo picker, and the release build strips `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` |
| Data deletion | Already covered by the delete-account URL above |

## Permissions in the release build

These come from `app.base.json` → `android.permissions`. The `withStripPhotoPermissions` plugin
plus `blockedPermissions` remove storage, SMS, call log and phone-state permissions.

- `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`: foreground location
- `CAMERA`: taking a photo when the user chooses to
- `POST_NOTIFICATIONS`: trip offers and order updates
- `INTERNET`, `VIBRATE`, `MODIFY_AUDIO_SETTINGS`: networking, the offer alert and its sound

`SYSTEM_ALERT_WINDOW` (draw over other apps) is in `blockedPermissions`. It stays only in debug builds, for React Native's dev menu.
