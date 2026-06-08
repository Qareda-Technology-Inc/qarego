import mongoose from "mongoose";
import User from "../models/User.js";
import Restaurant from "../models/Restaurant.js";
import MenuItem from "../models/MenuItem.js";
import MenuCategory from "../models/MenuCategory.js";
import FoodOrder from "../models/FoodOrder.js";
import StoreCategory from "../models/StoreCategory.js";
import { applyStoreTypeToRestaurantFields } from "./commerceStoreType.js";
import { inferVerticalFromCategoryName } from "../utils/commerceStoreTypes.js";
import { sanitizeImageUrl } from "../utils/mediaStorage.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, NotFoundError, UnauthenticatedError } from "../errors/index.js";
import { applyRestaurantAction } from "../utils/foodOrderFlow.js";
import { normalizePhone } from "../utils/phone.js";
import { computeOpenState, sanitizeHours } from "../utils/storeHours.js";
import { getSettings } from "../utils/tripSettlement.js";
import { layoutFromAdminDefaults, normalizeMenuTags, MENU_ITEM_TAGS } from "../utils/menuDisplay.js";
import { applyMenuDiscount, enrichMenuItemForDisplay } from "../utils/menuDiscount.js";
import { buildMenuPayload } from "../utils/menuResponse.js";
import {
  formatModifiersForMenuItem,
  normalizeModifierGroups,
} from "../utils/menuModifiers.js";
import { resolveKitchenAlertSoundUrl } from "../utils/platformAlertSound.js";

/** POST /auth/merchant/login — vendor (merchant) or cook login */
export const merchantLogin = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new BadRequestError("Please provide username and password");
  }

  const user = await User.findOne({ username }).select("+password");
  if (!user) {
    throw new UnauthenticatedError("Invalid Credentials");
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError("Invalid Credentials");
  }

  if (user.role !== "merchant" && user.role !== "cook") {
    throw new UnauthenticatedError("Access Denied: not a restaurant account");
  }

  if (user.isSuspended) {
    throw new UnauthenticatedError("Account disabled. Contact your manager.");
  }

  let restaurants = [];
  if (user.role === "merchant") {
    // A merchant can own/operate many stores (may be empty until they create one)
    restaurants = await Restaurant.find({ owner: user._id })
      .select("name imageEmoji vertical")
      .sort({ createdAt: 1 })
      .lean();
  } else {
    if (!user.restaurant) {
      throw new UnauthenticatedError("No restaurant is linked to this account yet");
    }
    const r = await Restaurant.findById(user.restaurant).select("name imageEmoji vertical").lean();
    if (!r) {
      throw new UnauthenticatedError("No restaurant is linked to this account yet");
    }
    restaurants = [r];
  }

  const accessToken = user.createAccessToken();
  const refreshToken = user.createRefreshToken();

  res.status(StatusCodes.OK).json({
    user: {
      userId: user._id,
      name: user.name,
      role: user.role,
    },
    restaurants,
    accessToken,
    refreshToken,
  });
};

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

  const restaurant = await Restaurant.create({
    ...fields,
    owner: req.user.id,
    isActive: true,
    isAcceptingOrders: true,
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

/**
 * GET /merchant/overview — owner dashboard across ALL their stores.
 * Returns totals plus a per-store breakdown (staff, menu, today's orders/revenue,
 * pending/active counts). Owner-only.
 */
export const getMyOverview = async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const restaurants = await Restaurant.find({ owner: req.user.id })
    .select("name imageEmoji cuisine vertical address isActive isAcceptingOrders")
    .sort({ createdAt: 1 })
    .lean();

  const ids = restaurants.map((r) => r._id);

  const byRestaurant = (arr) => new Map(arr.map((c) => [String(c._id), c]));

  const [menuCounts, cookCounts, todayAgg, pendingAgg, activeAgg] = await Promise.all([
    MenuItem.aggregate([
      { $match: { restaurant: { $in: ids } } },
      { $group: { _id: "$restaurant", count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { role: "cook", restaurant: { $in: ids } } },
      { $group: { _id: "$restaurant", count: { $sum: 1 } } },
    ]),
    FoodOrder.aggregate([
      {
        $match: {
          restaurant: { $in: ids },
          createdAt: { $gte: startOfDay },
          status: { $ne: "CANCELLED" },
        },
      },
      { $group: { _id: "$restaurant", count: { $sum: 1 }, revenue: { $sum: "$subtotal" } } },
    ]),
    FoodOrder.aggregate([
      { $match: { restaurant: { $in: ids }, status: "PLACED" } },
      { $group: { _id: "$restaurant", count: { $sum: 1 } } },
    ]),
    FoodOrder.aggregate([
      {
        $match: {
          restaurant: { $in: ids },
          status: { $in: ["PREPARING", "READY_FOR_PICKUP", "PICKED_UP"] },
        },
      },
      { $group: { _id: "$restaurant", count: { $sum: 1 } } },
    ]),
  ]);

  const menuMap = byRestaurant(menuCounts);
  const cookMap = byRestaurant(cookCounts);
  const todayMap = byRestaurant(todayAgg);
  const pendingMap = byRestaurant(pendingAgg);
  const activeMap = byRestaurant(activeAgg);

  const stores = restaurants.map((r) => {
    const key = String(r._id);
    const today = todayMap.get(key);
    return {
      ...r,
      menuItemCount: menuMap.get(key)?.count || 0,
      cookCount: cookMap.get(key)?.count || 0,
      todayOrders: today?.count || 0,
      todayRevenue: today?.revenue || 0,
      pending: pendingMap.get(key)?.count || 0,
      active: activeMap.get(key)?.count || 0,
    };
  });

  const totals = stores.reduce(
    (acc, s) => {
      acc.staff += s.cookCount;
      acc.menuItems += s.menuItemCount;
      acc.todayOrders += s.todayOrders;
      acc.todayRevenue += s.todayRevenue;
      acc.pending += s.pending;
      acc.active += s.active;
      return acc;
    },
    { stores: stores.length, staff: 0, menuItems: 0, todayOrders: 0, todayRevenue: 0, pending: 0, active: 0 }
  );

  res.status(StatusCodes.OK).json({ totals, stores });
};

/** GET /merchant/restaurant — my restaurant profile */
export const getMyRestaurant = async (req, res) => {
  const restaurant = await Restaurant.findById(req.restaurantId)
    .populate("owner", "name username phone")
    .lean();
  const openState = restaurant ? computeOpenState(restaurant) : null;
  res.status(StatusCodes.OK).json({ restaurant, openState, role: req.user.role });
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

  await restaurant.save();

  res.status(StatusCodes.OK).json({ message: "Restaurant updated", restaurant });
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

  const openState = computeOpenState(restaurant);
  res.status(StatusCodes.OK).json({
    message: restaurant.isAcceptingOrders ? "Orders resumed" : "Orders paused",
    isAcceptingOrders: restaurant.isAcceptingOrders,
    openState,
  });
};

/** GET /merchant/menu-categories */
export const listMyMenuCategories = async (req, res) => {
  const categories = await MenuCategory.find({ restaurant: req.restaurantId })
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  res.status(StatusCodes.OK).json({ categories, availableTags: MENU_ITEM_TAGS });
};

/** POST /merchant/menu-categories */
export const createMyMenuCategory = async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) throw new BadRequestError("Category name is required");

  const settings = await getSettings();
  const displayLayout =
    req.body.displayLayout === "row" || req.body.displayLayout === "column"
      ? req.body.displayLayout
      : layoutFromAdminDefaults(name, settings.menuCategoryLayouts);

  const sortOrder = Number.isFinite(Number(req.body.sortOrder))
    ? Number(req.body.sortOrder)
    : (await MenuCategory.countDocuments({ restaurant: req.restaurantId }));

  try {
    const category = await MenuCategory.create({
      restaurant: req.restaurantId,
      name,
      sortOrder,
      displayLayout,
    });
    res.status(StatusCodes.CREATED).json({ message: "Category created", category });
  } catch (err) {
    if (err?.code === 11000) throw new BadRequestError("This category name already exists");
    throw err;
  }
};

/** PATCH /merchant/menu-categories/:id */
export const updateMyMenuCategory = async (req, res) => {
  const category = await MenuCategory.findOne({
    _id: req.params.id,
    restaurant: req.restaurantId,
  });
  if (!category) throw new NotFoundError("Category not found");

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw new BadRequestError("Category name cannot be empty");
    category.name = name;
  }
  if (req.body.displayLayout === "row" || req.body.displayLayout === "column") {
    category.displayLayout = req.body.displayLayout;
  }
  if (req.body.sortOrder !== undefined && Number.isFinite(Number(req.body.sortOrder))) {
    category.sortOrder = Number(req.body.sortOrder);
  }

  await category.save();

  if (req.body.name !== undefined) {
    await MenuItem.updateMany(
      { restaurant: req.restaurantId, menuCategory: category._id },
      { $set: { category: category.name } }
    );
  }

  res.status(StatusCodes.OK).json({ message: "Category updated", category });
};

/** DELETE /merchant/menu-categories/:id */
export const deleteMyMenuCategory = async (req, res) => {
  const category = await MenuCategory.findOneAndDelete({
    _id: req.params.id,
    restaurant: req.restaurantId,
  });
  if (!category) throw new NotFoundError("Category not found");

  await MenuItem.updateMany(
    { restaurant: req.restaurantId, menuCategory: category._id },
    { $set: { menuCategory: null, category: "Other" } }
  );

  res.status(StatusCodes.OK).json({ message: "Category removed" });
};

async function resolveMenuCategoryForItem(restaurantId, { menuCategoryId, category }) {
  if (menuCategoryId) {
    const cat = await MenuCategory.findOne({ _id: menuCategoryId, restaurant: restaurantId });
    if (!cat) throw new BadRequestError("Invalid menu category");
    return { menuCategory: cat._id, category: cat.name };
  }
  const name = String(category || "Mains").trim() || "Mains";
  let cat = await MenuCategory.findOne({
    restaurant: restaurantId,
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  });
  if (!cat) {
    const settings = await getSettings();
    cat = await MenuCategory.create({
      restaurant: restaurantId,
      name,
      sortOrder: await MenuCategory.countDocuments({ restaurant: restaurantId }),
      displayLayout: layoutFromAdminDefaults(name, settings.menuCategoryLayouts),
    });
  }
  return { menuCategory: cat._id, category: cat.name };
}

/** GET /merchant/menu — my menu */
export const listMyMenu = async (req, res) => {
  const menuItems = await MenuItem.find({ restaurant: req.restaurantId })
    .sort({ category: 1, name: 1 })
    .lean();
  const settings = await getSettings();
  const { categories, menu } = await buildMenuPayload(
    req.restaurantId,
    menuItems,
    settings.menuCategoryLayouts
  );
  const itemsOut = menuItems.map((item) => ({
    ...enrichMenuItemForDisplay(item),
    modifierGroups: formatModifiersForMenuItem(item),
  }));
  res.status(StatusCodes.OK).json({ menuItems: itemsOut, categories, menu });
};

/** POST /merchant/menu — owner adds an item */
export const createMyMenuItem = async (req, res) => {
  const {
    name,
    description,
    price,
    category,
    menuCategoryId,
    isAvailable,
    imageUrl,
    tags,
    badge,
    discountLabel,
    discountPercent,
    originalPrice,
  } = req.body;
  if (!name || (price == null && originalPrice == null)) {
    throw new BadRequestError("Menu item name and price are required");
  }

  const catFields = await resolveMenuCategoryForItem(req.restaurantId, {
    menuCategoryId,
    category,
  });

  const pricing = applyMenuDiscount({
    price,
    originalPrice: originalPrice ?? price,
    discountPercent,
    discountLabel,
    badge: badge === "discount" ? "discount" : null,
  });

  if (pricing.price < 0) throw new BadRequestError("Price cannot be negative");

  const item = await MenuItem.create({
    restaurant: req.restaurantId,
    name: name.trim(),
    description: description?.trim() || "",
    price: pricing.price,
    ...catFields,
    isAvailable: isAvailable !== false,
    imageUrl: sanitizeImageUrl(imageUrl),
    tags: normalizeMenuTags(tags),
    badge: pricing.badge,
    discountLabel: pricing.discountLabel,
    discountPercent: pricing.discountPercent,
    originalPrice: pricing.originalPrice,
  });

  res.status(StatusCodes.CREATED).json({ message: "Menu item added", item });
};

/**
 * PATCH /merchant/menu/:itemId
 * Owner can edit everything; cooks can only flip availability (mark sold out / back).
 */
export const updateMyMenuItem = async (req, res) => {
  const item = await MenuItem.findOne({
    _id: req.params.itemId,
    restaurant: req.restaurantId,
  });
  if (!item) throw new NotFoundError("Menu item not found");

  const isOwner = req.user.role === "merchant";

  if (req.body.isAvailable !== undefined) {
    item.isAvailable = !!req.body.isAvailable;
  }

  if (isOwner) {
    const {
      name,
      description,
      price,
      category,
      menuCategoryId,
      imageUrl,
      tags,
      badge,
      discountLabel,
      discountPercent,
      originalPrice,
    } = req.body;
    if (name !== undefined) item.name = name.trim();
    if (description !== undefined) item.description = description.trim();
    if (menuCategoryId !== undefined || category !== undefined) {
      const catFields = await resolveMenuCategoryForItem(req.restaurantId, {
        menuCategoryId,
        category: category ?? item.category,
      });
      item.menuCategory = catFields.menuCategory;
      item.category = catFields.category;
    }
    if (imageUrl !== undefined) item.imageUrl = sanitizeImageUrl(imageUrl);
    if (tags !== undefined) item.tags = normalizeMenuTags(tags);

    const pricingTouched =
      badge !== undefined ||
      price !== undefined ||
      originalPrice !== undefined ||
      discountPercent !== undefined ||
      discountLabel !== undefined;

    if (pricingTouched) {
      const pricing = applyMenuDiscount({
        price: price !== undefined ? price : item.price,
        originalPrice:
          originalPrice !== undefined ? originalPrice : item.originalPrice ?? item.price,
        discountPercent:
          discountPercent !== undefined ? discountPercent : item.discountPercent,
        discountLabel:
          discountLabel !== undefined ? discountLabel : item.discountLabel,
        badge:
          badge !== undefined
            ? badge === "discount"
              ? "discount"
              : null
            : item.badge,
      });
      if (pricing.price < 0) throw new BadRequestError("Price cannot be negative");
      item.price = pricing.price;
      item.badge = pricing.badge;
      item.discountLabel = pricing.discountLabel;
      item.discountPercent = pricing.discountPercent;
      item.originalPrice = pricing.originalPrice;
    }
  }

  await item.save();
  res.status(StatusCodes.OK).json({ message: "Menu item updated", item });
};

/** PATCH /merchant/menu/:itemId/modifiers — replace add-ons / option groups */
export const updateMyMenuItemModifiers = async (req, res) => {
  const item = await MenuItem.findOne({
    _id: req.params.itemId,
    restaurant: req.restaurantId,
  });
  if (!item) throw new NotFoundError("Menu item not found");

  try {
    item.modifierGroups = normalizeModifierGroups(req.body?.modifierGroups ?? []);
  } catch (err) {
    throw new BadRequestError(err?.message || "Invalid modifier groups");
  }

  await item.save();
  res.status(StatusCodes.OK).json({
    message: "Modifiers updated",
    item: {
      ...enrichMenuItemForDisplay(item.toObject()),
      modifierGroups: formatModifiersForMenuItem(item),
    },
  });
};

/** DELETE /merchant/menu/:itemId — owner removes an item */
export const deleteMyMenuItem = async (req, res) => {
  const item = await MenuItem.findOneAndDelete({
    _id: req.params.itemId,
    restaurant: req.restaurantId,
  });
  if (!item) throw new NotFoundError("Menu item not found");
  res.status(StatusCodes.OK).json({ message: "Menu item removed" });
};

/** GET /merchant/stats — quick kitchen summary for today */
export const getMyStats = async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayAgg, pending, active] = await Promise.all([
    FoodOrder.aggregate([
      {
        $match: {
          restaurant: req.restaurantId,
          createdAt: { $gte: startOfDay },
          status: { $ne: "CANCELLED" },
        },
      },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$subtotal" } } },
    ]),
    FoodOrder.countDocuments({ restaurant: req.restaurantId, status: "PLACED" }),
    FoodOrder.countDocuments({
      restaurant: req.restaurantId,
      status: { $in: ["PREPARING", "READY_FOR_PICKUP", "PICKED_UP"] },
    }),
  ]);

  const today = todayAgg[0] || { count: 0, revenue: 0 };

  res.status(StatusCodes.OK).json({
    todayOrders: today.count,
    todayRevenue: today.revenue,
    pending,
    active,
  });
};

/** GET /merchant/kitchen-alert-sound — admin-configured alert URL for new orders */
export const getKitchenAlertSound = async (req, res) => {
  const settings = await getSettings();
  const url = resolveKitchenAlertSoundUrl(settings, req);
  res.status(StatusCodes.OK).json({ url });
};

const KITCHEN_STATUSES = ["PLACED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP"];
const ACTIVE_KITCHEN_STATUSES = ["PREPARING", "READY_FOR_PICKUP", "PICKED_UP"];
const HISTORY_STATUSES = ["DELIVERED", "CANCELLED"];
const VALID_ORDER_STATUSES = [...KITCHEN_STATUSES, ...HISTORY_STATUSES];

function buildMerchantOrdersQuery(restaurantId, queryParams) {
  const {
    status,
    view,
    stage,
    from,
    to,
    paymentMethod,
    fulfillmentType,
    q,
  } = queryParams;

  const query = { restaurant: restaurantId };

  if (status) {
    const statuses = String(status)
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => VALID_ORDER_STATUSES.includes(s));
    if (statuses.length === 1) query.status = statuses[0];
    else if (statuses.length > 1) query.status = { $in: statuses };
  } else if (stage === "pending") {
    query.status = "PLACED";
  } else if (stage === "active") {
    query.status = { $in: ACTIVE_KITCHEN_STATUSES };
  } else if (view === "kitchen") {
    query.status = { $in: KITCHEN_STATUSES };
  } else if (view === "history") {
    query.status = { $in: HISTORY_STATUSES };
  }

  if (paymentMethod && ["CASH", "MOBILE_MONEY"].includes(String(paymentMethod).toUpperCase())) {
    query.paymentMethod = String(paymentMethod).toUpperCase();
  }

  if (
    fulfillmentType &&
    ["DELIVERY", "PICKUP", "SCHEDULED"].includes(String(fulfillmentType).toUpperCase())
  ) {
    query.fulfillmentType = String(fulfillmentType).toUpperCase();
  }

  if (from || to) {
    query.createdAt = {};
    if (from) {
      const start = new Date(from);
      if (!Number.isNaN(start.getTime())) query.createdAt.$gte = start;
    }
    if (to) {
      const end = new Date(to);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    if (!Object.keys(query.createdAt).length) delete query.createdAt;
  }

  return { query, searchTerm: q ? String(q).trim() : "" };
}

async function applyOrderSearchFilter(baseQuery, searchTerm) {
  if (!searchTerm) return baseQuery;

  const customers = await User.find({
    role: "customer",
    $or: [
      { name: new RegExp(searchTerm, "i") },
      { phone: new RegExp(searchTerm, "i") },
    ],
  })
    .select("_id")
    .lean();

  const orClauses = [
    { customer: { $in: customers.map((c) => c._id) } },
    { restaurantName: new RegExp(searchTerm, "i") },
    { "delivery.address": new RegExp(searchTerm, "i") },
    { notes: new RegExp(searchTerm, "i") },
  ];

  if (mongoose.isValidObjectId(searchTerm)) {
    orClauses.push({ _id: searchTerm });
  }

  return { ...baseQuery, $or: orClauses };
}

const orderListPopulate = [
  { path: "customer", select: "name phone" },
  {
    path: "ride",
    select: "status rider",
    populate: { path: "rider", select: "name phone" },
  },
];

/** GET /merchant/orders — orders for my restaurant (kitchen + history filters) */
export const listMyOrders = async (req, res) => {
  const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const { query: baseQuery, searchTerm } = buildMerchantOrdersQuery(
    req.restaurantId,
    req.query
  );
  const query = await applyOrderSearchFilter(baseQuery, searchTerm);

  const [orders, total] = await Promise.all([
    FoodOrder.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate(orderListPopulate)
      .lean(),
    FoodOrder.countDocuments(query),
  ]);

  res.status(StatusCodes.OK).json({
    orders,
    total,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum) || 1,
  });
};

/** GET /merchant/riders — active drivers for direct assignment */
export const listAssignableRiders = async (req, res) => {
  const riders = await User.find({
    role: "rider",
    "driverDetails.status": "active",
  })
    .select("name phone isOnline driverDetails.vehicle")
    .sort({ isOnline: -1, name: 1 })
    .lean();

  res.status(StatusCodes.OK).json({
    riders: riders.map((d) => ({
      _id: d._id,
      name: d.name,
      phone: d.phone,
      isOnline: !!d.isOnline,
      vehicle: d.driverDetails?.vehicle
        ? `${d.driverDetails.vehicle.make || ""} ${d.driverDetails.vehicle.model || ""}`.trim()
        : "",
    })),
  });
};

/** PATCH /merchant/orders/:id — accept, reject, mark ready, or assign rider */
export const myOrderAction = async (req, res) => {
  const { action, cancelReason, driverId } = req.body;
  if (!["accept", "reject", "ready", "assign_rider"].includes(action)) {
    throw new BadRequestError(
      "action must be accept, reject, ready, or assign_rider"
    );
  }
  if ((action === "assign_rider" || (action === "ready" && driverId)) && !driverId) {
    throw new BadRequestError("driverId is required to assign a rider");
  }

  const order = await FoodOrder.findOne({
    _id: req.params.id,
    restaurant: req.restaurantId,
  }).select("_id");
  if (!order) throw new NotFoundError("Order not found");

  const io = req.app.get("io");
  const result = await applyRestaurantAction(req.params.id, action, io, {
    cancelReason: cancelReason?.trim() || null,
    driverId: driverId || null,
  });

  if (result.error === "not_found") throw new NotFoundError("Order not found");
  if (result.error === "invalid_transition") {
    throw new BadRequestError("Cannot perform this action for the current order status");
  }
  if (result.error === "driver_not_found") {
    throw new BadRequestError("Driver not found");
  }
  if (result.error === "driver_not_active") {
    throw new BadRequestError("Driver must be active to receive orders");
  }
  if (result.error === "driver_ineligible") {
    throw new BadRequestError(result.message || "Driver cannot accept food delivery with their vehicle");
  }
  if (result.error === "driver_required") {
    throw new BadRequestError("driverId is required");
  }
  if (result.error) throw new BadRequestError(result.error);

  res.status(StatusCodes.OK).json({ message: `Order ${action}`, order: result.order });
};

/** GET /merchant/cooks — staff for my restaurant */
export const listMyCooks = async (req, res) => {
  const cooks = await User.find({ role: "cook", restaurant: req.restaurantId })
    .select("name username phone isSuspended createdAt")
    .sort({ createdAt: -1 })
    .lean();
  res.status(StatusCodes.OK).json({ cooks });
};

/** POST /merchant/cooks — owner creates a cook login */
export const createCook = async (req, res) => {
  const { username, password, name, phone } = req.body;
  if (!username || !password) {
    throw new BadRequestError("Username and password are required");
  }

  const existing = await User.findOne({ username: username.trim() });
  if (existing) {
    throw new BadRequestError("That username is already taken");
  }

  const cook = await User.create({
    role: "cook",
    username: username.trim(),
    password,
    name: name?.trim() || username.trim(),
    phone: phone ? normalizePhone(phone) : undefined,
    restaurant: req.restaurantId,
    createdBy: req.user.id,
  });

  res.status(StatusCodes.CREATED).json({
    message: "Cook added",
    cook: {
      _id: cook._id,
      name: cook.name,
      username: cook.username,
      phone: cook.phone,
      isSuspended: cook.isSuspended,
    },
  });
};

/** PATCH /merchant/cooks/:id — owner updates name, resets password, or disables */
export const updateCook = async (req, res) => {
  const cook = await User.findOne({
    _id: req.params.id,
    role: "cook",
    restaurant: req.restaurantId,
  }).select("+password");
  if (!cook) throw new NotFoundError("Cook not found");

  const { name, password, phone, isSuspended } = req.body;
  if (name !== undefined) cook.name = name.trim();
  if (phone !== undefined) cook.phone = phone ? normalizePhone(phone) : cook.phone;
  if (typeof isSuspended === "boolean") cook.isSuspended = isSuspended;
  if (password) cook.password = password;

  await cook.save();

  res.status(StatusCodes.OK).json({
    message: "Cook updated",
    cook: {
      _id: cook._id,
      name: cook.name,
      username: cook.username,
      phone: cook.phone,
      isSuspended: cook.isSuspended,
    },
  });
};

/** DELETE /merchant/cooks/:id — owner removes a cook */
export const deleteCook = async (req, res) => {
  const cook = await User.findOneAndDelete({
    _id: req.params.id,
    role: "cook",
    restaurant: req.restaurantId,
  });
  if (!cook) throw new NotFoundError("Cook not found");
  res.status(StatusCodes.OK).json({ message: "Cook removed" });
};
