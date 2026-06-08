import User from "../models/User.js";
import Ride from "../models/Ride.js";
import { getSettings } from "./tripSettlement.js";
import { canRiderReceiveOffer } from "./riderServiceEligibility.js";
import { getOnDutyRidersEntries } from "./onDutyRidersRegistry.js";
import {
  attachDispatchMeta,
  rankEligibleRidersForRide,
  getDispatchPoolSize,
  sortRidesByScoreForRider,
} from "./offerRanking.js";
import { notifyRidersPushOffer } from "./pushNotifications.js";
import { getBusyRiderIdSet } from "./riderActiveRide.js";

const WAVE_DELAY_MS = 12_000;

/** Broadcast with tiered waves: top-ranked riders first, then expand. */
export async function emitRideOfferToEligibleRiders(io, ride, options = {}) {
  const { tiered = true } = options;
  if (!io || !ride) return 0;

  const rideWithCustomer = await Ride.findById(ride._id).populate(
    "customer",
    "name phone averageRating totalRatings"
  );
  if (!rideWithCustomer) return 0;

  const settings = await getSettings();
  const entries = getOnDutyRidersEntries();
  if (!entries.length) {
    io.to(`ride_${ride._id}`).emit("rideData", rideWithCustomer);
    return 0;
  }

  const riderIds = entries.map(([id]) => id);
  const busyRiderIds = await getBusyRiderIdSet(riderIds);
  const riders = await User.find({ _id: { $in: riderIds } }).select("role driverDetails");
  const riderById = new Map(riders.map((r) => [r._id.toString(), r]));

  const ranked = [];
  for (const [riderId, data] of entries) {
    if (busyRiderIds.has(String(riderId))) continue;
    const rider = riderById.get(String(riderId));
    if (rider && canRiderReceiveOffer(rider, rideWithCustomer, settings)) {
      ranked.push({ rider, coords: data.coords });
    }
  }

  const scored = rankEligibleRidersForRide(ranked, rideWithCustomer, settings);
  if (!scored.length) {
    io.to(`ride_${ride._id}`).emit("rideData", rideWithCustomer);
    return 0;
  }

  const emitSlice = (slice) => {
    notifyRidersPushOffer(slice, rideWithCustomer);
    for (const row of slice) {
      const payload = attachDispatchMeta(rideWithCustomer, row.dispatchMeta);
      io.to(`rider_${row.rider._id}`).emit("rideOffer", payload);
    }
  };

  const rideId = ride._id.toString();

  if (!tiered || scored.length <= 3) {
    emitSlice(scored);
    io.to(`ride_${ride._id}`).emit("rideData", rideWithCustomer);
    return scored.length;
  }

  const wave1End = getDispatchPoolSize(1, scored.length);
  emitSlice(scored.slice(0, wave1End));

  setTimeout(async () => {
    try {
      const current = await Ride.findById(rideId).select("status");
      if (!current || current.status !== "SEARCHING_FOR_RIDER") return;
      const wave2End = getDispatchPoolSize(2, scored.length);
      emitSlice(scored.slice(wave1End, wave2End));
    } catch (err) {
      console.error("[dispatch] wave 2 failed:", err);
    }
  }, WAVE_DELAY_MS);

  setTimeout(async () => {
    try {
      const current = await Ride.findById(rideId).select("status");
      if (!current || current.status !== "SEARCHING_FOR_RIDER") return;
      const wave2End = getDispatchPoolSize(2, scored.length);
      emitSlice(scored.slice(wave2End));
    } catch (err) {
      console.error("[dispatch] wave 3 failed:", err);
    }
  }, WAVE_DELAY_MS * 2);

  io.to(`ride_${ride._id}`).emit("rideData", rideWithCustomer);
  return scored.length;
}

/** Emit ranked offer to nearby eligible riders (expands pool on later search retries). */
export function emitRankedOfferToRiders(io, ride, rankedRows, retryIndex = 1) {
  if (!io || !ride || !rankedRows?.length) return 0;
  const poolSize = Math.min(3 + Math.floor((retryIndex - 1) / 2) * 2, rankedRows.length);
  const slice = rankedRows.slice(0, poolSize);
  notifyRidersPushOffer(
    slice.map((row) => ({ rider: row.rider })),
    ride
  );
  for (const row of slice) {
    const payload = attachDispatchMeta(ride, row.dispatchMeta);
    io.to(row.socketId).emit("rideOffer", payload);
  }
  return slice.length;
}

/** Filter + score-sort rides for one rider (REST / goOnDuty replay). */
export async function filterRidesForRider(rides, riderUser, settings, riderCoords = null) {
  if (!Array.isArray(rides) || !rides.length) return [];
  const s = settings || (await getSettings());
  const eligible = rides.filter((ride) => canRiderReceiveOffer(riderUser, ride, s));
  return sortRidesByScoreForRider(eligible, riderUser, riderCoords, s);
}
