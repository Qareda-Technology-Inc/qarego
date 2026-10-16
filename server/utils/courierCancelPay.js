import Ride from "../models/Ride.js";
import User from "../models/User.js";
import Restaurant from "../models/Restaurant.js";
import Transaction from "../models/Transaction.js";
import StoreLedgerEntry from "../models/StoreLedgerEntry.js";

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Pay for a courier trip the store cancelled after the courier had committed to it:
 * half the trip's delivery fee once accepted, the full fee once they reached the pickup
 * or door (or were carrying the order).
 */
export function courierCancelPayAmount(ride) {
  if (!ride?.rider) return 0;
  const fare = Number(ride.fare) || 0;
  if (fare <= 0) return 0;
  if (ride.status === "START") return roundMoney(fare * 0.5);
  if (ride.status === "ARRIVED" || ride.status === "IN_PROGRESS") return roundMoney(fare);
  return 0;
}

/**
 * Credit the courier (reduces what they owe) and, when the store cancelled, charge the store
 * the same amount via its commission owed. Admin cancellations are absorbed by the platform.
 * One credit per trip. Call before the courier ride is released (it gets deleted).
 * @returns {Promise<number>} amount credited (0 when nothing is due)
 */
export async function compensateCourierForCancel(rideId, { restaurantId, chargeStore }) {
  if (!rideId) return 0;
  const ride = await Ride.findById(rideId).select("rider status fare foodOrder");
  const amount = courierCancelPayAmount(ride);
  if (amount <= 0) return 0;

  const already = await Transaction.exists({ ride: ride._id, type: "CANCELLATION_CREDIT" });
  if (already) return 0;

  const rider = await User.findById(ride.rider).select("balance driverDetails.status");
  if (!rider) return 0;
  const balance = roundMoney(Number(rider.balance ?? 0) + amount);

  await Transaction.create({
    ride: ride._id,
    driver: rider._id,
    amount,
    type: "CANCELLATION_CREDIT",
    note: `Order cancelled by ${chargeStore ? "the store" : "QareGO"} after you started — trip pay`,
    balanceAfter: balance,
  });

  const update = { balance };
  // Same rule as a top-up: clearing the debt lifts a debt suspension.
  if (rider.driverDetails?.status === "suspended_debt" && balance >= 0) {
    update["driverDetails.status"] = "active";
  }
  await User.updateOne({ _id: rider._id }, { $set: update });

  if (chargeStore && restaurantId) {
    const store = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $inc: { commissionOwed: amount } },
      { new: true }
    );
    await StoreLedgerEntry.create({
      restaurant: restaurantId,
      foodOrder: ride.foodOrder ?? null,
      type: "CANCELLATION_FEE",
      amount,
      owedAfter: roundMoney(store?.commissionOwed ?? amount),
      note: "Courier paid for a trip cancelled after they started",
    });
  }
  return amount;
}
