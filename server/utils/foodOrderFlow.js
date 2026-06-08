import Ride from "../models/Ride.js";
import FoodOrder from "../models/FoodOrder.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import { calculateDistance, calculateFare, generateOTP } from "./mapUtils.js";
import { getSettings } from "./tripSettlement.js";
import { emitRideOfferToEligibleRiders } from "./rideOfferBroadcast.js";
import {
  notifyCustomerFoodOrderPush,
  notifyRiderAssignedFoodDelivery,
} from "./pushNotifications.js";
import {
  canRiderReceiveOffer,
  getEligibilityRejectReason,
} from "./riderServiceEligibility.js";

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
      if (driverId && existing.status === "SEARCHING_FOR_RIDER" && !existing.rider) {
        const driver = await User.findById(driverId).select("role driverDetails");
        const settings = await getSettings();
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

  const distance = calculateDistance(
    restaurant.latitude,
    restaurant.longitude,
    foodOrder.delivery.latitude,
    foodOrder.delivery.longitude
  );

  const settings = await getSettings();
  const fareResult = calculateFare(distance, settings.fareRates || undefined);
  const driverFee = fareResult.motorcycle;

  const itemSummary = foodOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(", ");
  const deliveryCode = generateOTP();

  const ride = await Ride.create({
    serviceType: "FOOD",
    vehicle: "motorcycle",
    distance,
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
      break;
    case "reject":
      if (!["PLACED", "CONFIRMED", "PREPARING"].includes(foodOrder.status)) {
        return { error: "invalid_transition" };
      }
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
        await createCourierRideForOrder(foodOrder, restaurant, io, {
          driverId: assignId,
          broadcast: !assignId,
        });
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
      }
      break;
    }
    default:
      return { error: "unknown_action" };
  }

  await foodOrder.save();
  const populated = await FoodOrder.findById(orderId)
    .populate("restaurant", "name cuisine imageEmoji address")
    .populate("ride")
    .lean();

  if (io) {
    io.to(`food_order_${orderId}`).emit("foodOrderUpdated", populated);
    io.to(`customer_${foodOrder.customer}`).emit("foodOrderUpdated", populated);
    io.to(`restaurant_${foodOrder.restaurant}`).emit("foodOrderUpdated", populated);
  }

  const customerId = foodOrder.customer?._id?.toString?.() || String(foodOrder.customer);
  notifyCustomerFoodOrderPush(customerId, populated);

  return { order: populated };
}
