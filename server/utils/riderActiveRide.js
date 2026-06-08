import Ride from "../models/Ride.js";

export const ACTIVE_RIDE_STATUSES = ["START", "ARRIVED", "IN_PROGRESS"];

/** Rider is already on a trip — no new offers until it completes. */
export async function riderHasActiveRide(riderId) {
  if (!riderId) return false;
  const ride = await Ride.findOne({
    rider: riderId,
    status: { $in: ACTIVE_RIDE_STATUSES },
  })
    .select("_id")
    .lean();
  return !!ride;
}

/** Set of rider ids with an in-progress assignment (batch helper for broadcasts). */
export async function getBusyRiderIdSet(riderIds = []) {
  if (!riderIds.length) return new Set();
  const busy = await Ride.distinct("rider", {
    rider: { $in: riderIds },
    status: { $in: ACTIVE_RIDE_STATUSES },
  });
  return new Set(busy.map((id) => String(id)));
}
