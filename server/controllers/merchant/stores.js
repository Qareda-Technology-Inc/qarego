import User from "../../models/User.js";
import Restaurant from "../../models/Restaurant.js";
import MenuItem from "../../models/MenuItem.js";
import StoreCategory from "../../models/StoreCategory.js";
import { applyStoreTypeToRestaurantFields } from "../commerceStoreType.js";
import { inferVerticalFromCategoryName } from "../../utils/commerceStoreTypes.js";
import { sanitizeImageUrl } from "../../utils/mediaStorage.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, NotFoundError } from "../../errors/index.js";
import { normalizePhone } from "../../utils/phone.js";
import { detectGhMomoChannel } from "../../utils/momo.js";
import { sanitizeHours } from "../../utils/storeHours.js";
import { storeDebtStatus, storeOpenState } from "../../utils/storeDebt.js";
import { getSettings } from "../../utils/tripSettlement.js";
import { getStoreReadiness, reviewStatus } from "../../utils/storeReadiness.js";

/** GET /merchant/restaurants — all stores this account can manage */
export const listMyRestaurants = async (req, res) => {
  let restaurants;
  if (req.user.role === "cook") {
    const cook = await User.findById(req.user.id).select("restaurant");
    restaurants = cook?.restaurant
      ? await Restaurant.find({ _id: cook.restaurant }).lean()
      : [];
  } else {
    restaurants = await Restaurant.find({ owner: req.user.id }).sort({ createdAt: 1 }).lean();
  }

  const ids = restaurants.map((r) => r._id);
  const counts = await MenuItem.aggregate([
    { $match: { restaurant: { $in: ids } } },
    { $group: { _id: "$restaurant", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  const withCounts = restaurants.map((r) => ({
    ...r,
    menuItemCount: countMap.get(String(r._id)) || 0,
  }));

  res.status(StatusCodes.OK).json({ restaurants: withCounts });
};

/** POST /merchant/restaurants — merchant creates a new store they own */
export const createMyRestaurant = async (req, res) => {
  const {
    name,
    address,
    latitude,
    longitude,
    allowsPickup,
    category,
    cuisine,
    imageEmoji,
    imageUrl,
    description,
    minOrderAmount,
    estimatedPrepMinutes,
  } = req.body;

  if (!name || !address || latitude == null || longitude == null) {
    throw new BadRequestError("Name, address, and location are required");
  }

  const fields = {
    name: name.trim(),
    address: address.trim(),
    latitude: Number(latitude),
    longitude: Number(longitude),
    // Actual delivery pricing is distance-based at checkout (Food).
    // We keep this legacy field for compatibility; default to 0 when omitted.
    deliveryFee: Number(req.body.deliveryFee ?? 0),
    category: category?.trim() || "Restaurant",
    cuisine: cuisine?.trim() || "Local",
    imageEmoji: imageEmoji?.trim() || "🍽️",
    imageUrl: sanitizeImageUrl(imageUrl),
    description: description?.trim() || "",
    minOrderAmount: minOrderAmount != null ? Number(minOrderAmount) : 0,
    estimatedPrepMinutes: estimatedPrepMinutes != null ? Number(estimatedPrepMinutes) : 25,
    allowsPickup: !!allowsPickup,
  };

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
      { owner: req.user.id, name: categoryName.trim() },
      { $setOnInsert: { owner: req.user.id, name: categoryName.trim() } },
      { upsert: true }
    );
  }

  // Hidden from customers until QareGO approves it (see submitMyStoreForReview).
  const restaurant = await Restaurant.create({
    ...fields,
    owner: req.user.id,
    isActive: false,
    isAcceptingOrders: true,
    review: { status: "draft" },
  });

  res.status(StatusCodes.CREATED).json({ message: "Store created", restaurant });
};

/** GET /merchant/categories — store categories this vendor has defined */
export const listMyCategories = async (req, res) => {
  const categories = await StoreCategory.find({ owner: req.user.id })
    .sort({ name: 1 })
    .lean();
  res.status(StatusCodes.OK).json({ categories });
};

/** POST /merchant/categories — vendor creates a reusable store category */
export const createMyCategory = async (req, res) => {
  const name = req.body.name?.trim();
  if (!name) throw new BadRequestError("Category name is required");

  const existing = await StoreCategory.findOne({ owner: req.user.id, name });
  if (existing) {
    return res.status(StatusCodes.OK).json({ category: existing });
  }

  const category = await StoreCategory.create({ owner: req.user.id, name });
  res.status(StatusCodes.CREATED).json({ message: "Category added", category });
};

/** DELETE /merchant/categories/:id — remove one of the vendor's categories */
export const deleteMyCategory = async (req, res) => {
  const category = await StoreCategory.findOneAndDelete({
    _id: req.params.id,
    owner: req.user.id,
  });
  if (!category) throw new NotFoundError("Category not found");
  res.status(StatusCodes.OK).json({ message: "Category removed" });
};

/** GET /merchant/restaurant — my restaurant profile */
export const getMyRestaurant = async (req, res) => {
  const restaurant = await Restaurant.findById(req.restaurantId)
    .populate("owner", "name username phone")
    .lean();
  const settings = await getSettings();
  const openState = restaurant ? storeOpenState(restaurant, settings) : null;
  const debt = restaurant ? storeDebtStatus(restaurant, settings) : null;
  const readiness = restaurant ? await getStoreReadiness(restaurant) : null;
  if (restaurant?.review) delete restaurant.review.by;
  res.status(StatusCodes.OK).json({
    restaurant,
    openState,
    debt,
    role: req.user.role,
    reviewStatus: restaurant ? reviewStatus(restaurant) : null,
    readiness,
  });
};

const MERCHANT_EDITABLE = [
  "description",
  "imageEmoji",
  "imageUrl",
  "cuisine",
  "minOrderAmount",
  "estimatedPrepMinutes",
  "isAcceptingOrders",
];

/** PATCH /merchant/restaurant — owner edits profile/availability (not platform status/fees) */
export const updateMyRestaurant = async (req, res) => {
  const restaurant = await Restaurant.findById(req.restaurantId);
  if (!restaurant) throw new NotFoundError("Restaurant not found");

  const tagFields = {};
  await applyStoreTypeToRestaurantFields(req.body, tagFields);
  if (tagFields.tags?.length) {
    Object.assign(restaurant, tagFields);
  }

  for (const key of MERCHANT_EDITABLE) {
    if (req.body[key] === undefined) continue;
    if (key === "imageUrl") {
      restaurant.imageUrl = sanitizeImageUrl(req.body.imageUrl);
      continue;
    }
    restaurant[key] = req.body[key];
  }

  if (req.body.openingHours !== undefined) {
    const hours = sanitizeHours(req.body.openingHours);
    if (!hours) throw new BadRequestError("Opening hours must cover all 7 days");
    restaurant.openingHours = hours;
  }

  if (req.body.address !== undefined) {
    const addr = String(req.body.address).trim();
    if (!addr) throw new BadRequestError("Address cannot be empty");
    restaurant.address = addr;
  }

  if (req.body.latitude !== undefined || req.body.longitude !== undefined) {
    if (req.body.latitude == null || req.body.longitude == null) {
      throw new BadRequestError("Latitude and longitude are required");
    }
    restaurant.latitude = Number(req.body.latitude);
    restaurant.longitude = Number(req.body.longitude);
    if (!Number.isFinite(restaurant.latitude) || !Number.isFinite(restaurant.longitude)) {
      throw new BadRequestError("Invalid latitude or longitude");
    }
  }

  // Owner can set the MoMo number their order payouts go to (name / phone / network).
  if (req.body.payoutConfig && typeof req.body.payoutConfig === "object") {
    if (req.user.role !== "merchant") {
      throw new BadRequestError("Only the store owner can update settlement MoMo");
    }
    const next = req.body.payoutConfig;
    const prev = restaurant.payoutConfig || {};
    const recipientMsisdn =
      next.recipientMsisdn !== undefined
        ? normalizePhone(String(next.recipientMsisdn || "")) || null
        : prev.recipientMsisdn || null;
    const recipientName =
      next.recipientName !== undefined
        ? String(next.recipientName || "").trim() || null
        : prev.recipientName || null;
    if (recipientMsisdn && !recipientName) {
      throw new BadRequestError("Recipient name is required when a MoMo phone is set");
    }
    restaurant.payoutConfig = {
      instantPayoutEnabled: Boolean(prev.instantPayoutEnabled),
      recipientName,
      recipientMsisdn,
      channel: recipientMsisdn
        ? detectGhMomoChannel(recipientMsisdn)
        : prev.channel || "mtn-gh",
    };
  }

  if (req.body.licence && typeof req.body.licence === "object") {
    const url = req.body.licence.url !== undefined ? sanitizeImageUrl(req.body.licence.url) : restaurant.licence?.url;
    const number =
      req.body.licence.number !== undefined
        ? String(req.body.licence.number || "").trim() || null
        : restaurant.licence?.number;
    restaurant.licence = { url: url || null, number: number || null, uploadedAt: new Date() };
  }

  await restaurant.save();

  res.status(StatusCodes.OK).json({ message: "Restaurant updated", restaurant });
};

/**
 * POST /merchant/restaurant/submit-review — ask QareGO to put the store live.
 * Only once every checklist item is done; a store that's already live can't be resubmitted.
 */
export const submitMyStoreForReview = async (req, res) => {
  const restaurant = await Restaurant.findById(req.restaurantId);
  if (!restaurant) throw new NotFoundError("Restaurant not found");

  const status = reviewStatus(restaurant);
  if (status === "approved") throw new BadRequestError("This store is already approved");
  if (status === "pending") throw new BadRequestError("This store is already waiting for review");

  const readiness = await getStoreReadiness(restaurant);
  if (!readiness.ready) {
    const missing = readiness.items.filter((i) => !i.done).map((i) => i.label.toLowerCase());
    throw new BadRequestError(`Finish these first: ${missing.join(", ")}`);
  }

  restaurant.review = {
    status: "pending",
    note: restaurant.review?.note ?? null,
    submittedAt: new Date(),
    decidedAt: restaurant.review?.decidedAt ?? null,
    by: restaurant.review?.by ?? null,
  };
  await restaurant.save();
  res.status(StatusCodes.OK).json({ message: "Sent for review", reviewStatus: "pending", readiness });
};

/**
 * PATCH /merchant/restaurant/accepting — pause/resume new orders.
 * Available to BOTH the owner and cooks (kitchen staff can stop the queue
 * when they're swamped), but not platform-level activation.
 */
export const setAcceptingOrders = async (req, res) => {
  const restaurant = await Restaurant.findById(req.restaurantId);
  if (!restaurant) throw new NotFoundError("Restaurant not found");

  if (typeof req.body.isAcceptingOrders !== "boolean") {
    throw new BadRequestError("isAcceptingOrders must be true or false");
  }
  restaurant.isAcceptingOrders = req.body.isAcceptingOrders;
  await restaurant.save();

  const openState = storeOpenState(restaurant, await getSettings());
  res.status(StatusCodes.OK).json({
    message: restaurant.isAcceptingOrders ? "Orders resumed" : "Orders paused",
    isAcceptingOrders: restaurant.isAcceptingOrders,
    openState,
  });
};
