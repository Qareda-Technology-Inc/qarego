# App Review reply (Guideline 2.1 - Information Needed)

Paste the text below in two places in App Store Connect:
1. As your reply in the App Review message thread (attach the screen recording there).
2. In App Information → App Review Information → Notes.

---

Hello App Review team,

Thank you for reviewing QareGO. Please find the requested information below. The screen recording is attached to this reply.

1. SCREEN RECORDING
The attached recording was captured on a physical iPhone running the latest iOS. It starts with launching the app and shows signing in, booking a ride, ordering from a store, requesting cooking gas, booking a laundry pickup, sending a parcel, the rider side of the app, reporting a chat, and deleting the account (Account → Delete my account).

2. PURPOSE AND TARGET AUDIENCE
QareGO is an on-demand ride and delivery app for Ghana. In one app, customers can:
- book a motorbike, Pragya (tricycle) or car ride
- order food, groceries and medicine from local restaurants, shops and pharmacies
- send parcels across town
- get cooking gas cylinders refilled or exchanged
- have laundry collected, washed and returned

It serves people in Ghanaian cities who today depend on phone calls, walking to vendors or informal arrangements for these everyday needs. The same app is used by independent riders, who go on duty, accept trips and earn money. Local businesses manage their orders through a separate web portal.

3. HOW TO ACCESS THE APP
No SMS code is needed for the demo accounts below. The +233 (Ghana) country code is already selected.

Customer account:
- Open the app and enter phone number 22222222, then tap Continue.
- From the home screen you can book a ride ("Where to?"), open Food, Grocery, Pharmacy, Cooking gas, Laundry or Parcel, and track orders.

Rider account:
- Sign out (Account → Log out), enter phone number 11111111, then tap Continue.
- Tap "Go on duty" to receive trip offers and see trip earnings.

Account deletion: Account → Delete my account (available for both account types).

User-generated content: the only user-generated content is the short text chat between a customer and their rider during an active trip. Either person can tap the flag icon at the top of the chat to report the other for abusive messages, harassment, safety concerns or spam. The report and a copy of the chat go to our support team, who review every report in our admin portal and can suspend the account. The chat closes when the trip ends, so the two people can no longer message each other.

Location: the app asks for location access to show nearby stores and riders and set pickup points. Stores and riders are in Ghana, so from outside Ghana you can choose a Ghana address manually on the map.

Payment: orders can be paid in cash on delivery, so no payment details are needed to test. Mobile money and card payments go through Paystack. All purchases are for physical goods and services delivered in the real world, so In-App Purchase does not apply (Guideline 3.1.3(e)).

4. EXTERNAL SERVICES
- Paystack: mobile money and card payments, refunds and rider payouts
- Google Maps Platform: maps, address search, routes and distance for fares
- Firebase Cloud Messaging and Apple Push Notification service: order and trip notifications
- Arkasel: SMS one-time sign-in codes
- Render: hosts our API server
- MongoDB: database
- Vercel: hosts the web portal for businesses and our admin team

5. REGIONAL DIFFERENCES
QareGO operates only in Ghana. Prices are in Ghana cedis (GHS), sign-in uses Ghana phone numbers, and stores and riders are in Ghana. The app works the same everywhere, but outside Ghana there are no nearby stores or riders to serve orders.

6. REGULATED SERVICES
[Fill in with your real documents before sending, see notes below.]
- QareGO is operated by [registered company name], registered in Ghana under [registration number].
- Pharmacy: QareGO does not sell or dispense medicine. Orders are fulfilled by partner pharmacies licensed by the Pharmacy Council of Ghana. Prescription-only items require the customer to upload a prescription, which the pharmacy checks before dispensing.
- Payments are processed by Paystack, a payment service provider licensed by the Bank of Ghana. QareGO does not store card details.
- Cooking gas is refilled at licensed LPG stations, and riders only collect and deliver cylinders.

Thank you,
[Your name]
QareGO
