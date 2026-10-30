import { assertMomoEnabled } from "../utils/momoAvailability.js";
import mongoose from "mongoose";
import Ride, { RIDE_CODE_FIELDS } from "../models/Ride.js";
import FoodOrder from "../models/FoodOrder.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import {
  calculateDistance,
  calculateFare,
  generateOTP,
} from "../utils/mapUtils.js";
import { settleTrip, getSettings, getCommissionRateForService } from "../utils/tripSettlement.js";
import { assertNotBookingBlocked } from "../utils/lateCancel.js";
import {
  assertNoUnpaidRide,
  findUnpaidRide,
  isUnpaidMomoTrip,
  markRidePaidInCash,
  unpaidRideSummary,
} from "../utils/ridePayments.js";
import { settleFoodOrderOnDelivery } from "../utils/foodOrderSettlement.js";
import { assertServiceAvailableAt } from "../utils/serviceZones.js";
import {
  canRiderReceiveOffer,
  getEligibilityRejectReason,
  getRideEligibilityServiceType,
  normalizeVehicleCategory,
  getVehicleSupportedServices,
} from "../utils/riderServiceEligibility.js";
import {
  normalizeServicePreferencesInput,
  applyPresetToPreferences,
  detectPresetFromPreferences,
  buildServicePreferencesPayload,
  PRESET_IDS,
} from "../utils/riderServicePreferences.js";
import {
  notifyCustomerFoodOrderPush,
  notifyCustomerFoodDriverAssigned,
} from "../utils/pushNotifications.js";
import { getOnDutyRider } from "../utils/onDutyRidersRegistry.js";
import { filterRidesForRider } from "../utils/rideOfferBroadcast.js";
import {
  buildEarningsBreakdownForRide,
  buildEarningsBreakdownForStoreRide,
  buildEarningsBreakdownFromCommissionTxn,
  buildSalesSummaryFromCommissionTxns,
  isStoreCourierRide,
} from "../utils/earningsBreakdown.js";
import {
  recordReliabilityEvent,
  buildRiderReliabilityPayload,
  clearExpiredPauses,
} from "../utils/riderReliability.js";
import {
  buildRiderDispatchAnalytics,
  parseAnalyticsDays,
} from "../utils/dispatchAnalytics.js";
import { resolveRiderAlertSoundUrl } from "../utils/platformAlertSound.js";
import { riderHasActiveRide } from "../utils/riderActiveRide.js";
import { cleanupStaleFoodCourierRide } from "../utils/releaseCourierRide.js";

import { isDuplicateKeyError, readClientRequestId } from "../utils/idempotency.js";
const VALID_VEHICLES = ["motorcycle", "pragya", "comfort"];
const VALID_SERVICE_TYPES = ["RIDE", "DELIVERY"];

/** Rider breakdowns for completed store-order courier rides, keyed by ride id (from each order's riderNet). */
async function loadStoreRideBreakdowns(rides) {
  const storeRides = rides.filter((r) => r && isStoreCourierRide(r) && r.foodOrder);
  const byRide = new Map();
  if (!storeRides.length) return byRide;

  const orderIds = [...new Set(storeRides.map((r) => String(r.foodOrder?._id ?? r.foodOrder)))];
  const [orders, legCounts] = await Promise.all([
    FoodOrder.find({ _id: { $in: orderIds } }).select("riderNet").lean(),
    Ride.aggregate([
      {
        $match: {
          foodOrder: { $in: orderIds.map((id) => new mongoose.Types.ObjectId(id)) },
          status: "COMPLETED",
        },
      },
      { $group: { _id: "$foodOrder", n: { $sum: 1 } } },
    ]),
  ]);
  const orderById = new Map(orders.map((o) => [String(o._id), o]));
  const legsByOrder = new Map(legCounts.map((l) => [String(l._id), l.n]));

  for (const ride of storeRides) {
    const orderId = String(ride.foodOrder?._id ?? ride.foodOrder);
    const breakdown = buildEarningsBreakdownForStoreRide(
      ride,
      orderById.get(orderId),
      legsByOrder.get(orderId)
    );
    if (breakdown) byRide.set(String(ride._id), breakdown);
  }
  return byRide;
}

/** GET /ride/fare-rates — platform distance fare config for ride & parcel booking */
export const getFareRates = async (req, res) => {
  const settings = await getSettings();
  res.status(StatusCodes.OK).json({ fareRates: settings?.fareRates ?? null });
};

export const createRide = async (req, res) => {
  // Retried booking (lost reply on a weak signal): return the ride it already created.
  const clientRequestId = readClientRequestId(req.body);
  if (clientRequestId) {
    const replay = await Ride.findOne({ customer: req.user.id, clientRequestId });
    if (replay) {
      return res.status(StatusCodes.OK).json({ message: "Ride already requested", ride: replay });
    }
  }
  const {
    vehicle,
    pickup,
    drop,
    paymentMethod,
    serviceType = "RIDE",
    parcelMode = "SEND",
    recipientName,
    recipientPhone,
    deliveryNote,
    parcelDescription,
    parcelPhotoUrl,
  } = req.body;

  if (!vehicle || !pickup || !drop) {
    throw new BadRequestError("Vehicle, pickup, and drop details are required");
  }
  if (!VALID_VEHICLES.includes(vehicle)) {
    throw new BadRequestError(`Vehicle must be one of: ${VALID_VEHICLES.join(", ")}`);
  }
  if (!VALID_SERVICE_TYPES.includes(serviceType)) {
    throw new BadRequestError(`serviceType must be one of: ${VALID_SERVICE_TYPES.join(", ")}`);
  }

  const {
    address: pickupAddress,
    latitude: pickupLat,
    longitude: pickupLon,
  } = pickup;

  const { address: dropAddress, latitude: dropLat, longitude: dropLon } = drop;

  if (
    !pickupAddress ||
    !pickupLat ||
    !pickupLon ||
    !dropAddress ||
    !dropLat ||
    !dropLon
  ) {
    throw new BadRequestError("Complete pickup and drop details are required");
  }

  const coverageService =
    serviceType === "DELIVERY" ? "PARCEL" : serviceType === "FOOD" ? "FOOD" : "RIDE";
  await assertServiceAvailableAt(pickupLat, pickupLon, coverageService);
  await assertNoUnpaidRide(req.user.id, req.io);
  await assertNotBookingBlocked(req.user.id);

  if (serviceType === "DELIVERY" && (!recipientName || !recipientPhone)) {
    throw new BadRequestError("Recipient name and phone are required for delivery");
  }
  if (serviceType === "DELIVERY" && parcelMode && !["SEND", "RECEIVE"].includes(parcelMode)) {
    throw new BadRequestError("parcelMode must be SEND or RECEIVE");
  }

  if (paymentMethod === "MOBILE_MONEY") assertMomoEnabled();
  const customer = req.user;

  const customerUser = await User.findById(customer.id).select('isSuspended');
  if (customerUser?.isSuspended) {
    throw new BadRequestError("Your account is suspended. Contact support.");
  }

  try {
    const distance = calculateDistance(pickupLat, pickupLon, dropLat, dropLon);
    const settings = await getSettings();
    const fareRates = settings.fareRates || undefined;
    const fareResult = calculateFare(distance, fareRates);
    if (fareResult[vehicle] == null) {
      throw new BadRequestError("Invalid vehicle type for fare");
    }
    // Store to the pesewa so receipts, commission and the rider's offer all agree.
    const fareAmount = Math.round(fareResult[vehicle] * 100) / 100;

    const ridePayload = {
      serviceType,
      vehicle,
      distance,
      fare: fareAmount,
      pickup: {
        address: pickupAddress,
        latitude: pickupLat,
        longitude: pickupLon,
      },
      drop: { address: dropAddress, latitude: dropLat, longitude: dropLon },
      customer: customer.id,
      otp: generateOTP(),
      paymentMethod: paymentMethod === "MOBILE_MONEY" ? "MOBILE_MONEY" : "CASH",
    };
    if (serviceType === "DELIVERY") {
      ridePayload.parcelMode = parcelMode === "RECEIVE" ? "RECEIVE" : "SEND";
      ridePayload.recipientName = recipientName;
      ridePayload.recipientPhone = recipientPhone;
      ridePayload.deliveryOtp = generateOTP();
      if (deliveryNote) ridePayload.deliveryNote = deliveryNote;
      if (parcelDescription) ridePayload.parcelDescription = parcelDescription;
      if (parcelPhotoUrl && typeof parcelPhotoUrl === "string") {
        ridePayload.parcelPhotoUrl = parcelPhotoUrl.trim();
      }
    }

    const ride = new Ride({ ...ridePayload, clientRequestId });

    try {
      await ride.save();
    } catch (err) {
      if (clientRequestId && isDuplicateKeyError(err)) {
        const replay = await Ride.findOne({ customer: req.user.id, clientRequestId });
        if (replay) {
          return res.status(StatusCodes.OK).json({ message: "Ride already requested", ride: replay });
        }
      }
      throw err;
    }

    res.status(StatusCodes.CREATED).json({
      message: "Ride created successfully",
      ride,
    });
  } catch (error) {
    console.error(error);
    throw new BadRequestError("Failed to create ride");
  }
};

/** GET /ride/:rideId/courier-location — live courier coords for customer/rider tracking map */
export const getCourierLocation = async (req, res) => {
  const { rideId } = req.params;
  const userId = req.user.id;
  if (!rideId || !mongoose.isValidObjectId(rideId)) {
    throw new NotFoundError("Ride not found");
  }

  const ride = await Ride.findById(rideId).select("customer rider status").lean();
  if (!ride) throw new NotFoundError("Ride not found");

  const customerId = String(ride.customer ?? "");
  const riderId = ride.rider ? String(ride.rider) : "";
  if (customerId !== userId && riderId !== userId) {
    throw new NotFoundError("Ride not found");
  }
  if (!riderId) {
    return res.status(StatusCodes.OK).json({ coords: null });
  }

  const onDuty = getOnDutyRider(riderId);
  if (onDuty?.coords?.latitude != null && onDuty?.coords?.longitude != null) {
    return res.status(StatusCodes.OK).json({
      coords: {
        latitude: Number(onDuty.coords.latitude),
        longitude: Number(onDuty.coords.longitude),
        heading: Number(onDuty.coords.heading) || 0,
      },
      source: "live",
    });
  }

  const riderUser = await User.findById(riderId).select("currentLocation").lean();
  const coordinates = riderUser?.currentLocation?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const [longitude, latitude] = coordinates;
    return res.status(StatusCodes.OK).json({
      coords: {
        latitude: Number(latitude),
        longitude: Number(longitude),
        heading: 0,
      },
      source: "db",
    });
  }

  res.status(StatusCodes.OK).json({ coords: null });
};

/** GET /ride/:rideId - Fetch a single ride (customer or rider must be the requester) */
export const getRideById = async (req, res) => {
  const { rideId } = req.params;
  const userId = req.user.id;
  if (!rideId) {
    throw new BadRequestError("Ride ID is required");
  }
  if (!mongoose.isValidObjectId(rideId)) {
    throw new NotFoundError("Ride not found");
  }
  try {
    const ride = await Ride.findById(rideId)
      .select(RIDE_CODE_FIELDS)
      .populate("customer", "name phone averageRating totalRatings")
      .populate("rider", "name phone averageRating totalRatings currentLocation");
    if (!ride) {
      throw new NotFoundError("Ride not found");
    }
    const customerId = ride.customer?._id?.toString?.() ?? ride.customer?.toString?.();
    const riderId = ride.rider?._id?.toString?.() ?? ride.rider?.toString?.();
    if (customerId !== userId && riderId !== userId) {
      throw new NotFoundError("Ride not found");
    }

    if (ride.serviceType === "FOOD") {
      const cleaned = await cleanupStaleFoodCourierRide(ride, req.io);
      if (!cleaned) {
        throw new NotFoundError("Ride not found");
      }
    }

    // Only the customer may see their codes; the rider has to ask them for it.
    const payload = ride.toJSON();
    if (customerId === userId) {
      payload.otp = ride.otp;
      payload.deliveryOtp = ride.deliveryOtp;
    }
    res.status(StatusCodes.OK).json({ ride: payload });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof BadRequestError) throw error;
    if (error?.name === "CastError") {
      throw new NotFoundError("Ride not found");
    }
    console.error("getRideById error:", error);
    throw new BadRequestError("Failed to load ride");
  }
};

export const acceptRide = async (req, res) => {
  const riderId = req.user.id;
  const { rideId } = req.params;

  if (!rideId) {
    throw new BadRequestError("Ride ID is required");
  }

  try {
    let ride = await Ride.findById(rideId).populate("customer");

    if (!ride) {
      throw new NotFoundError("Ride not found");
    }

    // Retried accept (the first one went through but its reply was lost): this rider
    // already has the ride, so confirm instead of reporting it as taken.
    if (
      ride.rider &&
      String(ride.rider) === String(riderId) &&
      ["START", "ARRIVED", "IN_PROGRESS"].includes(ride.status)
    ) {
      ride = await ride.populate("rider", "name phone averageRating totalRatings currentLocation");
      return res.status(StatusCodes.OK).json({ message: "Ride already accepted", ride });
    }

    if (ride.status !== "SEARCHING_FOR_RIDER") {
      throw new BadRequestError("Ride is no longer available for assignment");
    }

    if (await riderHasActiveRide(riderId)) {
      throw new BadRequestError(
        "Finish your current delivery before accepting another offer"
      );
    }

    const rider = await User.findById(riderId).select("role driverDetails");
    const settings = await getSettings();
    if (!canRiderReceiveOffer(rider, ride, settings)) {
      const reason = getEligibilityRejectReason(rider, ride, settings);
      throw new BadRequestError(reason || "You cannot accept this offer");
    }

    ride.rider = riderId;
    // Status "START" means rider has accepted and is heading to pickup
    // Flow: SEARCHING_FOR_RIDER -> START (rider accepted, heading to pickup) -> ARRIVED (at pickup, OTP verified) -> COMPLETED
    ride.status = "START";
    await ride.save();

    await recordReliabilityEvent(
      riderId,
      getRideEligibilityServiceType(ride),
      "TRIP_ACCEPTED",
      settings
    );

    ride = await ride.populate("rider", "name phone averageRating totalRatings currentLocation");

    req.io.to(`ride_${rideId}`).emit("rideUpdate", ride);
    req.io.to(`ride_${rideId}`).emit("rideAccepted");

    if (ride.serviceType === "FOOD" && ride.foodOrder) {
      const foodOrder = await FoodOrder.findById(ride.foodOrder)
        .populate("restaurant", "name cuisine imageEmoji")
        .lean();
      if (foodOrder) {
        const customerId =
          foodOrder.customer?._id?.toString?.() || String(foodOrder.customer);
        notifyCustomerFoodDriverAssigned(customerId, foodOrder);
        if (req.io && customerId) {
          req.io.to(`customer_${customerId}`).emit("foodOrderUpdated", foodOrder);
        }
      }
    }

    res.status(StatusCodes.OK).json({
      message: "Ride accepted successfully",
      ride,
    });
  } catch (error) {
    console.error("Error accepting ride:", error);
    throw new BadRequestError("Failed to accept ride");
  }
};

export const updateRideStatus = async (req, res) => {
  const { rideId } = req.params;
  const { status, otp } = req.body;

  if (!rideId || !status) {
    throw new BadRequestError("Ride ID and status are required");
  }

  try {
    // Codes are loaded only to check them here; serializing the ride strips them again.
    let ride = await Ride.findById(rideId)
      .select(RIDE_CODE_FIELDS)
      .populate("customer", "name phone averageRating totalRatings")
      .populate("rider", "name phone averageRating totalRatings currentLocation");

    if (!ride) {
      throw new NotFoundError("Ride not found");
    }

    if (!["START", "ARRIVED", "IN_PROGRESS", "COMPLETED"].includes(status)) {
      throw new BadRequestError("Invalid ride status");
    }

    const isFood = ride.serviceType === "FOOD";
    // Collect-first leg (gas refill, laundry): courier hands it to the store (no customer code there).
    const isGasCollect = ride.gasLeg === "COLLECT";
    const isParcel = ride.serviceType === "DELIVERY";
    const current = ride.status;
    const invalidTransition = () =>
      new BadRequestError(
        `Invalid status transition (${ride.serviceType || "RIDE"}): ${current} -> ${status}`
      );

    // Idempotent status updates: mobile retries / duplicate actions should not fail.
    if (status === current) {
      if (req.io) {
        req.io.to(`ride_${rideId}`).emit("rideUpdate", ride);
      }
      return res.status(StatusCodes.OK).json({
        message: `Ride status already ${status}`,
        ride,
      });
    }

    // Every trip moves one step at a time (START is set by accepting). Without this a rider
    // could jump past the step that checks the customer's code, e.g. START -> COMPLETED.
    const NEXT_STATUS = { START: "ARRIVED", ARRIVED: "IN_PROGRESS", IN_PROGRESS: "COMPLETED" };
    if (NEXT_STATUS[current] !== status) {
      throw invalidTransition();
    }

    if (isFood) {
      if (status === "COMPLETED" && !isGasCollect) {
        if (!otp || String(otp) !== String(ride.otp)) {
          throw new BadRequestError("Invalid delivery code. Ask the customer for their 4-digit code.");
        }
      }
    } else if (isParcel) {
      if (status === "COMPLETED" && (!otp || String(otp) !== String(ride.deliveryOtp))) {
        throw new BadRequestError(
          "Invalid delivery code. Ask the recipient for their 4-digit code."
        );
      }
    } else if (status === "ARRIVED") {
      // Parcel pickup is an in-person handoff — only rides require the code at pickup.
      if (!otp || String(otp) !== String(ride.otp)) {
        throw new BadRequestError("Invalid OTP");
      }
    }

    ride.status = status;
    await ride.save();

    if (ride.foodOrder && isGasCollect) {
      if (status === "IN_PROGRESS") {
        await FoodOrder.findByIdAndUpdate(ride.foodOrder, { gasStage: "TO_STATION" });
      }
      if (status === "COMPLETED") {
        // It's at the store (empty cylinder or laundry bag); the store marks it ready for the return leg.
        await FoodOrder.findByIdAndUpdate(ride.foodOrder, {
          gasStage: "AT_STATION",
          gasCourier: ride.rider?._id || ride.rider,
          ride: null,
        });
      }
      // Live update for the store board and the customer's tracking (no push: the order's
      // status hasn't changed, only where their item is).
      if (req.io && (status === "IN_PROGRESS" || status === "COMPLETED")) {
        const order = await FoodOrder.findById(ride.foodOrder)
          .populate("restaurant", "name cuisine imageEmoji address latitude longitude vertical estimatedPrepMinutes")
          .populate("ride")
          .lean();
        if (order) {
          req.io.to(`food_order_${order._id}`).emit("foodOrderUpdated", order);
          req.io.to(`customer_${order.customer}`).emit("foodOrderUpdated", order);
          req.io.to(`restaurant_${order.restaurant?._id || order.restaurant}`).emit("foodOrderUpdated", order);
        }
      }
    } else if (ride.foodOrder) {
      if (status === "IN_PROGRESS") {
        await FoodOrder.findByIdAndUpdate(ride.foodOrder, { status: "PICKED_UP" });
      }
      if (status === "COMPLETED") {
        await FoodOrder.findByIdAndUpdate(ride.foodOrder, { status: "DELIVERED" });
      }
      const foodOrder = await FoodOrder.findById(ride.foodOrder)
        .populate("restaurant", "name cuisine imageEmoji")
        .populate("ride")
        .lean();
      if (foodOrder) {
        const customerId =
          foodOrder.customer?._id?.toString?.() || String(foodOrder.customer);
        if (req.io) {
          req.io.to(`food_order_${ride.foodOrder}`).emit("foodOrderUpdated", foodOrder);
          if (customerId) {
            req.io.to(`customer_${customerId}`).emit("foodOrderUpdated", foodOrder);
          }
        }
        notifyCustomerFoodOrderPush(customerId, foodOrder);
      }
    }

    // Trip completion: commission split, ledger, balance, debt check.
    // For customer mobile-money rides/parcels, payment is collected AFTER
    // completion — defer settlement until the payment is confirmed.
    if (status === "COMPLETED" && ride.rider) {
      const deferForMomo =
        (ride.serviceType === "RIDE" || ride.serviceType === "DELIVERY") &&
        ride.paymentMethod === "MOBILE_MONEY";
      if (isGasCollect) {
        // Paid with the return leg, when the whole round trip is settled.
      } else if (ride.serviceType === "FOOD" && ride.foodOrder) {
        try {
          const settlement = await settleFoodOrderOnDelivery(ride.foodOrder);
          if (settlement?.settlementStatus === "failed") {
            console.error("[ride] food settlement failed:", settlement);
          }
        } catch (err) {
          console.error("[ride] food settlement error:", err);
        }
      } else if (deferForMomo) {
        if (!ride.paymentStatus || ride.paymentStatus === "NOT_REQUIRED") {
          ride.paymentStatus = "UNPAID";
          await ride.save();
        }
      } else {
        await settleTrip(ride);
      }
      const settings = await getSettings();
      const riderIdForRel = ride.rider._id?.toString?.() ?? ride.rider.toString();
      await recordReliabilityEvent(
        riderIdForRel,
        getRideEligibilityServiceType(ride),
        "TRIP_COMPLETED",
        settings
      );
    }

    req.io.to(`ride_${rideId}`).emit("rideUpdate", ride);

    res.status(StatusCodes.OK).json({
      message: `Ride status updated to ${status}`,
      ride,
    });
  } catch (error) {
    console.error("Error updating ride status:", error);
    if (error instanceof BadRequestError || error instanceof NotFoundError) {
      throw error;
    }
    throw new BadRequestError("Failed to update ride status");
  }
};

/** GET /ride/dispatch-analytics — acceptance rates and per-service trip stats */
export const getRiderDispatchAnalytics = async (req, res) => {
  if (req.user.role !== "rider") {
    throw new BadRequestError("Rider access only");
  }
  const days = parseAnalyticsDays(req.query.days, 30);
  const user = await User.findById(req.user.id).select("driverDetails role");
  const settings = await getSettings();
  const payload = await buildRiderDispatchAnalytics(user, settings, days);
  res.status(StatusCodes.OK).json(payload);
};

/** GET /ride/reliability — strikes and per-service pause status */
export const getRiderReliability = async (req, res) => {
  if (req.user.role !== "rider") {
    throw new BadRequestError("Rider access only");
  }
  await clearExpiredPauses(req.user.id);
  const user = await User.findById(req.user.id).select("driverDetails role");
  const settings = await getSettings();
  res.status(StatusCodes.OK).json(buildRiderReliabilityPayload(user, settings));
};

/** POST /ride/offers/:rideId/decline — rider dismissed/expired offer (reliability strike) */
export const declineRideOffer = async (req, res) => {
  if (req.user.role !== "rider") {
    throw new BadRequestError("Rider access only");
  }
  const { rideId } = req.params;
  const ride = await Ride.findById(rideId);
  if (!ride || ride.status !== "SEARCHING_FOR_RIDER") {
    return res.status(StatusCodes.OK).json({ message: "Offer no longer active" });
  }
  const settings = await getSettings();
  const result = await recordReliabilityEvent(
    req.user.id,
    getRideEligibilityServiceType(ride),
    "OFFER_DECLINED",
    settings
  );
  res.status(StatusCodes.OK).json({
    message: result?.paused
      ? `${result.serviceType} offers paused — too many missed offers`
      : "Recorded",
    ...result,
  });
};

/** GET /ride/offers/pending — open offers for on-duty riders (socket fallback) */
export const getPendingRideOffers = async (req, res) => {
  if (req.user.role !== "rider") {
    throw new BadRequestError("Rider access only");
  }

  await clearExpiredPauses(req.user.id);

  if (await riderHasActiveRide(req.user.id)) {
    return res.status(StatusCodes.OK).json({ rides: [] });
  }

  const since = new Date(Date.now() - 45 * 60 * 1000);
  const rides = await Ride.find({
    status: "SEARCHING_FOR_RIDER",
    createdAt: { $gte: since },
  })
    .populate("customer", "name phone averageRating totalRatings")
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  const rider = await User.findById(req.user.id).select("role driverDetails currentLocation");
  const settings = await getSettings();
  const onDuty = getOnDutyRider(req.user.id);
  let riderCoords = onDuty?.coords ?? null;
  if (!riderCoords && rider?.currentLocation?.coordinates?.length === 2) {
    const [lon, lat] = rider.currentLocation.coordinates;
    riderCoords = { latitude: lat, longitude: lon };
  }
  const eligible = await filterRidesForRider(rides, rider, settings, riderCoords);

  res.status(StatusCodes.OK).json({ rides: eligible });
};

/** GET /ride/service-preferences — work mode, vehicle limits, effective availability */
export const getRiderServicePreferences = async (req, res) => {
  if (req.user.role !== "rider") {
    throw new BadRequestError("Rider access only");
  }

  const user = await User.findById(req.user.id).select("driverDetails role");
  if (!user?.driverDetails) {
    throw new BadRequestError("Driver profile not found");
  }

  const settings = await getSettings();
  const vehicle = normalizeVehicleCategory(user.driverDetails?.vehicle?.category);
  const supported = getVehicleSupportedServices(vehicle, settings);

  res.status(StatusCodes.OK).json(
    buildServicePreferencesPayload(user, {
      vehicleCategory: vehicle,
      vehicleSupportedServices: supported,
    })
  );
};

/** PATCH /ride/service-preferences — preset, toggles, optional per-service hours */
export const updateRiderServicePreferences = async (req, res) => {
  if (req.user.role !== "rider") {
    throw new BadRequestError("Rider access only");
  }

  const { preset, servicePreferences: prefsBody } = req.body || {};
  const user = await User.findById(req.user.id);
  if (!user?.driverDetails) {
    throw new BadRequestError("Driver profile not found");
  }

  const existing =
    user.driverDetails.servicePreferences?.toObject?.() ||
    user.driverDetails.servicePreferences ||
    {};

  let nextPrefs = null;

  if (preset && PRESET_IDS.includes(preset)) {
    nextPrefs = applyPresetToPreferences(preset, existing);
    user.driverDetails.servicePreset = preset;
  }

  const normalized = normalizeServicePreferencesInput(prefsBody);
  if (normalized) {
    nextPrefs = nextPrefs || { ...existing };
    for (const key of Object.keys(normalized)) {
      nextPrefs[key] = {
        ...(nextPrefs[key] || {}),
        ...normalized[key],
      };
    }
    if (!preset) {
      user.driverDetails.servicePreset = detectPresetFromPreferences(nextPrefs);
    }
  }

  if (!nextPrefs) {
    throw new BadRequestError(
      "Provide preset (all, ride_only, delivery_only, parcel_only, food_only) or servicePreferences"
    );
  }

  user.driverDetails.servicePreferences = nextPrefs;
  if (!user.driverDetails.servicePreset) {
    user.driverDetails.servicePreset = detectPresetFromPreferences(nextPrefs);
  }
  user.markModified("driverDetails");
  await user.save();

  const settings = await getSettings();
  const vehicle = normalizeVehicleCategory(user.driverDetails?.vehicle?.category);
  const supported = getVehicleSupportedServices(vehicle, settings);
  const meta = buildServicePreferencesPayload(user, {
    vehicleCategory: vehicle,
    vehicleSupportedServices: supported,
  });

  const payload = user.toObject();
  delete payload.password;

  res.status(StatusCodes.OK).json({
    message: "Service preferences updated",
    ...meta,
    user: payload,
  });
};

export const getMyRides = async (req, res) => {
  const userId = req.user.id;
  const { status } = req.query;

  try {
    const user = await User.findById(userId).select("role").lean();
    const query = {
      $or: [{ customer: userId }, { rider: userId }],
    };

    if (status) {
      query.status = status;
    }

    // Food/store orders already have their own history — hide linked courier rides for customers.
    if (user?.role === "customer") {
      query.foodOrder = null;
      query.serviceType = { $nin: ["FOOD"] };
    }

    let rides = await Ride.find(query)
      .populate("customer", "name phone")
      .populate("rider", "name phone averageRating totalRatings")
      .sort({ createdAt: -1 })
      .lean();

    if (user?.role === "rider" && rides.length) {
      const kept = [];
      for (const ride of rides) {
        const next =
          ride.serviceType === "FOOD"
            ? await cleanupStaleFoodCourierRide(ride, req.io)
            : ride;
        if (next) kept.push(next);
      }
      rides = kept;
    }

    if (userId && rides.length) {
      if (user?.role === "rider") {
        const completedIds = rides
          .filter((r) => r.status === "COMPLETED")
          .map((r) => r._id);
        if (completedIds.length) {
          const settings = await getSettings();
          const commissionTxns = await Transaction.find({
            driver: userId,
            ride: { $in: completedIds },
            type: "COMMISSION_DEBIT",
          })
            .populate("ride", "fare serviceType foodOrder")
            .lean();
          const breakdownByRide = await loadStoreRideBreakdowns(
            rides.filter((r) => r.status === "COMPLETED")
          );
          for (const tx of commissionTxns) {
            const rideId = tx.ride?._id?.toString?.() ?? tx.ride?.toString?.();
            // Store orders: the debit is platformNet, not a cut of the fare.
            if (rideId && !isStoreCourierRide(tx.ride)) {
              breakdownByRide.set(rideId, buildEarningsBreakdownFromCommissionTxn(tx));
            }
          }
          rides = rides.map((r) => {
            const id = r._id.toString();
            let earningsBreakdown = breakdownByRide.get(id);
            if (!earningsBreakdown && r.status === "COMPLETED" && r.fare != null) {
              earningsBreakdown = buildEarningsBreakdownForRide(r, settings);
            }
            return earningsBreakdown ? { ...r, earningsBreakdown } : r;
          });
        }
      }
    }

    res.status(StatusCodes.OK).json({
      message: "Rides retrieved successfully",
      count: rides.length,
      rides,
    });
  } catch (error) {
    console.error("Error retrieving rides:", error);
    throw new BadRequestError("Failed to retrieve rides");
  }
};

export const rateRide = async (req, res) => {
  const { rideId } = req.params;
  const { rating, review } = req.body;
  const userId = req.user.id;

  if (!rating || rating < 1 || rating > 5) {
    throw new BadRequestError("Valid rating between 1 and 5 is required");
  }

  try {
    const ride = await Ride.findById(rideId);
    if (!ride) {
      throw new NotFoundError("Ride not found");
    }

    if (ride.status !== "COMPLETED") {
      throw new BadRequestError("Can only rate completed rides");
    }

    if (ride.rider && ride.rider.toString() === userId) {
      throw new BadRequestError("Riders cannot rate customers");
    }

    if (ride.customer.toString() !== userId) {
      throw new BadRequestError("User not associated with this ride");
    }

    if (ride.serviceType === "FOOD") {
      throw new BadRequestError(
        "Rate the restaurant from your food order — not the courier for this trip"
      );
    }

    if (!["RIDE", "DELIVERY"].includes(ride.serviceType)) {
      throw new BadRequestError("This trip cannot be rated here");
    }

    if (ride.riderRating) {
      throw new BadRequestError("You have already rated this ride");
    }

    if (!ride.rider) {
      throw new BadRequestError("No rider assigned to this trip");
    }

    ride.riderRating = rating;
    ride.riderReview = review;
    const targetUserId = ride.rider;

    await ride.save();

    // Update target user's average rating
    if (targetUserId) {
      const targetUser = await User.findById(targetUserId);
      if (targetUser) {
        const newTotalRatings = targetUser.totalRatings + 1;
        const currentTotalScore = targetUser.averageRating * targetUser.totalRatings;
        // Handle case where totalRatings is 0 (initial state might be 5.0 with 0 ratings)
        const actualTotalScore = targetUser.totalRatings === 0 ? 0 : currentTotalScore;
        
        targetUser.averageRating = (actualTotalScore + rating) / newTotalRatings;
        targetUser.totalRatings = newTotalRatings;
        await targetUser.save();
      }
    }

    res.status(StatusCodes.OK).json({
      message: "Rating submitted successfully",
      ride,
    });
  } catch (error) {
    console.error("Error submitting rating:", error);
    throw new BadRequestError(error.message || "Failed to submit rating");
  }
};

/** Update rider's online status (for toggle + REST fallback when socket is down) */
/** GET /ride/transactions - Rider's ledger (transactions, balance, and earnings breakdown) */
export const getMyTransactions = async (req, res) => {
  const driverId = req.user.id;
  try {
    const user = await User.findById(driverId).select("balance driverDetails.status driverDetails.review");
    const transactions = await Transaction.find({ driver: driverId })
      .populate("ride", "fare status paymentMethod serviceType foodOrder")
      .sort({ createdAt: -1 })
      .limit(100);
    const currentBalance = Number(user?.balance ?? 0);

    const commissionTxns = await Transaction.find({
      driver: driverId,
      type: "COMMISSION_DEBIT",
    })
      .populate("ride", "fare paymentMethod serviceType")
      .lean();

    const salesSummary = buildSalesSummaryFromCommissionTxns(commissionTxns);
    const totalEarnings = salesSummary.total.gross;
    const totalCommission = salesSummary.total.commission;
    const riderAmount = salesSummary.total.net;

    const settings = await getSettings();
    const commissionByService = {
      RIDE: getCommissionRateForService(settings, "RIDE"),
      DELIVERY: getCommissionRateForService(settings, "DELIVERY"),
      FOOD: getCommissionRateForService(settings, "FOOD"),
    };

    const storeBreakdowns = await loadStoreRideBreakdowns(
      transactions.filter((tx) => tx.type === "COMMISSION_DEBIT").map((tx) => tx.ride)
    );
    const enrichedTransactions = transactions.map((tx) => {
      const doc = tx.toObject ? tx.toObject() : tx;
      if (doc.type === "COMMISSION_DEBIT" && doc.ride) {
        const earningsBreakdown = isStoreCourierRide(doc.ride)
          ? storeBreakdowns.get(String(doc.ride._id)) ?? null
          : buildEarningsBreakdownFromCommissionTxn(doc);
        return earningsBreakdown ? { ...doc, earningsBreakdown } : doc;
      }
      return doc;
    });

    res.status(StatusCodes.OK).json({
      balance: currentBalance,
      walletBalance: Math.max(0, currentBalance),
      commissionOwed: currentBalance < 0 ? Math.abs(currentBalance) : 0,
      minCashoutAmount: Number(settings.minCashoutAmount ?? 1),
      totalEarnings,
      totalCommission,
      riderAmount,
      salesSummary,
      commissionByService,
      transactions: enrichedTransactions,
      // The app refreshes the rider's account status from here (e.g. after admin approval).
      driverStatus: user?.driverDetails?.status ?? "pending",
      review: user?.driverDetails?.review?.decision
        ? {
            decision: user.driverDetails.review.decision,
            note: user.driverDetails.review.note,
            at: user.driverDetails.review.at,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw new BadRequestError("Failed to fetch transactions");
  }
};

export const updateRiderStatus = async (req, res) => {
  const { isOnline } = req.body;
  const riderId = req.user.id;

  if (typeof isOnline !== "boolean") {
    throw new BadRequestError("isOnline must be a boolean");
  }

  const user = await User.findById(riderId);
  if (!user || user.role !== "rider") {
    throw new BadRequestError("Only riders can update duty status");
  }

  await User.findByIdAndUpdate(riderId, { isOnline });
  res.status(StatusCodes.OK).json({ message: "Status updated", isOnline });
};

/** GET /ride/rider-alert-sound — admin-configured URL for offer alerts (loops while offers pending) */
export const getRiderAlertSound = async (req, res) => {
  const settings = await getSettings();
  const url = resolveRiderAlertSoundUrl(settings, req);
  res.status(StatusCodes.OK).json({ url });
};

/** GET /ride/unpaid — the customer's MoMo trip that still isn't paid (for the "Pay now" banner). */
export const getMyUnpaidRide = async (req, res) => {
  const ride = await findUnpaidRide(req.user.id, req.io);
  res.status(StatusCodes.OK).json({ unpaidRide: unpaidRideSummary(ride) });
};

/**
 * POST /ride/:rideId/paid-cash — the rider confirms the customer paid in cash instead of mobile
 * money. The trip settles as a cash trip and the customer can book again.
 */
export const confirmCashPayment = async (req, res) => {
  const ride = await Ride.findById(req.params.rideId);
  if (!ride || String(ride.rider) !== String(req.user.id)) throw new NotFoundError("Trip not found");
  if (!isUnpaidMomoTrip(ride)) {
    if (ride.paymentStatus === "PAID") {
      return res.status(StatusCodes.OK).json({ outcome: "already_paid", ride, message: "The customer already paid by mobile money." });
    }
    throw new BadRequestError("This trip isn't waiting for a mobile money payment");
  }
  const { outcome } = await markRidePaidInCash(ride, { by: "RIDER", io: req.io });
  res.status(StatusCodes.OK).json({
    outcome,
    ride,
    message:
      outcome === "already_paid"
        ? "The customer already paid by mobile money."
        : "Marked as paid in cash. QareGO's commission comes off your balance, as on any cash trip.",
  });
};
