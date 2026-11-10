import { StatusCodes } from "http-status-codes";
import ParcelPoint, { PARCEL_POINT_KINDS } from "../models/ParcelPoint.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { normalizeParcelPointInput, sortParcelPoints } from "../utils/parcelPoints.js";

const PUBLIC_FIELDS = "name kind address latitude longitude instructions hours canPickup canDrop";

/** GET /parcel-points?lat=&lon=&use=pickup|drop — active points for the customer app. */
export const listParcelPoints = async (req, res) => {
  const query = { isActive: true };
  if (req.query.use === "pickup") query.canPickup = true;
  if (req.query.use === "drop") query.canDrop = true;
  const points = await ParcelPoint.find(query).select(PUBLIC_FIELDS).limit(500).lean();
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  res.status(StatusCodes.OK).json({
    points: sortParcelPoints(points, req.query.lat ? lat : NaN, req.query.lon ? lon : NaN),
  });
};

/** GET /admin/parcel-points */
export const adminListParcelPoints = async (_req, res) => {
  const points = await ParcelPoint.find({}).sort({ name: 1 }).lean();
  res.status(StatusCodes.OK).json({ points, kinds: PARCEL_POINT_KINDS });
};

/** POST /admin/parcel-points */
export const adminCreateParcelPoint = async (req, res) => {
  const { value, error } = normalizeParcelPointInput(req.body);
  if (error) throw new BadRequestError(error);
  const point = await ParcelPoint.create(value);
  res.status(StatusCodes.CREATED).json({ point });
};

/** PATCH /admin/parcel-points/:id */
export const adminUpdateParcelPoint = async (req, res) => {
  const point = await ParcelPoint.findById(req.params.id);
  if (!point) throw new NotFoundError("Pickup point not found");
  const { value, error } = normalizeParcelPointInput(req.body, { partial: true });
  if (error) throw new BadRequestError(error);
  point.set(value);
  if (point.canPickup === false && point.canDrop === false) {
    throw new BadRequestError("Allow at least pickup or drop-off");
  }
  await point.save();
  res.status(StatusCodes.OK).json({ point });
};

/** DELETE /admin/parcel-points/:id */
export const adminDeleteParcelPoint = async (req, res) => {
  const point = await ParcelPoint.findByIdAndDelete(req.params.id);
  if (!point) throw new NotFoundError("Pickup point not found");
  res.status(StatusCodes.OK).json({ ok: true, deleted: { name: point.name } });
};
