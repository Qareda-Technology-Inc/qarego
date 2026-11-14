import FoodOrder from "../models/FoodOrder.js";
import Restaurant from "../models/Restaurant.js";
import {
  applyRestaurantAction,
  createCollectionRide,
  createCourierRideForOrder,
  emitFoodOrderUpdated,
} from "./foodOrderFlow.js";
import { isCollectFirstOrder } from "./laundryOrders.js";
import { cancelStaleUnpaidOrders } from "./unpaidOrders.js";
import { processWaitingOrders } from "./orderWaitAlerts.js";
import { processNoRiderJobs } from "./noRiderAlerts.js";

const POLL_MS = 30_000;

let pollTimer = null;

/** Process delivery orders whose early courier broadcast time has passed. */
export async function processDueCourierBroadcasts(io) {
  const now = new Date();
  const due = await FoodOrder.find({
    // READY_FOR_PICKUP: a scheduled order cooked early, waiting for its delivery slot.
    status: { $in: ["PREPARING", "READY_FOR_PICKUP"] },
    fulfillmentType: { $in: ["DELIVERY", "SCHEDULED"] },
    ride: null,
    courierBroadcastAt: { $lte: now },
    courierBroadcastSent: { $ne: true },
  })
    .limit(20)
    .lean();

  for (const row of due) {
    const claimed = await FoodOrder.findOneAndUpdate(
      {
        _id: row._id,
        status: { $in: ["PREPARING", "READY_FOR_PICKUP"] },
        ride: null,
        courierBroadcastSent: { $ne: true },
      },
      { $set: { courierBroadcastSent: true } }
    );
    if (!claimed) continue;

    try {
      const restaurant = await Restaurant.findById(claimed.restaurant);
      if (!restaurant) {
        await FoodOrder.updateOne(
          { _id: claimed._id },
          { $set: { courierBroadcastSent: false } }
        );
        continue;
      }

      if (isCollectFirstOrder(claimed)) {
        // Booked laundry pickup: the window is about to open, so send a rider to collect it.
        if (claimed.collectionRide || claimed.gasStage) continue;
        await createCollectionRide(claimed, restaurant, io);
        await claimed.save();
      } else {
        await createCourierRideForOrder(claimed, restaurant, io, { broadcast: true });
      }
      await emitFoodOrderUpdated(io, claimed._id);
    } catch (err) {
      console.error("[food] early courier broadcast failed:", claimed._id, err?.message || err);
      await FoodOrder.updateOne(
        { _id: claimed._id },
        { $set: { courierBroadcastSent: false } }
      );
    }
  }
}

/**
 * QareGO's own gas orders need nobody to accept them: accept any still waiting (a MoMo order
 * once it's paid, or a cash one whose instant accept failed).
 */
export async function acceptQaregoGasOrders(io) {
  const waiting = await FoodOrder.find({
    gasByQarego: true,
    status: "PLACED",
    $or: [{ paymentMethod: "CASH" }, { paymentStatus: "PAID" }],
  })
    .select("_id")
    .limit(20)
    .lean();
  for (const row of waiting) {
    const result = await applyRestaurantAction(row._id, "accept", io);
    if (result.error && result.error !== "invalid_transition") {
      console.warn("[gas] auto-accept failed:", String(row._id), result.error);
    }
  }
}

export function startFoodCourierBroadcastScheduler(io) {
  if (pollTimer) return;

  const tick = () => {
    acceptQaregoGasOrders(io).catch((err) => {
      console.error("[gas] auto-accept error:", err?.message || err);
    });
    processDueCourierBroadcasts(io).catch((err) => {
      console.error("[food] courier broadcast scheduler error:", err?.message || err);
    });
    cancelStaleUnpaidOrders(io).catch((err) => {
      console.error("[food] unpaid order cleanup error:", err?.message || err);
    });
    processWaitingOrders(io).catch((err) => {
      console.error("[food] waiting order alerts error:", err?.message || err);
    });
    processNoRiderJobs().catch((err) => {
      console.error("[food] no-rider alerts error:", err?.message || err);
    });
  };

  tick();
  pollTimer = setInterval(tick, POLL_MS);
  if (typeof pollTimer.unref === "function") pollTimer.unref();
  console.log(`[food] courier early-broadcast scheduler every ${POLL_MS / 1000}s`);
}
