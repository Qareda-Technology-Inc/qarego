# Paystack setup

QareGO takes mobile money and card payments, pays out riders and stores, and refunds customers through **Paystack** (Ghana, GHS).

## What goes through Paystack

| Flow | How | Code |
|---|---|---|
| Store orders (food, grocery, pharmacy, gas) paid by MoMo or card | Hosted checkout when the order is placed | `initiateFoodOrderPayment` in `controllers/payment.js` |
| Rides and parcels paid by MoMo or card | Hosted checkout after the trip | `initiateRidePayment` |
| Rider commission debt ("Clear debt" / top-up) | Hosted checkout | `initiateTopUp` |
| Store and rider shares of MoMo orders | Transfer to MoMo on delivery | `utils/foodOrderSettlement.js` |
| Rider Cash Out and admin "Pay out" | Transfer to MoMo | `utils/riderPayout.js` |
| Refunds of cancelled paid orders, and of a trip paid twice | Refund to the card or MoMo account that paid | `utils/orderRefunds.js`, `utils/ridePayments.js` |

The app opens the checkout page in its payment screen and closes it when Paystack redirects to `{BASE_URL}/payments/return` or `/payments/cancel`.

## Environment (server)

```env
PAYSTACK_SECRET_KEY=sk_live_...   # sk_test_... while testing
MOMO_ENABLED=true                 # false = cash only everywhere
BASE_URL=https://qarego.onrender.com
```

`MOMO_ENABLED` is the on/off switch for mobile money and card in the apps and the API (`GET /features` tells the apps). With it off, payments, payouts and top-ups are refused with a "please pay with cash" message.

## Paystack dashboard

1. **Webhook URL** (Settings → API Keys & Webhooks): `https://<api-domain>/webhooks/paystack`. Every event is checked with the HMAC-SHA512 signature of the raw body (`isValidPaystackSignature`).
2. **Transfers:** turn **off** "Confirm transfers with OTP", or payouts stay waiting for an OTP and fail in QareGO with an "OTP approval" error.
3. **Balance:** keep enough in the Paystack balance for payouts. A transfer that can't be sent puts a rider's money back in their QareGO wallet; a store payout shows as failed and can be retried from the order page in admin.

## Webhook events handled

| Event | Effect |
|---|---|
| `charge.success` | The payment is verified with Paystack (`/transaction/verify`), and only a full payment marks the order, trip or top-up paid. |
| `transfer.success`, `transfer.failed`, `transfer.reversed` | Settlement legs become sent or failed; a failed rider transfer goes to the rider's wallet; a failed cash-out or admin payout is given back. |
| `refund.processed`, `refund.failed` | The order or trip refund is marked done, or failed so admin can retry it. |

The apps also poll the payment status, and that asks Paystack directly, so a missed webhook doesn't leave a payment stuck.

## References

Payment references are short and unique per attempt (`utils/momo.js` → `makePaymentRef`):

| Prefix | Meaning |
|---|---|
| `fo…` | Store order payment |
| `rd…` | Ride or parcel payment |
| `tu…` | Rider top-up |
| `fosr_…` / `fosd_…` | Store / rider share of a MoMo order |
| `co…` / `po…` | Rider cash-out / admin payout |

Search any of these in the Paystack dashboard. Admin → Finance → Money movements lists them all.

## Testing

Use `sk_test_...` and Paystack's test mobile money numbers and cards. Transfers in test mode don't move real money. Switch to the live key on Render when you're done, and set the webhook URL for live mode too.
