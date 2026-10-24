// Stores paying what they owe QareGO by mobile money or card (merchant portal → Pay QareGO).
// The balance only drops once Paystack confirms a full payment; the webhook, the portal's status
// check and a reopened checkout all go through applyStorePayment, which credits a payment once.
import Restaurant from "../models/Restaurant.js";
import StoreLedgerEntry from "../models/StoreLedgerEntry.js";
import StorePayment from "../models/StorePayment.js";
import { verifyPaystackTransaction } from "./paystackService.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const paidEnough = (paid, expected) => Number(paid) + 0.005 >= Number(expected);

/** Credit a confirmed payment to the store's balance. Returns true if this call credited it. */
export async function applyStorePayment(payment, verified) {
  const claimed = await StorePayment.findOneAndUpdate(
    { _id: payment._id, status: "pending" },
    { $set: { status: "completed", completedAt: new Date(), channel: verified.channel || null, providerResponse: verified.raw || null } },
    { new: true }
  );
  if (!claimed) return false;
  const store = await Restaurant.findByIdAndUpdate(claimed.restaurant, { $inc: { commissionOwed: -claimed.amount } }, { new: true });
  const owedAfter = round2(store?.commissionOwed);
  if (store && owedAfter !== Number(store.commissionOwed)) {
    await Restaurant.updateOne({ _id: store._id }, { $set: { commissionOwed: owedAfter } });
  }
  await StoreLedgerEntry.create({
    restaurant: claimed.restaurant,
    type: "MOMO_PAYMENT",
    amount: -claimed.amount,
    owedAfter,
    note: `Paid to QareGO by ${verified.channel === "card" ? "card" : "mobile money"} (${claimed.clientReference})`,
  });
  return true;
}

/** Ask Paystack about a store payment and credit it once it's paid in full. Safe to repeat. */
export async function reconcileStorePayment(payment) {
  if (!payment || payment.status !== "pending") return payment;
  const result = await verifyPaystackTransaction(payment.clientReference);
  if (result.status !== "success") return payment;
  if (!paidEnough(result.amount, payment.amount)) {
    console.warn("[store-payment] amount mismatch:", payment.clientReference, result.amount, payment.amount);
    return payment;
  }
  await applyStorePayment(payment, result);
  return StorePayment.findById(payment._id);
}
