import Ride from "../models/Ride.js";
import FoodOrder from "../models/FoodOrder.js";

/** Remove courier ride and notify rider/customer sockets. */
export async function releaseCourierRide(ride, io, message = "Delivery cancelled") {
  if (!ride?._id) return;
  const rideId = ride._id.toString();
  const riderId = ride.rider?.toString?.() ?? (ride.rider ? String(ride.rider) : null);

  if (io) {
    io.to(`ride_${rideId}`).emit("rideCanceled", { rideId, message });
    if (riderId) {
      io.to(`rider_${riderId}`).emit("rideCanceled", { rideId, message });
    }
    io.to("onDuty").emit("rideCanceled", {
      rideId,
      message: "Ride no longer available.",
    });
  }

  await Ride.findByIdAndDelete(ride._id);
}

/**
 * Food courier rides whose order was deleted/cancelled/delivered but ride row remains.
 * Returns null when the ride was released.
 */
export async function cleanupStaleFoodCourierRide(ride, io) {
  if (!ride || ride.serviceType !== "FOOD" || ride.status === "COMPLETED") {
    return ride;
  }

  if (!ride.foodOrder) {
    await releaseCourierRide(ride, io, "Order no longer available");
    return null;
  }

  const order = await FoodOrder.findById(ride.foodOrder).select("status").lean();
  if (!order) {
    await releaseCourierRide(ride, io, "Order no longer available");
    return null;
  }

  if (order.status === "CANCELLED") {
    await releaseCourierRide(ride, io, "Order cancelled");
    return null;
  }

  // Order delivered — keep ride for receipt/rating; sync status instead of deleting.
  if (order.status === "DELIVERED") {
    if (ride.status !== "COMPLETED") {
      await Ride.findByIdAndUpdate(ride._id, { status: "COMPLETED" });
    }
    return { ...ride, status: "COMPLETED" };
  }

  return ride;
}

/** Cancel/delete courier ride when merchant rejects or order is cancelled. */
export async function cancelCourierRideForOrder(foodOrder, io) {
  if (!foodOrder?.ride) return;
  const ride = await Ride.findById(foodOrder.ride);
  if (!ride) {
    foodOrder.ride = null;
    return;
  }
  await releaseCourierRide(ride, io, "Order cancelled");
  foodOrder.ride = null;
}
