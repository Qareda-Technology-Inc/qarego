import mongoose from "mongoose";
import Ride from "../models/Ride.js";
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
  buildEarningsBreakdownFromCommissionTxn,
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

const VALID_VEHICLES = ["motorcycle", "pragya", "comfort"];
const VALID_SERVICE_TYPES = ["RIDE", "DELIVERY"];

/** GET /ride/fare-rates — platform distance fare config for ride & parcel booking */
export const getFareRates = async (req, res) => {
  const settings = await getSettings();
  res.status(StatusCodes.OK).json({ fareRates: settings?.fareRates ?? null });
};

export const createRide = async (req, res) => {
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

  if (serviceType === "DELIVERY" && (!recipientName || !recipientPhone)) {
    throw new BadRequestError("Recipient name and phone are required for delivery");
  }
  if (serviceType === "DELIVERY" && parcelMode && !["SEND", "RECEIVE"].includes(parcelMode)) {
    throw new BadRequestError("parcelMode must be SEND or RECEIVE");
  }

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
    const fareAmount = fareResult[vehicle];
    if (fareAmount == null) {
      throw new BadRequestError("Invalid vehicle type for fare");
    }

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

    const ride = new Ride(ridePayload);

    await ride.save();

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
    const ride = await Ride.findById(rideId).populate(
      "customer",
      "name phone averageRating totalRatings"
    ).populate("rider", "name phone averageRating totalRatings currentLocation");
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

    res.status(StatusCodes.OK).json({ ride });
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
    let ride = await Ride.findById(rideId)
      .populate("customer", "name phone averageRating totalRatings")
      .populate("rider", "name phone averageRating totalRatings currentLocation");

    if (!ride) {
      throw new NotFoundError("Ride not found");
    }

    if (!["START", "ARRIVED", "IN_PROGRESS", "COMPLETED"].includes(status)) {
      throw new BadRequestError("Invalid ride status");
    }

    const isFood = ride.serviceType === "FOOD";
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

    if (isFood) {
      if (status === "ARRIVED" && current !== "START") {
        throw invalidTransition();
      }
      if (status === "IN_PROGRESS" && current !== "ARRIVED") {
        throw invalidTransition();
      }
      if (status === "COMPLETED" && current !== "IN_PROGRESS") {
        throw invalidTransition();
      }
      if (status === "COMPLETED") {
        if (!otp || String(otp) !== String(ride.otp)) {
          throw new BadRequestError("Invalid delivery code. Ask the customer for their 4-digit code.");
        }
      }
    } else if (isParcel && status === "COMPLETED" && current === "IN_PROGRESS") {
      if (!otp || String(otp) !== String(ride.deliveryOtp)) {
        throw new BadRequestError(
          "Invalid delivery code. Ask the recipient for their 4-digit code."
        );
      }
    } else if (status === "ARRIVED" && current === "START" && !isParcel) {
      // Parcel pickup is in-person handoff — only rides require OTP at pickup.
      if (!otp || String(otp) !== String(ride.otp)) {
        throw new BadRequestError("Invalid OTP");
      }
    }

    ride.status = status;
    await ride.save();

    if (ride.foodOrder) {
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

    // Trip completion: commission split, ledger, balance, debt check
    if (status === "COMPLETED" && ride.rider) {
      await settleTrip(ride);
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
            .populate("ride", "fare serviceType")
            .lean();
          const breakdownByRide = new Map();
          for (const tx of commissionTxns) {
            const rideId = tx.ride?._id?.toString?.() ?? tx.ride?.toString?.();
            if (rideId) {
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
    const user = await User.findById(driverId).select("balance");
    const transactions = await Transaction.find({ driver: driverId })
      .populate("ride", "fare status paymentMethod serviceType")
      .sort({ createdAt: -1 })
      .limit(100);
    const currentBalance = Number(user?.balance ?? 0);

    // Compute totals from commission debits (each = one completed trip)
    const commissionTxns = await Transaction.find({
      driver: driverId,
      type: "COMMISSION_DEBIT",
    })
      .populate("ride", "fare")
      .lean();
    let totalEarnings = 0; // Total fare from all trips (gross)
    let totalCommission = 0; // Total commission owed/paid to company
    for (const tx of commissionTxns) {
      if (tx.ride?.fare != null) totalEarnings += Number(tx.ride.fare);
      totalCommission += Math.abs(Number(tx.amount ?? 0));
    }
    const riderAmount = totalEarnings - totalCommission; // Rider's take-home from trips

    const settings = await getSettings();
    const commissionByService = {
      RIDE: getCommissionRateForService(settings, "RIDE"),
      DELIVERY: getCommissionRateForService(settings, "DELIVERY"),
      FOOD: getCommissionRateForService(settings, "FOOD"),
    };

    const enrichedTransactions = transactions.map((tx) => {
      const doc = tx.toObject ? tx.toObject() : tx;
      if (doc.type === "COMMISSION_DEBIT" && doc.ride) {
        return {
          ...doc,
          earningsBreakdown: buildEarningsBreakdownFromCommissionTxn(doc),
        };
      }
      return doc;
    });

    res.status(StatusCodes.OK).json({
      balance: currentBalance,
      totalEarnings,
      totalCommission,
      riderAmount,
      commissionByService,
      transactions: enrichedTransactions,
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
