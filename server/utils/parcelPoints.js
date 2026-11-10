import { PARCEL_POINT_KINDS } from "../models/ParcelPoint.js";

const clean = (v, max = 200) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

/**
 * Validates an admin create/edit body. Returns the fields to save, or { error }.
 * With `partial`, missing fields are left out (PATCH).
 */
export function normalizeParcelPointInput(body = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    const name = clean(body.name, 80);
    if (!name) return { error: "Name is required" };
    out.name = name;
  }
  if (!partial || body.latitude !== undefined || body.longitude !== undefined) {
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (
      body.latitude == null || body.longitude == null ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)
    ) {
      return { error: "Pick the location on the map" };
    }
    out.latitude = lat;
    out.longitude = lng;
  }
  if (!partial || body.kind !== undefined) {
    const kind = String(body.kind || "OTHER").toUpperCase();
    out.kind = PARCEL_POINT_KINDS.includes(kind) ? kind : "OTHER";
  }
  for (const [key, max] of [["address", 200], ["instructions", 300], ["phone", 30], ["hours", 80]]) {
    if (!partial || body[key] !== undefined) out[key] = clean(body[key], max);
  }
  for (const key of ["canPickup", "canDrop", "isActive"]) {
    if (!partial || body[key] !== undefined) out[key] = body[key] !== false;
  }
  if (out.canPickup === false && out.canDrop === false) {
    return { error: "Allow at least pickup or drop-off" };
  }
  return { value: out };
}

const toRad = (d) => (d * Math.PI) / 180;
export function distanceKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Points sorted nearest first (with distanceKm) when a position is given, else by name. */
export function sortParcelPoints(points, lat, lon) {
  const hasPos = Number.isFinite(lat) && Number.isFinite(lon);
  const withDist = points.map((p) => ({
    ...p,
    distanceKm: hasPos ? Math.round(distanceKm(lat, lon, p.latitude, p.longitude) * 10) / 10 : null,
  }));
  return withDist.sort((a, b) =>
    hasPos ? a.distanceKm - b.distanceKm : String(a.name).localeCompare(String(b.name))
  );
}
