# Hubtel Payment Setup (Top-up & Weekly Payout)

QareGO uses Hubtel for:
1. **Receive (top-up):** Driver taps "Clear Debt" → Hubtel sends MoMo prompt to driver → driver approves → webhook credits balance.
2. **Send (payout):** Admin runs "Execute Weekly Payouts" → Hubtel sends balance to each driver's MoMo.

## Environment variables (server/.env)

```env
# Hubtel API (get from https://developers.hubtel.com or merchant dashboard)
HUBTEL_CLIENT_ID=your_client_id
HUBTEL_CLIENT_SECRET=your_client_secret
HUBTEL_API_URL=https://api.hubtel.com/v1

# Webhook base URL (must be publicly reachable for Hubtel to call)
BASE_URL=https://your-api-domain.com
# or API_BASE_URL=https://your-api-domain.com
```

## Webhook URLs (must be HTTPS in production)

- **Top-up callback:** `POST {BASE_URL}/webhooks/hubtel`  
  Hubtel calls this when driver completes the top-up payment. Server credits driver balance and unblocks if was suspended_debt.

- **Payout callback:** `POST {BASE_URL}/webhooks/hubtel-payout`  
  Optional; used if Hubtel sends payout status. Currently returns 200.

## Payment methods (rides)

- **CASH:** Customer pays driver in cash. Driver keeps full fare; commission is debited from driver balance.
- **MOBILE_MONEY:** Customer pays via MoMo (future: Hubtel receive from customer). Driver share is credited to driver balance.

## API endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /ride/top-up | Initiate clear debt (body: optional `amount`). Driver gets MoMo prompt. |
| POST | /webhooks/hubtel | Hubtel callback for top-up success/fail. |
| POST | /admin/payouts/run | Execute weekly payouts (sends balance to each driver via Hubtel). |

## Hubtel API reference

- Receive (collect): typically `POST /receivables/mobilemoney` or similar (see Hubtel docs).
- Send (disburse): typically `POST /disbursements/mobilemoney` or similar.
- Auth: Basic `base64(clientId:clientSecret)`.

If your Hubtel API uses different paths, update `server/utils/hubtelService.js` (getBaseUrl and endpoint paths).
