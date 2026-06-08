import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import MenuItem from "../models/MenuItem.js";
import StoreCategory from "../models/StoreCategory.js";
import { applyStoreTypeToRestaurantFields } from "./commerceStoreType.js";
import { inferVerticalFromCategoryName } from "../utils/commerceStoreTypes.js";
import User from "../models/User.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { normalizePhone } from "../utils/phone.js";
import { sanitizeImageUrl } from "../utils/mediaStorage.js";

const RESTAURANT_FIELDS = [
  "name",
  "description",
  "category",
  "vertical",
  "storeType",
  "cuisine",
  "imageEmoji",
  "imageUrl",
  "deliveryFee",
  "minOrderAmount",
  "estimatedPrepMinutes",
  "isActive",
  "isAcceptingOrders",
  "allowsPickup",
  "address",
  "latitude",
  "longitude",
];

function pickRestaurantFields(body) {
  const out = {};
  for (const key of RESTAURANT_FIELDS) {
    if (body[key] === undefined) continue;
    if (key === "imageUrl") {
      out.imageUrl = sanitizeImageUrl(body.imageUrl);
      continue;
    }
    out[key] = body[key];
  }
  return out;
}

/** POST /admin/vendors — create a standalone vendor (merchant) account */
export const adminCreateVendor = async (req, res) => {
  const { username, password, name, phone } = req.body;
  if (!username || !password) {
    throw new BadRequestError("Username and password are required");
  }
  const existing = await User.findOne({ username: username.trim() });
  if (existing) {
    throw new BadRequestError("That username is already taken");
  }
  const vendor = await User.create({
    role: "merchant",
    username: username.trim(),
    password,
    name: name?.trim() || username.trim(),
    phone: phone ? normalizePhone(phone) : undefined,
  });
  res.status(StatusCodes.CREATED).json({
    message: "Vendor created",
    vendor: {
      _id: vendor._id,
      name: vendor.name,
      username: vendor.username,
      phone: vendor.phone,
      storeCount: 0,
    },
  });
};

/** GET /admin/vendors — all merchant (vendor) accounts with how many stores each runs */
export const adminListVendors = async (req, res) => {
  const vendors = await User.find({ role: "merchant" })
    .select("name username phone createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const ids = vendors.map((v) => v._id);
  const counts = await Restaurant.aggregate([
    { $match: { owner: { $in: ids } } },
    { $group: { _id: "$owner", total: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.total]));

  const withCounts = vendors.map((v) => ({
    ...v,
    storeCount: countMap.get(String(v._id)) || 0,
  }));

  res.status(StatusCodes.OK).json({ vendors: withCounts });
};

/** PATCH /admin/vendors/:vendorId — update vendor profile details */
export const adminUpdateVendor = async (req, res) => {
  const { vendorId } = req.params;
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new BadRequestError("Invalid vendor id");
  }

  const vendor = await User.findOne({ _id: vendorId, role: "merchant" });
  if (!vendor) throw new NotFoundError("Vendor not found");

  const { name, phone, username, password } = req.body;
  if (name !== undefined) vendor.name = String(name).trim();
  if (phone !== undefined) vendor.phone = phone ? normalizePhone(String(phone)) : undefined;
  if (username !== undefined) {
    const next = String(username).trim();
    if (!next) throw new BadRequestError("Username cannot be empty");
    if (next !== vendor.username) {
      const existing = await User.findOne({ username: next });
      if (existing) throw new BadRequestError("That username is already taken");
      vendor.username = next;
    }
  }
  if (password !== undefined && String(password).trim()) {
    vendor.password = String(password);
  }

  await vendor.save();

  const storeCount = await Restaurant.countDocuments({ owner: vendor._id });
  res.status(StatusCodes.OK).json({
    message: "Vendor updated",
    vendor: {
      _id: vendor._id,
      name: vendor.name,
      username: vendor.username,
      phone: vendor.phone,
      storeCount,
    },
  });
};

/** DELETE /admin/vendors/:vendorId — remove vendor account (optional store reassignment) */
export const adminDeleteVendor = async (req, res) => {
  const { vendorId } = req.params;
  const { reassignToVendorId } = req.body || {};
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new BadRequestError("Invalid vendor id");
  }

  const vendor = await User.findOne({ _id: vendorId, role: "merchant" });
  if (!vendor) throw new NotFoundError("Vendor not found");

  if (reassignToVendorId) {
    if (!mongoose.isValidObjectId(reassignToVendorId)) {
      throw new BadRequestError("Invalid reassignment vendor id");
    }
    if (String(reassignToVendorId) === String(vendorId)) {
      throw new BadRequestError("Cannot reassign stores to the same vendor");
    }
    const target = await User.findOne({ _id: reassignToVendorId, role: "merchant" });
    if (!target) throw new BadRequestError("Reassignment vendor not found");
    await Restaurant.updateMany({ owner: vendorId }, { $set: { owner: target._id } });
  } else {
    await Restaurant.updateMany({ owner: vendorId }, { $set: { owner: null } });
  }

  await StoreCategory.deleteMany({ owner: vendorId });
  await User.deleteOne({ _id: vendorId });

  res.status(StatusCodes.OK).json({ message: "Vendor deleted" });
};

/** GET /admin/vendors/:vendorId/categories — store categories a vendor has defined */
export const adminListVendorCategories = async (req, res) => {
  const { vendorId } = req.params;
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new BadRequestError("Invalid vendor id");
  }
  const vendor = await User.findOne({ _id: vendorId, role: "merchant" });
  if (!vendor) throw new NotFoundError("Vendor not found");

  const categories = await StoreCategory.find({ owner: vendorId }).sort({ name: 1 }).lean();
  res.status(StatusCodes.OK).json({ categories });
};

/** POST /admin/vendors/:vendorId/categories — add a category for a vendor (admin setup) */
export const adminCreateVendorCategory = async (req, res) => {
  const { vendorId } = req.params;
  const name = req.body.name?.trim();
  if (!mongoose.isValidObjectId(vendorId)) {
    throw new BadRequestError("Invalid vendor id");
  }
  if (!name) throw new BadRequestError("Category name is required");

  const vendor = await User.findOne({ _id: vendorId, role: "merchant" });
  if (!vendor) throw new NotFoundError("Vendor not found");

  const existing = await StoreCategory.findOne({ owner: vendorId, name });
  if (existing) {
    return res.status(StatusCodes.OK).json({ category: existing });
  }

  const category = await StoreCategory.create({ owner: vendorId, name });
  res.status(StatusCodes.CREATED).json({ message: "Category added", category });
};

/** GET /admin/restaurants — every restaurant (active + inactive) with menu counts + owner */
export const adminListRestaurants = async (req, res) => {
  const restaurants = await Restaurant.find({})
    .sort({ createdAt: -1 })
    .populate("owner", "name username phone")
    .lean();

  const ids = restaurants.map((r) => r._id);
  const counts = await MenuItem.aggregate([
    { $match: { restaurant: { $in: ids } } },
    { $group: { _id: "$restaurant", total: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.total]));

  const withCounts = restaurants.map((r) => ({
    ...r,
    menuItemCount: countMap.get(r._id.toString()) || 0,
  }));

  res.status(StatusCodes.OK).json({ restaurants: withCounts });
};

/** GET /admin/restaurants/:id — restaurant + full menu + owner */
export const adminGetRestaurant = async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id)
    .populate("owner", "name username phone")
    .lean();
  if (!restaurant) {
    throw new NotFoundError("Restaurant not found");
  }

  const menuItems = await MenuItem.find({ restaurant: restaurant._id })
    .sort({ category: 1, name: 1 })
    .lean();

  res.status(StatusCodes.OK).json({ restaurant, menuItems });
};

/**
 * POST /admin/restaurants — create a restaurant. Every restaurant MUST have a vendor owner:
 *  - assign an existing vendor with `ownerId`, OR
 *  - create a new merchant login with `owner: { username, password, name, phone }`.
 */
export const adminCreateRestaurant = async (req, res) => {
  const fields = pickRestaurantFields(req.body);

  if (!fields.name || !fields.address) {
    throw new BadRequestError("Name and address are required");
  }
  if (fields.latitude == null || fields.longitude == null) {
    throw new BadRequestError("Latitude and longitude are required");
  }

  const { owner, ownerId } = req.body;
  let resolvedOwnerId = null;

  if (ownerId) {
    if (!mongoose.isValidObjectId(ownerId)) {
      throw new BadRequestError("Invalid vendor selected");
    }
    const ownerUser = await User.findById(ownerId);
    if (!ownerUser || ownerUser.role !== "merchant") {
      throw new BadRequestError("Selected vendor not found");
    }
    resolvedOwnerId = ownerUser._id;
  } else if (owner && (owner.username || owner.password)) {
    if (!owner.username || !owner.password) {
      throw new BadRequestError("Vendor login needs both username and password");
    }
    const existing = await User.findOne({ username: owner.username.trim() });
    if (existing) {
      throw new BadRequestError("That vendor username is already taken");
    }
    const ownerUser = await User.create({
      role: "merchant",
      username: owner.username.trim(),
      password: owner.password,
      name: owner.name?.trim() || fields.name,
      phone: owner.phone ? normalizePhone(owner.phone) : undefined,
    });
    resolvedOwnerId = ownerUser._id;
  } else {
    throw new BadRequestError(
      "Every restaurant must have a vendor owner — pick an existing vendor or create a new login"
    );
  }

  if (fields.deliveryFee == null) fields.deliveryFee = 0;

  await applyStoreTypeToRestaurantFields(req.body, fields);
  if (!fields.vertical) {
    fields.vertical = inferVerticalFromCategoryName(fields.category);
  }

  const tagNames = fields.tags?.length
    ? fields.tags
    : fields.category?.trim()
    ? [fields.category.trim()]
    : [];
  for (const categoryName of tagNames) {
    if (!categoryName?.trim()) continue;
    await StoreCategory.updateOne(
      { owner: resolvedOwnerId, name: categoryName.trim() },
      { $setOnInsert: { owner: resolvedOwnerId, name: categoryName.trim() } },
      { upsert: true }
    );
  }

  const restaurant = await Restaurant.create({ ...fields, owner: resolvedOwnerId });

  const populated = await Restaurant.findById(restaurant._id)
    .populate("owner", "name username phone")
    .lean();

  res.status(StatusCodes.CREATED).json({
    message: "Restaurant created",
    restaurant: populated,
  });
};

/** PATCH /admin/restaurants/:id — update profile, status, or assign/replace owner */
export const adminUpdateRestaurant = async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) {
    throw new NotFoundError("Restaurant not found");
  }

  const fields = pickRestaurantFields(req.body);
  await applyStoreTypeToRestaurantFields(req.body, fields);
  Object.assign(restaurant, fields);
  if (fields.category && !fields.vertical) {
    restaurant.vertical = inferVerticalFromCategoryName(fields.category);
  }

  // Assign an existing user as owner, or detach with null
  if (req.body.ownerId !== undefined) {
    if (req.body.ownerId === null || req.body.ownerId === "") {
      restaurant.owner = null;
    } else {
      const ownerUser = await User.findById(req.body.ownerId);
      if (!ownerUser) throw new BadRequestError("Owner user not found");
      restaurant.owner = ownerUser._id;
    }
  }

  // Create a new vendor login and attach as owner
  const { owner } = req.body;
  if (owner && (owner.username || owner.password)) {
    if (!owner.username || !owner.password) {
      throw new BadRequestError("Vendor login needs both username and password");
    }
    const existing = await User.findOne({ username: owner.username });
    if (existing) {
      throw new BadRequestError("That vendor username is already taken");
    }
    const ownerUser = await User.create({
      role: "merchant",
      username: owner.username.trim(),
      password: owner.password,
      name: owner.name?.trim() || restaurant.name,
      phone: owner.phone ? normalizePhone(owner.phone) : undefined,
    });
    restaurant.owner = ownerUser._id;
  }

  await restaurant.save();

  const populated = await Restaurant.findById(restaurant._id)
    .populate("owner", "name username phone")
    .lean();

  res.status(StatusCodes.OK).json({ message: "Restaurant updated", restaurant: populated });
};

/** DELETE /admin/restaurants/:id — remove restaurant and its menu items */
export const adminDeleteRestaurant = async (req, res) => {
  const restaurant = await Restaurant.findByIdAndDelete(req.params.id);
  if (!restaurant) {
    throw new NotFoundError("Restaurant not found");
  }
  await MenuItem.deleteMany({ restaurant: restaurant._id });

  res.status(StatusCodes.OK).json({ message: "Restaurant removed" });
};

/** POST /admin/restaurants/:id/menu — add a menu item */
export const adminCreateMenuItem = async (req, res) => {
  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) {
    throw new NotFoundError("Restaurant not found");
  }

  const { name, description, price, category, isAvailable, imageUrl } = req.body;
  if (!name || price == null) {
    throw new BadRequestError("Menu item name and price are required");
  }
  if (Number(price) < 0) {
    throw new BadRequestError("Price cannot be negative");
  }

  const item = await MenuItem.create({
    restaurant: restaurant._id,
    name: name.trim(),
    description: description?.trim() || "",
    price: Number(price),
    category: category?.trim() || "Mains",
    isAvailable: isAvailable !== false,
    imageUrl: sanitizeImageUrl(imageUrl),
  });

  res.status(StatusCodes.CREATED).json({ message: "Menu item added", item });
};

/** PATCH /admin/restaurants/:id/menu/:itemId — update a menu item */
export const adminUpdateMenuItem = async (req, res) => {
  const item = await MenuItem.findOne({
    _id: req.params.itemId,
    restaurant: req.params.id,
  });
  if (!item) {
    throw new NotFoundError("Menu item not found");
  }

  const { name, description, price, category, isAvailable, imageUrl } = req.body;
  if (name !== undefined) item.name = name.trim();
  if (description !== undefined) item.description = description.trim();
  if (price !== undefined) {
    if (Number(price) < 0) throw new BadRequestError("Price cannot be negative");
    item.price = Number(price);
  }
  if (category !== undefined) item.category = category.trim() || "Mains";
  if (isAvailable !== undefined) item.isAvailable = !!isAvailable;
  if (imageUrl !== undefined) item.imageUrl = sanitizeImageUrl(imageUrl);

  await item.save();

  res.status(StatusCodes.OK).json({ message: "Menu item updated", item });
};

/** DELETE /admin/restaurants/:id/menu/:itemId — remove a menu item */
export const adminDeleteMenuItem = async (req, res) => {
  const item = await MenuItem.findOneAndDelete({
    _id: req.params.itemId,
    restaurant: req.params.id,
  });
  if (!item) {
    throw new NotFoundError("Menu item not found");
  }

  res.status(StatusCodes.OK).json({ message: "Menu item removed" });
};
