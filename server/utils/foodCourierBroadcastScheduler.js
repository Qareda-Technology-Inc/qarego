import FoodOrder from "../models/FoodOrder.js";
import Restaurant from "../models/Restaurant.js";
import {
  createCourierRideForOrder,
  emitFoodOrderUpdated,
} from "./foodOrderFlow.js";

const POLL_MS = 30_000;

let pollTimer = null;

/** Process delivery orders whose early courier broadcast time has passed. */
export async function processDueCourierBroadcasts(io) {
  const now = new Date();
  const due = await FoodOrder.find({
    status: "PREPARING",
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
        status: "PREPARING",
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

      await createCourierRideForOrder(claimed, restaurant, io, { broadcast: true });
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

export function startFoodCourierBroadcastScheduler(io) {
  if (pollTimer) return;

  const tick = () => {
    processDueCourierBroadcasts(io).catch((err) => {
      console.error("[food] courier broadcast scheduler error:", err?.message || err);
    });
  };

  tick();
  pollTimer = setInterval(tick, POLL_MS);
  if (typeof pollTimer.unref === "function") pollTimer.unref();
  console.log(`[food] courier early-broadcast scheduler every ${POLL_MS / 1000}s`);
}
