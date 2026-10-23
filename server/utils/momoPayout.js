// One place to send money to a MoMo wallet (rider cash-outs, admin payouts, store and rider
// settlement). Paystack Transfers; the result comes back on the transfer webhook.
// Result shape: { success, data, error }.
import { isPaystackConfigured, sendPaystackMomoTransfer } from "./paystackService.js";
import { detectGhMomoChannel } from "./momo.js";

export async function sendMomoPayout({ name, phone, amount, reference, reason }) {
  if (!isPaystackConfigured()) {
    return { success: false, error: "Mobile money payouts aren't set up (PAYSTACK_SECRET_KEY missing)" };
  }
  return sendPaystackMomoTransfer({ name, phone, channel: detectGhMomoChannel(phone), amount, reference, reason });
}
