import mongoose from "mongoose";
import CommerceStoreType from "../models/CommerceStoreType.js";
import Restaurant from "../models/Restaurant.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { ensureDefaultStoreTypes } from "../utils/commerceStoreTypes.js";

/** GET /admin/store-types — list all (seeds defaults if empty) */
export const adminListStoreTypes = async (req, res) => {
  await ensureDefaultStoreTypes();
  const { vertical } = req.query;
  const query = {};
  if (vertical && ["FOOD", "GROCERY", "PHARMACY"].includes(String(vertical).toUpperCase())) {
    query.vertical = String(vertical).toUpperCase();
  }
  const storeTypes = await CommerceStoreType.find(query).sort({ vertical: 1, sortOrder: 1, name: 1 }).lean();
  res.status(StatusCodes.OK).json({ storeTypes });
};

/** POST /admin/store-types */
export const adminCreateStoreType = async (req, res) => {
  const name = req.body.name?.trim();
  const vertical = String(req.body.vertical || "").toUpperCase();
  if (!name) throw new BadRequestError("Name is required");
  if (!["FOOD", "GROCERY", "PHARMACY"].includes(vertical)) {
    throw new BadRequestError("Vertical must be FOOD, GROCERY, or PHARMACY");
  }
  const existing = await CommerceStoreType.findOne({ name, vertical });
  if (existing) throw new BadRequestError("This store type already exists for that module");
  const storeType = await CommerceStoreType.create({
    name,
    vertical,
    emoji: req.body.emoji?.trim() || "🍽️",
    sortOrder: Number(req.body.sortOrder) || 0,
    isActive: req.body.isActive !== false,
  });
  res.status(StatusCodes.CREATED).json({ message: "Store type created", storeType });
};

/** PATCH /admin/store-types/:id */
export const adminUpdateStoreType = async (req, res) => {
  const storeType = await CommerceStoreType.findById(req.params.id);
  if (!storeType) throw new NotFoundError("Store type not found");

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw new BadRequestError("Name cannot be empty");
    storeType.name = name;
  }
  if (req.body.vertical !== undefined) {
    const vertical = String(req.body.vertical).toUpperCase();
    if (!["FOOD", "GROCERY", "PHARMACY"].includes(vertical)) {
      throw new BadRequestError("Vertical must be FOOD, GROCERY, or PHARMACY");
    }
    storeType.vertical = vertical;
  }
  if (req.body.emoji !== undefined) storeType.emoji = String(req.body.emoji).trim() || "🍽️";
  if (req.body.sortOrder !== undefined) storeType.sortOrder = Number(req.body.sortOrder) || 0;
  if (req.body.isActive !== undefined) storeType.isActive = !!req.body.isActive;

  await storeType.save();
  res.status(StatusCodes.OK).json({ message: "Store type updated", storeType });
};

/** DELETE /admin/store-types/:id — deactivate if stores still use it */
export const adminDeleteStoreType = async (req, res) => {
  const storeType = await CommerceStoreType.findById(req.params.id);
  if (!storeType) throw new NotFoundError("Store type not found");

  const inUse = await Restaurant.countDocuments({
    $or: [{ storeType: storeType._id }, { storeTypes: storeType._id }],
  });
  if (inUse > 0) {
    storeType.isActive = false;
    await storeType.save();
    return res.status(StatusCodes.OK).json({
      message: "Store type deactivated (still used by existing stores)",
      storeType,
    });
  }

  await CommerceStoreType.deleteOne({ _id: storeType._id });
  res.status(StatusCodes.OK).json({ message: "Store type removed" });
};

/** GET /merchant/store-types — active types for store creation */
export const merchantListStoreTypes = async (req, res) => {
  await ensureDefaultStoreTypes();
  const storeTypes = await CommerceStoreType.find({ isActive: true })
    .sort({ vertical: 1, sortOrder: 1, name: 1 })
    .select("name vertical emoji sortOrder")
    .lean();
  res.status(StatusCodes.OK).json({ storeTypes });
};

function normalizeStoreTypeIds(body) {
  if (Array.isArray(body.storeTypeIds) && body.storeTypeIds.length) {
    return [...new Set(body.storeTypeIds.map(String).filter(Boolean))];
  }
  if (body.storeTypeId) {
    return [String(body.storeTypeId)];
  }
  return [];
}

/** Resolve storeTypeIds → tags[], vertical, legacy category/cuisine fields */
export async function applyStoreTypeToRestaurantFields(body, fields) {
  const ids = normalizeStoreTypeIds(body);
  if (!ids.length) return;

  for (const id of ids) {
    if (!mongoose.isValidObjectId(id)) {
      throw new BadRequestError("Invalid category tag selected");
    }
  }

  const storeTypes = await CommerceStoreType.find({ _id: { $in: ids }, isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  if (storeTypes.length !== ids.length) {
    throw new BadRequestError("One or more category tags not found or inactive");
  }

  const verticals = [...new Set(storeTypes.map((t) => t.vertical))];
  if (verticals.length > 1) {
    throw new BadRequestError(
      "All category tags must be from the same module (Food, Grocery, or Pharmacy)"
    );
  }

  const names = storeTypes.map((t) => t.name);
  const vertical = verticals[0];

  fields.tags = names;
  fields.storeTypes = storeTypes.map((t) => t._id);
  fields.storeType = storeTypes[0]._id;
  fields.category = names[0];
  fields.vertical = vertical;
  if (vertical === "FOOD") {
    fields.cuisine = names[0];
  }
  if (!fields.imageEmoji || fields.imageEmoji === "🍽️") {
    fields.imageEmoji = storeTypes[0].emoji;
  }
}
