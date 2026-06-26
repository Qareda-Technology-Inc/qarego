import Ride from "../models/Ride.js";
import FoodOrder from "../models/FoodOrder.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import { generateOTP } from "./mapUtils.js";
import { getSettings } from "./tripSettlement.js";
import { resolveFoodCourierRidePricing } from "./deliveryFare.js";
import { emitRideOfferToEligibleRiders } from "./rideOfferBroadcast.js";
import {
  notifyCustomerFoodOrderPush,
  notifyRiderAssignedFoodDelivery,
} from "./pushNotifications.js";
import { cancelCourierRideForOrder } from "./releaseCourierRide.js";
import {
  canRiderReceiveOffer,
  getEligibilityRejectReason,
} from "./riderServiceEligibility.js";

const DEFAULT_PREP_MINUTES = 25;
const MIN_PREP_MINUTES = 5;
/** Do not broadcast couriers more than this many minutes before estimated ready. */
const COURIER_BROADCAST_BEFORE_READY_MIN = 5;

/** Restaurant estimated prep time used for early courier broadcast scheduling. */
export function getEstimatedPrepMinutes(restaurant) {
  const raw = Number(restaurant?.estimatedPrepMinutes);
  if (!Number.isFinite(raw) || raw < MIN_PREP_MINUTES) return DEFAULT_PREP_MINUTES;
  return raw;
}

/**
 * Minutes after accept to broadcast couriers.
 * Uses the later of halfway through prep or (prep − 5 min), so short orders still
 * get an early rider search while long preps only dispatch ~5 min before ready.
 */
export function getCourierBroadcastDelayMinutes(prepMinutes) {
  const prep = getEstimatedPrepMinutes({ estimatedPrepMinutes: prepMinutes });
  const halfPrep = prep / 2;
  const beforeReady = Math.max(0, prep - COURIER_BROADCAST_BEFORE_READY_MIN);
  return Math.max(halfPrep, beforeReady);
}

export function getCourierBroadcastAt(acceptedAt, prepMinutes) {
  const base = acceptedAt instanceof Date ? acceptedAt.getTime() : Date.now();
  const delayMs = getCourierBroadcastDelayMinutes(prepMinutes) * 60 * 1000;
  return new Date(base + delayMs);
}

export function scheduleCourierBroadcast(foodOrder, restaurant) {
  if (foodOrder.fulfillmentType === "PICKUP") return;

  const acceptedAt = new Date();
  foodOrder.preparingStartedAt = acceptedAt;
  foodOrder.courierBroadcastAt = getCourierBroadcastAt(
    acceptedAt,
    getEstimatedPrepMinutes(restaurant)
  );
  foodOrder.courierBroadcastSent = false;
}

export async function emitFoodOrderUpdated(io, orderId) {
  const populated = await FoodOrder.findById(orderId)
    .populate(
      "restaurant",
      "name cuisine imageEmoji address latitude longitude vertical estimatedPrepMinutes"
    )
    .populate("ride")
    .lean();
  if (!populated) return null;

  if (io) {
    io.to(`food_order_${orderId}`).emit("foodOrderUpdated", populated);
    io.to(`customer_${populated.customer}`).emit("foodOrderUpdated", populated);
    io.to(`restaurant_${populated.restaurant?._id || populated.restaurant}`).emit(
      "foodOrderUpdated",
      populated
    );
  }

  const customerId =
    populated.customer?._id?.toString?.() || String(populated.customer);
  notifyCustomerFoodOrderPush(customerId, populated);
  return populated;
}

/** Broadcast new food delivery ride to eligible on-duty drivers */
export async function broadcastRideToDrivers(io, ride) {
  await emitRideOfferToEligibleRiders(io, ride);
}

/** Notify a single assigned rider (no broadcast to all on-duty drivers). */
export async function notifyAssignedRider(io, ride, driverId) {
  if (!io || !ride || !driverId) return;
  const rideWithCustomer = await Ride.findById(ride._id)
    .populate("customer", "name phone averageRating totalRatings")
    .lean();
  if (!rideWithCustomer) return;

  const riderRoom = `rider_${driverId}`;
  io.to(riderRoom).emit("rideAssigned", rideWithCustomer);
  notifyRiderAssignedFoodDelivery(driverId, rideWithCustomer);

  const rideData = await Ride.findById(ride._id).populate("customer rider");
  io.to(`ride_${ride._id}`).emit("rideData", rideData);
}

/**
 * Create courier ride when restaurant marks order ready.
 * @param {{ broadcast?: boolean, driverId?: string|null }} options
 *   - broadcast true (default): offer to all on-duty riders
 *   - driverId: assign directly to one rider (no broadcast)
 */
export async function createCourierRideForOrder(foodOrder, restaurant, io, options = {}) {
  const { broadcast = true, driverId = null } = options;

  if (foodOrder.ride) {
    const existing = await Ride.findById(foodOrder.ride);
    if (existing) {
      const settings = await getSettings();
      const { distanceKm, driverFee } = resolveFoodCourierRidePricing(
        foodOrder,
        restaurant,
        settings.fareRates || undefined
      );
      if (existing.fare !== driverFee || existing.distance !== distanceKm) {
        existing.fare = driverFee;
        existing.distance = distanceKm;
        await existing.save();
      }
      if (driverId && existing.status === "SEARCHING_FOR_RIDER" && !existing.rider) {
        const driver = await User.findById(driverId).select("role driverDetails");
        if (!canRiderReceiveOffer(driver, existing, settings)) {
          throw new Error(
            getEligibilityRejectReason(driver, existing, settings) || "driver_ineligible"
          );
        }
        existing.rider = driverId;
        existing.status = "START";
        await existing.save();
        await notifyAssignedRider(io, existing, driverId);
      }
      return existing;
    }
  }

  const settings = await getSettings();
  const { distanceKm, driverFee } = resolveFoodCourierRidePricing(
    foodOrder,
    restaurant,
    settings.fareRates || undefined
  );

  if (!foodOrder.deliveryDistanceKm) {
    foodOrder.deliveryDistanceKm = distanceKm;
  }
  if (!foodOrder.driverFee) {
    foodOrder.driverFee = driverFee;
  }

  const itemSummary = foodOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(", ");
  const deliveryCode = generateOTP();

  const ride = await Ride.create({
    serviceType: "FOOD",
    vehicle: "motorcycle",
    distance: distanceKm,
    fare: driverFee,
    pickup: {
      address: `${restaurant.name} — ${restaurant.address}`,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    },
    drop: {
      address: foodOrder.delivery.address,
      latitude: foodOrder.delivery.latitude,
      longitude: foodOrder.delivery.longitude,
    },
    customer: foodOrder.customer,
    otp: deliveryCode,
    paymentMethod: foodOrder.paymentMethod,
    foodOrder: foodOrder._id,
    restaurantName: restaurant.name,
    storeVertical: restaurant.vertical || "FOOD",
    foodOrderSummary: itemSummary,
  });

  foodOrder.ride = ride._id;
  foodOrder.deliveryCode = deliveryCode;
  await foodOrder.save();

  if (driverId) {
    const driver = await User.findById(driverId).select("role driverDetails");
    if (!driver || driver.role !== "rider") {
      throw new Error("driver_not_found");
    }
    if (!canRiderReceiveOffer(driver, ride, settings)) {
      const msg = getEligibilityRejectReason(driver, ride, settings);
      throw new Error(msg || "driver_ineligible");
    }
    ride.rider = driverId;
    ride.status = "START";
    await ride.save();
    await notifyAssignedRider(io, ride, driverId);
  } else if (broadcast) {
    await broadcastRideToDrivers(io, ride);
  }
  return ride;
}

export async function applyRestaurantAction(orderId, action, io, options = {}) {
  const foodOrder = await FoodOrder.findById(orderId);
  if (!foodOrder) return { error: "not_found" };

  const restaurant = await Restaurant.findById(foodOrder.restaurant);
  if (!restaurant) return { error: "restaurant_not_found" };

  switch (action) {
    case "accept":
      if (foodOrder.status !== "PLACED") return { error: "invalid_transition" };
      foodOrder.status = "PREPARING";
      scheduleCourierBroadcast(foodOrder, restaurant);
      break;
    case "reject":
      if (!["PLACED", "CONFIRMED", "PREPARING"].includes(foodOrder.status)) {
        return { error: "invalid_transition" };
      }
      await cancelCourierRideForOrder(foodOrder, io);
      foodOrder.status = "CANCELLED";
      if (options.cancelReason) foodOrder.cancelReason = options.cancelReason;
      break;
    case "ready": {
      if (!["PREPARING", "CONFIRMED"].includes(foodOrder.status)) {
        return { error: "invalid_transition" };
      }
      foodOrder.status = "READY_FOR_PICKUP";
      if (foodOrder.fulfillmentType !== "PICKUP") {
        const assignId = options.driverId || null;
        if (!foodOrder.ride) {
          await createCourierRideForOrder(foodOrder, restaurant, io, {
            driverId: assignId,
            broadcast: !assignId,
          });
        }
        foodOrder.courierBroadcastSent = true;
      }
      break;
    }
    case "assign_rider": {
      const driverId = options.driverId;
      if (!driverId) return { error: "driver_required" };
      const driver = await User.findById(driverId).select("role driverDetails");
      if (!driver || driver.role !== "rider") return { error: "driver_not_found" };
      if (driver.driverDetails?.status !== "active") {
        return { error: "driver_not_active" };
      }
      const settings = await getSettings();
      const probeRide = { serviceType: "FOOD" };
      if (!canRiderReceiveOffer(driver, probeRide, settings)) {
        return {
          error: "driver_ineligible",
          message: getEligibilityRejectReason(driver, probeRide, settings),
        };
      }
      if (!["PREPARING", "READY_FOR_PICKUP"].includes(foodOrder.status)) {
        return { error: "invalid_transition" };
      }
      if (foodOrder.status === "PREPARING") {
        foodOrder.status = "READY_FOR_PICKUP";
      }
      if (foodOrder.fulfillmentType !== "PICKUP") {
        await createCourierRideForOrder(foodOrder, restaurant, io, {
          driverId,
          broadcast: false,
        });
        foodOrder.courierBroadcastSent = true;
      }
      break;
    }
    default:
      return { error: "unknown_action" };
  }

  await foodOrder.save();
  const populated = await emitFoodOrderUpdated(io, orderId);
  return { order: populated };
}
