// One place to send money to a MoMo wallet: Paystack Transfers when Paystack is set up,
// otherwise the old Hubtel "send money". Same result shape either way: { success, data, error }.
import { isPaystackConfigured, sendPaystackMomoTransfer } from "./paystackService.js";
import { detectGhMomoChannel, sendPayment } from "./hubtelService.js";

export async function sendMomoPayout({ name, phone, amount, reference, reason, callbackUrl }) {
  const channel = detectGhMomoChannel(phone);
  if (isPaystackConfigured()) {
    return sendPaystackMomoTransfer({ name, phone, channel, amount, reference, reason });
  }
  return sendPayment({
    RecipientName: name || "Recipient",
    RecipientMsisdn: phone,
    Amount: amount,
    PrimaryCallbackUrl: callbackUrl,
    Description: reason,
    ClientReference: reference,
    Channel: channel,
  });
}
