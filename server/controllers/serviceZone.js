import ServiceZone from "../models/ServiceZone.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import {
  resolveServiceCoverage,
  normalizeServiceTypes,
  SERVICE_ZONE_TYPES,
} from "../utils/serviceZones.js";

function parseCenter(body) {
  const lat = Number(body?.center?.latitude ?? body?.latitude);
  const lng = Number(body?.center?.longitude ?? body?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new BadRequestError("Center latitude and longitude are required");
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new BadRequestError("Invalid coordinates");
  }
  return { latitude: lat, longitude: lng };
}

function parseRadiusKm(value) {
  const radiusKm = Number(value);
  if (!Number.isFinite(radiusKm) || radiusKm < 0.1) {
    throw new BadRequestError("Radius must be at least 0.1 km");
  }
  if (radiusKm > 500) {
    throw new BadRequestError("Radius cannot exceed 500 km");
  }
  return Number(radiusKm.toFixed(2));
}

/** GET /admin/service-zones */
export const adminListServiceZones = async (req, res) => {
  const { active } = req.query;
  const query = {};
  if (active === "true") query.isActive = true;
  if (active === "false") query.isActive = false;
  const zones = await ServiceZone.find(query).sort({ name: 1 }).lean();
  res.status(StatusCodes.OK).json({ zones, serviceTypes: SERVICE_ZONE_TYPES });
};

/** POST /admin/service-zones */
export const adminCreateServiceZone = async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) throw new BadRequestError("Zone name is required");

  const center = parseCenter(req.body);
  const radiusKm = parseRadiusKm(req.body.radiusKm);
  const serviceTypes = normalizeServiceTypes(req.body.serviceTypes);

  const zone = await ServiceZone.create({
    name,
    center,
    radiusKm,
    address: req.body.address?.trim() || null,
    isActive: req.body.isActive !== false,
    serviceTypes,
    notes: req.body.notes?.trim() || null,
  });

  res.status(StatusCodes.CREATED).json({ message: "Service zone created", zone });
};

/** GET /admin/service-zones/:id */
export const adminGetServiceZone = async (req, res) => {
  const zone = await ServiceZone.findById(req.params.id).lean();
  if (!zone) throw new NotFoundError("Service zone not found");
  res.status(StatusCodes.OK).json({ zone });
};

/** PATCH /admin/service-zones/:id */
export const adminUpdateServiceZone = async (req, res) => {
  const zone = await ServiceZone.findById(req.params.id);
  if (!zone) throw new NotFoundError("Service zone not found");

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw new BadRequestError("Zone name cannot be empty");
    zone.name = name;
  }
  if (req.body.center || req.body.latitude != null || req.body.longitude != null) {
    zone.center = parseCenter(req.body);
  }
  if (req.body.radiusKm !== undefined) {
    zone.radiusKm = parseRadiusKm(req.body.radiusKm);
  }
  if (req.body.address !== undefined) {
    zone.address = String(req.body.address || "").trim() || null;
  }
  if (req.body.isActive !== undefined) {
    zone.isActive = !!req.body.isActive;
  }
  if (req.body.serviceTypes !== undefined) {
    zone.serviceTypes = normalizeServiceTypes(req.body.serviceTypes);
  }
  if (req.body.notes !== undefined) {
    zone.notes = String(req.body.notes || "").trim() || null;
  }

  await zone.save();
  res.status(StatusCodes.OK).json({ message: "Service zone updated", zone });
};

/**
 * DELETE /admin/service-zones/:id
 * Soft-deactivate by default so historical references stay intact.
 * Pass ?hard=true to permanently delete.
 */
export const adminDeleteServiceZone = async (req, res) => {
  const zone = await ServiceZone.findById(req.params.id);
  if (!zone) throw new NotFoundError("Service zone not found");

  if (String(req.query.hard) === "true") {
    await zone.deleteOne();
    return res.status(StatusCodes.OK).json({ message: "Service zone deleted" });
  }

  zone.isActive = false;
  await zone.save();
  res.status(StatusCodes.OK).json({
    message: "Service zone deactivated",
    zone,
  });
};

/**
 * POST /service-zones/check
 * Body: { latitude, longitude }
 * Auth required (customer/rider).
 */
export const checkServiceCoverage = async (req, res) => {
  const coverage = await resolveServiceCoverage(req.body.latitude, req.body.longitude);
  res.status(StatusCodes.OK).json(coverage);
};
