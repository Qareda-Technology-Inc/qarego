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
  sendPushToUserId,
  notifyRiderAssignedFoodDelivery,
} from "./pushNotifications.js";
import { cancelCourierRideForOrder } from "./releaseCourierRide.js";
import { compensateCourierForCancel } from "./courierCancelPay.js";
import {
  applyLaundryCount,
  applyLaundryDecision,
  isCollectFirstOrder,
  isLaundryOrder,
  laundryCourierSummary,
} from "./laundryOrders.js";
import {
  buildCourierCashCollection,
  settleFoodOrderOnDelivery,
} from "./foodOrderSettlement.js";
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

export async function emitFoodOrderUpdated(io, orderId, { push = true } = {}) {
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

  if (push) {
    const customerId = populated.customer?._id?.toString?.() || String(populated.customer);
    notifyCustomerFoodOrderPush(customerId, populated);
  }
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
/** What the courier is told they're carrying. Medicines are health data: give a count only. */
export function courierItemSummary(foodOrder, restaurant) {
  if (isLaundryOrder(foodOrder)) return laundryCourierSummary(foodOrder);
  if (restaurant?.vertical === "PHARMACY") {
    const count = foodOrder.items.reduce((n, i) => n + (Number(i.quantity) || 0), 0);
    return `Pharmacy order · ${count} item${count === 1 ? "" : "s"}`;
  }
  return foodOrder.items.map((i) => `${i.quantity}x ${i.name}`).join(", ");
}

export async function createCourierRideForOrder(foodOrder, restaurant, io, options = {}) {
  const { broadcast = true, driverId = null } = options;
  // Gas: EXCHANGE delivers a full cylinder; REFILL's second leg returns the filled one.
  // Laundry's second leg returns the clean laundry.
  const gasLeg = foodOrder.gasMode
    ? foodOrder.gasMode === "REFILL"
      ? "RETURN"
      : "DELIVER"
    : isLaundryOrder(foodOrder)
      ? "RETURN"
      : null;

  if (foodOrder.ride) {
    const existing = await Ride.findById(foodOrder.ride);
    if (existing) {
      const settings = await getSettings();
      const { distanceKm, driverFee } = resolveFoodCourierRidePricing(
        foodOrder,
        restaurant,
        settings.fareRates || undefined
      );
      const cashCollection = existing.cashCollection ?? buildCourierCashCollection(foodOrder);
      if (
        existing.fare !== driverFee ||
        existing.distance !== distanceKm ||
        (cashCollection && !existing.cashCollection)
      ) {
        existing.fare = driverFee;
        existing.distance = distanceKm;
        existing.cashCollection = cashCollection;
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

  const itemSummary = courierItemSummary(foodOrder, restaurant);
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
    cashCollection: buildCourierCashCollection(foodOrder),
    gasLeg,
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

/**
 * Collect-first orders, first leg (gas REFILL: the empty cylinder; laundry: the bag): a courier
 * collects from the customer and takes it to the store. Pays the full round-trip fee (settled
 * once, when it comes back); no cash changes hands on this leg.
 */
async function createCollectionRide(foodOrder, restaurant, io) {
  const itemSummary = courierItemSummary(foodOrder, restaurant);
  const ride = await Ride.create({
    serviceType: "FOOD",
    vehicle: "motorcycle",
    distance: foodOrder.deliveryDistanceKm,
    fare: foodOrder.driverFee || foodOrder.deliveryFee,
    pickup: {
      address: foodOrder.delivery.address,
      latitude: foodOrder.delivery.latitude,
      longitude: foodOrder.delivery.longitude,
    },
    drop: {
      address: `${restaurant.name} — ${restaurant.address}`,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    },
    customer: foodOrder.customer,
    otp: generateOTP(),
    paymentMethod: foodOrder.paymentMethod,
    foodOrder: foodOrder._id,
    restaurantName: restaurant.name,
    storeVertical: restaurant.vertical || "GAS",
    foodOrderSummary: itemSummary,
    cashCollection: null,
    gasLeg: "COLLECT",
  });
  foodOrder.ride = ride._id;
  foodOrder.collectionRide = ride._id;
  await broadcastRideToDrivers(io, ride);
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
      if (
        foodOrder.paymentMethod === "MOBILE_MONEY" &&
        foodOrder.paymentStatus !== "PAID"
      ) {
        return {
          error: "payment_required",
          message: "Customer must complete MoMo payment before the kitchen can accept this order",
        };
      }
      foodOrder.status = "PREPARING";
      if (isCollectFirstOrder(foodOrder)) {
        // Nothing to prepare until it arrives: send a courier to collect it now.
        foodOrder.preparingStartedAt = new Date();
        foodOrder.courierBroadcastSent = true;
        await createCollectionRide(foodOrder, restaurant, io);
      } else {
        scheduleCourierBroadcast(foodOrder, restaurant);
      }
      break;
    case "reject":
    case "customer_cancel": {
      // Store/admin can cancel until the courier has the food (incl. ready for pickup, e.g.
      // when no courier comes). Customers can only cancel before the store accepts.
      const allowed =
        action === "customer_cancel"
          ? ["PLACED"]
          : ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP"];
      if (!allowed.includes(foodOrder.status)) {
        return { error: "invalid_transition" };
      }
      // The customer's own cylinder or laundry is with the courier or the store: it has to go back first.
      if (isCollectFirstOrder(foodOrder) && foodOrder.gasStage) {
        return { error: "gas_in_custody" };
      }
      // Pickup orders settle when marked ready; never cancel money that has already moved.
      if (["processing", "settled"].includes(foodOrder.settlementStatus)) {
        return { error: "already_settled" };
      }
      // A courier who already started is paid for the wasted trip (charged to the store, or
      // absorbed by QareGO when an admin cancels), then released with no strike.
      const cancelledBy =
        action === "customer_cancel" ? "CUSTOMER" : options.cancelledBy || "RESTAURANT";
      const credited =
        action === "reject"
          ? await compensateCourierForCancel(foodOrder.ride, {
              restaurantId: foodOrder.restaurant,
              chargeStore: cancelledBy === "RESTAURANT",
            })
          : 0;
      await cancelCourierRideForOrder(
        foodOrder,
        io,
        credited > 0
          ? `Order cancelled. GH₵${credited.toFixed(2)} was credited to your balance for this trip.`
          : "Order cancelled"
      );
      foodOrder.status = "CANCELLED";
      foodOrder.cancelledAt = new Date();
      foodOrder.cancelledBy = cancelledBy;
      if (options.cancelReason) foodOrder.cancelReason = options.cancelReason;
      if (foodOrder.paymentStatus === "PAID") foodOrder.refundStatus = "DUE";
      foodOrder.settlementStatus = "not_required";
      foodOrder.courierBroadcastAt = null;
      break;
    }
    case "ready": {
      if (!["PREPARING", "CONFIRMED"].includes(foodOrder.status)) {
        return { error: "invalid_transition" };
      }
      if (isCollectFirstOrder(foodOrder)) {
        if (foodOrder.gasStage !== "AT_STATION") {
          return { error: isLaundryOrder(foodOrder) ? "laundry_not_at_shop" : "gas_not_at_station" };
        }
        // Laundry goes back only once the price is settled: counted and accepted, or declined.
        if (isLaundryOrder(foodOrder) && !["approved", "declined"].includes(foodOrder.laundry.priceStatus)) {
          return {
            error: foodOrder.laundry.priceStatus === "awaiting_customer" ? "laundry_awaiting_customer" : "laundry_not_counted",
          };
        }
        foodOrder.status = "READY_FOR_PICKUP";
        foodOrder.ride = null;
        // Gas: the same courier brings it back (they know the customer, and it's minutes later);
        // anyone else if they can't. Laundry can take a day, so offer the return to every
        // nearby rider rather than whoever collected it.
        const preferCollector = !!foodOrder.gasCourier && !isLaundryOrder(foodOrder);
        try {
          await createCourierRideForOrder(foodOrder, restaurant, io, {
            driverId: preferCollector ? String(foodOrder.gasCourier) : null,
            broadcast: !preferCollector,
          });
        } catch (err) {
          console.warn("[collect-first] return leg not assigned to collector, broadcasting:", err?.message);
          const ride = await Ride.findById(foodOrder.ride);
          if (ride) await broadcastRideToDrivers(io, ride);
        }
        foodOrder.courierBroadcastSent = true;
        break;
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
      // Gas refills and laundry are collected first and go back only once the store marks them
      // ready (after the count and price check for laundry). Before that, assigning would skip
      // those steps; afterwards it just picks the rider for the return trip.
      if (isCollectFirstOrder(foodOrder) && foodOrder.status !== "READY_FOR_PICKUP") {
        return { error: "collect_first_assign" };
      }
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
    case "collected":
      // Pickup: the customer came to the counter, paid and took the order.
      if (foodOrder.fulfillmentType !== "PICKUP" || foodOrder.status !== "READY_FOR_PICKUP") {
        return { error: "invalid_transition" };
      }
      foodOrder.status = "DELIVERED";
      break;
    case "empty_returned":
      if (foodOrder.gasMode !== "EXCHANGE" || !["PICKED_UP", "DELIVERED"].includes(foodOrder.status)) {
        return { error: "invalid_transition" };
      }
      // Keep the first confirmation; repeat taps shouldn't move the time.
      if (!foodOrder.gasEmptyReturnedAt) foodOrder.gasEmptyReturnedAt = new Date();
      break;
    default:
      return { error: "unknown_action" };
  }

  await foodOrder.save();
  const populated = await emitFoodOrderUpdated(io, orderId);

  if (action === "collected") {
    try {
      await settleFoodOrderOnDelivery(orderId);
    } catch (err) {
      console.error("Food pickup settlement error:", err);
    }
  }

  return { order: populated };
}

/** Shop counts a laundry bag once it arrives (see applyLaundryCount for the rules). */
export async function applyLaundryCountAction(orderId, lines, io) {
  const foodOrder = await FoodOrder.findById(orderId);
  if (!foodOrder || !isLaundryOrder(foodOrder)) return { error: "not_found" };
  if (foodOrder.status !== "PREPARING" || foodOrder.gasStage !== "AT_STATION") {
    return { error: "laundry_not_at_shop" };
  }
  if (!["estimate", "awaiting_customer", "approved"].includes(foodOrder.laundry.priceStatus)) {
    return { error: "invalid_transition" };
  }
  let result;
  try {
    result = await applyLaundryCount(foodOrder, lines, await getSettings());
  } catch (err) {
    return { error: "bad_count", message: err.message };
  }
  await foodOrder.save();
  const populated = await emitFoodOrderUpdated(io, orderId, { push: false });
  if (result.priceRaised) {
    void sendPushToUserId(foodOrder.customer, {
      title: "Confirm your laundry price",
      body: `${foodOrder.restaurantName} counted your items: GH₵${foodOrder.total.toFixed(2)} in total. Tap to approve.`,
      data: { type: "food_order", orderId: String(foodOrder._id), status: "LAUNDRY_PRICE" },
    }).catch(() => {});
  }
  return { order: populated, priceRaised: result.priceRaised };
}

/**
 * Customer approves or declines a higher laundry count. Declining sends the bag straight back
 * unwashed (the shop is told on its board).
 */
export async function applyLaundryCustomerDecision(orderId, customerId, decision, io) {
  const foodOrder = await FoodOrder.findOne({ _id: orderId, customer: customerId });
  if (!foodOrder || !isLaundryOrder(foodOrder)) return { error: "not_found" };
  if (!["approve", "decline"].includes(decision)) return { error: "bad_decision" };
  try {
    applyLaundryDecision(foodOrder, decision, await getSettings());
  } catch (err) {
    return { error: "invalid_transition", message: err.message };
  }
  await foodOrder.save();
  if (decision === "decline") return applyRestaurantAction(orderId, "ready", io);
  return { order: await emitFoodOrderUpdated(io, orderId, { push: false }) };
}
