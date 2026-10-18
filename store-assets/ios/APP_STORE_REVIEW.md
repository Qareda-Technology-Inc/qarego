# App Store Connect: what to fill in for review

Bundle ID `com.qarego.client`, version 1.0.5. Upload the screenshots in this folder to
**iPhone 6.3" display** (1206 × 2622). Order them as numbered: 01 customer home, 02 choose a
ride, 03 live tracking, 04 food, 05 cooking gas, 06 rider offer, 07 rider trip. Upload
`header_3840x1646.png` as the header asset.

The app also runs on iPad, so upload `ipad_01_home.png`, `ipad_02_ride.png` and
`ipad_03_gas.png` to **iPad 13" display** (2064 × 2752). Select build **25** or later: it
fixes text that was clipped on iPad.

## App Review Information

**Sign-in required:** Yes.

| Field | Value |
|---|---|
| User name | `22222222` |
| Password | `0000` |

**Notes** (paste this):

> QareGO is a ride-hailing, delivery and cooking gas app for Ghana. Sign-in is by phone number
> with a one-time SMS code. These review numbers skip the SMS:
>
> Customer account: phone 22222222 (code 0000 if asked).
> Rider account: phone 11111111 (code 1111 if asked).
> Type the 8 digits exactly on the sign-in screen (the +233 country code is already selected).
> To switch account, open the menu and tap Log out.
>
> The rider account is pre-approved, so it can go on duty and receive offers. Booking a ride
> as the customer sends an offer to riders who are on duty near the pickup point in Accra;
> outside our service area the app says the service isn't available there yet.
>
> Payment is cash on delivery; there are no in-app purchases or digital goods. Mobile money
> is shown as "coming soon".
>
> Location is used only while the app is open. Account deletion: Account → Delete Account.

## App Privacy (privacy nutrition labels)

- Privacy policy URL: `https://www.qarego.com/privacy`
- **Do you or your third-party partners collect data from this app?** Yes.
- **Tracking:** answer **No** for every data type. There are no ads, no advertising ID and no
  data brokers, and the App Tracking Transparency prompt is not needed.

For every type below choose **Linked to the user = Yes** and **Used for tracking = No**.

| Category → type | Purposes |
|---|---|
| Contact info → **Name** | App Functionality |
| Contact info → **Email address** (optional) | App Functionality |
| Contact info → **Phone number** | App Functionality |
| Contact info → **Physical address** | App Functionality |
| Health & fitness → **Health** (pharmacy orders, prescription photos) | App Functionality |
| Location → **Precise location** | App Functionality |
| Location → **Coarse location** | App Functionality |
| Financial info → **Other financial info** (rider earnings and balance, cash or MoMo choice) | App Functionality |
| Purchases → **Purchase history** (trips and orders) | App Functionality |
| User content → **Photos or videos** (profile, parcel, prescription, rider documents) | App Functionality |
| User content → **Customer support / Other user content** (ratings, parcel notes) | App Functionality |
| User content → **Emails or text messages** → in-app chat between customer and rider | App Functionality |
| Identifiers → **User ID** | App Functionality |
| Identifiers → **Device ID** (push notification token) | App Functionality |
| Sensitive info → **Sensitive info** (rider national ID, licence, police clearance) | App Functionality |

Do **not** tick: Payment info, Credit info, Contacts, Browsing history, Search history,
Audio data, Gameplay content, Advertising data, Product interaction, Crash data,
Performance data, Other diagnostic data, Fitness.

## Other fields

| Field | Answer |
|---|---|
| Age rating | Questionnaire: no violence, sexual content, gambling or horror. Mention "Medical/treatment information": **None** (QareGO doesn't give medical advice; pharmacies sell medicines). Unrestricted web access: **No**. User-generated content / messaging: in-trip chat between customer and rider. Result should be 17+ only if Apple's answers require it. The Terms say 18+, so set **Age Rating Override → 18+** if offered |
| Category | Primary **Travel**, secondary **Food & Drink** |
| Support URL | `https://www.qarego.com` |
| Marketing URL | `https://www.qarego.com` |
| Copyright | `2026 Qaretech` |
| Export compliance | `ITSAppUsesNonExemptEncryption = false` is already in the build, so no question is asked |
| Content rights | No third-party content that needs rights |
| Sign in with Apple | Not required: QareGO only signs in with a phone number, no third-party login |
| Account deletion | In the app: Account → Delete Account (also at `https://www.qarego.com/delete-account`) |

## Description (suggested)

**Subtitle (30 chars max):** `Rides, food, parcels & gas`

**Promotional text:**
> Book a motorbike, Pragya or car, order food and groceries, send parcels and get your gas
> cylinder refilled, all in one app.

**Description:**
> QareGO gets you where you're going and brings what you need, across Ghana.
>
> RIDES: Book a motorbike, Pragya or car. See the fare before you confirm, then follow your
> rider live on the map. Share your 4-digit code only when your rider arrives.
>
> FOOD, GROCERIES & PHARMACY: Order from restaurants, shops and pharmacies near you and track
> your delivery to the door. Pharmacy orders take a prescription photo when one is needed.
>
> PARCELS: Send or receive a package across town, with a code so it reaches the right person.
>
> COOKING GAS: Refill your cylinder or swap it for a full one. We collect, refill and bring it
> back.
>
> PAY ON DELIVERY: Pay in cash when your trip ends or your order arrives.
>
> RIDE WITH QAREGO: Riders see what they will earn before accepting an offer, then get
> step-by-step pickup and drop-off with navigation and a delivery code.

**Keywords (100 chars max):**
`ride,okada,pragya,taxi,delivery,food,parcel,courier,gas,lpg,grocery,pharmacy,accra,ghana`
