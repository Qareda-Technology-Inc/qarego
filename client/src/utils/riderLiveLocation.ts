export type RiderLiveCoords = {
  latitude: number;
  longitude: number;
  heading?: number;
};

/** Normalize rider id from populated doc or raw ObjectId string. */
export function normalizeRiderId(rider: unknown): string | null {
  if (!rider) return null;
  if (typeof rider === "string") return rider;
  if (typeof rider === "object") {
    const id = (rider as { _id?: unknown; id?: unknown })._id ?? (rider as { id?: unknown }).id;
    if (id != null) return String(id);
  }
  return null;
}

export function parseRiderLiveCoords(input: unknown): RiderLiveCoords | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as {
    latitude?: unknown;
    longitude?: unknown;
    heading?: unknown;
    currentLocation?: { coordinates?: unknown[] };
  };

  let latitude = Number(raw.latitude);
  let longitude = Number(raw.longitude);

  const coords = raw.currentLocation?.coordinates;
  if (
    (!Number.isFinite(latitude) || !Number.isFinite(longitude)) &&
    Array.isArray(coords) &&
    coords.length >= 2
  ) {
    longitude = Number(coords[0]);
    latitude = Number(coords[1]);
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const heading = Number(raw.heading);
  return {
    latitude,
    longitude,
    heading: Number.isFinite(heading) ? heading : undefined,
  };
}

export function coordsFromRideRider(ride: { rider?: unknown } | null | undefined): RiderLiveCoords | null {
  if (!ride?.rider) return null;
  return parseRiderLiveCoords(ride.rider);
}

export function parseCourierLocationPayload(data: unknown): RiderLiveCoords | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as { coords?: unknown; rider?: unknown };
  if (raw.coords) return parseRiderLiveCoords(raw.coords);
  if (raw.rider) return parseRiderLiveCoords(raw.rider);
  return parseRiderLiveCoords(raw);
}

export function courierCoordsChanged(
  prev: RiderLiveCoords | null | undefined,
  next: RiderLiveCoords | null | undefined,
  epsilon = 0.00001
): boolean {
  if (!next) return false;
  if (!prev) return true;
  return (
    Math.abs(prev.latitude - next.latitude) > epsilon ||
    Math.abs(prev.longitude - next.longitude) > epsilon ||
    Math.abs((prev.heading ?? 0) - (next.heading ?? 0)) > 1
  );
}
