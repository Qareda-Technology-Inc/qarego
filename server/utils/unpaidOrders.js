// Store orders chosen for mobile money but never paid: the store can't accept them, so after a
// while they're cancelled for the customer instead of sitting at "Placed" for good. Runs on the
// food scheduler's tick. Before cancelling, Paystack is asked whether the payment went through;
// a payment that lands after the cancel is refunded automatically (see processFoodPaymentSuccess).
import FoodOrder from "../models/FoodOrder.js";
import FoodPayment from "../models/FoodPayment.js";
import { applyRestaurantAction } from "./foodOrderFlow.js";
import { isPaystackConfigured } from "./paystackService.js";

const MINUTE = 60_000;
/** An unpaid mobile money order is cancelled this long after it was placed… */
export const UNPAID_ORDER_MINUTES = 15;
/** …unless the customer opened the payment page in the last few minutes (give them time to finish). */
const RECENT_CHECKOUT_MINUTES = 5;

export const UNPAID_CANCEL_REASON =
  "Payment wasn't completed, so this order was cancelled. You weren't charged. You can order again any time.";

export async function cancelStaleUnpaidOrders(io, now = new Date()) {
  const stale = await FoodOrder.find({
    status: "PLACED",
    paymentMethod: "MOBILE_MONEY",
    paymentStatus: { $in: ["UNPAID", "PENDING", "FAILED"] },
    createdAt: { $lt: new Date(now - UNPAID_ORDER_MINUTES * MINUTE) },
  })
    .select("_id")
    .limit(20)
    .lean();

  let cancelled = 0;
  for (const { _id } of stale) {
    try {
      const payment = await FoodPayment.findOne({ order: _id });
      if (payment?.status === "pending") {
        if (now - new Date(payment.updatedAt) < RECENT_CHECKOUT_MINUTES * MINUTE) continue;
        if (isPaystackConfigured()) {
          const { reconcilePaystackFoodPayment } = await import("../controllers/payment.js");
          await reconcilePaystackFoodPayment(payment);
        }
      }
      // Paid after all (or the store moved it on meanwhile): leave it.
      const fresh = await FoodOrder.findById(_id).select("status paymentStatus").lean();
      if (!fresh || fresh.status !== "PLACED" || fresh.paymentStatus === "PAID") continue;

      const result = await applyRestaurantAction(_id, "reject", io, {
        cancelledBy: "SYSTEM",
        cancelReason: UNPAID_CANCEL_REASON,
      });
      if (!result.error) cancelled += 1;
    } catch (err) {
      console.error("[unpaid-orders] could not cancel", String(_id), err?.message || err);
    }
  }
  return cancelled;
}
