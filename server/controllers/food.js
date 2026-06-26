import Restaurant from "../models/Restaurant.js";
import MenuItem from "../models/MenuItem.js";
import FoodOrder from "../models/FoodOrder.js";
import User from "../models/User.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import {
  assertStoreCoordinates,
  computeFoodDeliveryQuote,
  parseCoord,
} from "../utils/deliveryFare.js";
import { getSettings } from "../utils/tripSettlement.js";
import { applyRestaurantAction } from "../utils/foodOrderFlow.js";
import { computeOpenState } from "../utils/storeHours.js";
import { inferVerticalFromCategoryName } from "../utils/commerceStoreTypes.js";
import { buildMenuPayload } from "../utils/menuResponse.js";
import { MENU_ITEM_TAGS } from "../utils/menuDisplay.js";
import { resolveMenuItemModifiers } from "../utils/menuModifiers.js";
import { applyRestaurantRating } from "../utils/restaurantRating.js";
import { notifyCustomerFoodOrderPush } from "../utils/pushNotifications.js";
import { notifyRestaurantStaffNewOrder } from "../utils/vendorOrderNotifications.js";

function computeFoodServiceFee(subtotal, settings) {
  const rate = Number(settings?.foodServiceFeeRate ?? 0.08);
  const min = Number(settings?.foodServiceFeeMin ?? 2);
  const max = Number(settings?.foodServiceFeeMax ?? 12);
  const normalizedMax = Math.max(min, max);
  const raw = Number(subtotal) * rate;
  return Math.min(normalizedMax, Math.max(min, raw));
}

/** Attach computed open/closed metadata to a plain restaurant object. */
const withOpenState = (restaurant, now = new Date()) => {
  const state = computeOpenState(restaurant, now);
  const vertical =
    restaurant.vertical || inferVerticalFromCategoryName(restaurant.category);
  return {
    ...restaurant,
    vertical,
    isOpen: state.isOpen,
    openStatus: state.status,
    openLabel: state.label,
    todayHours: state.todayHours,
  };
};

/** GET /food/restaurants */
export const listRestaurants = async (req, res) => {
  const restaurants = await Restaurant.find({ isActive: true })
    .sort({ rating: -1, name: 1 })
    .select("-__v")
    .lean();
  const now = new Date();
  res
    .status(StatusCodes.OK)
    .json({ restaurants: restaurants.map((r) => withOpenState(r, now)) });
};

/** GET /food/restaurants/:id */
export const getRestaurantMenu = async (req, res) => {
  const restaurantDoc = await Restaurant.findOne({
    _id: req.params.id,
    isActive: true,
  }).lean();
  if (!restaurantDoc) {
    throw new NotFoundError("Restaurant not found");
  }
  const restaurant = withOpenState(restaurantDoc);

  const menuItems = await MenuItem.find({
    restaurant: restaurant._id,
    isAvailable: true,
  })
    .sort({ category: 1, name: 1 })
    .lean();

  const settings = await getSettings();
  const { categories, menu } = await buildMenuPayload(
    restaurant._id,
    menuItems,
    settings.menuCategoryLayouts
  );

  res.status(StatusCodes.OK).json({
    restaurant,
    menu,
    categories,
    menuItems,
    availableTags: MENU_ITEM_TAGS,
  });
};

/** POST /food/orders */
export const createFoodOrder = async (req, res) => {
  const {
    restaurantId,
    items,
    delivery,
    paymentMethod,
    notes,
    fulfillmentType: fulfillmentRaw,
    scheduledFor,
    promoCode,
  } = req.body;

  const fulfillmentType = ["DELIVERY", "PICKUP", "SCHEDULED"].includes(fulfillmentRaw)
    ? fulfillmentRaw
    : "DELIVERY";

  if (!restaurantId || !Array.isArray(items) || items.length === 0) {
    throw new BadRequestError("Restaurant and items are required");
  }

  const restaurant = await Restaurant.findOne({ _id: restaurantId, isActive: true });
  if (!restaurant) {
    throw new NotFoundError("Restaurant not found");
  }

  if (fulfillmentType === "PICKUP" && !restaurant.allowsPickup) {
    throw new BadRequestError(`${restaurant.name} does not offer pickup`);
  }

  let deliveryAddress;
  let deliveryLat;
  let deliveryLon;

  if (fulfillmentType === "PICKUP") {
    deliveryAddress = restaurant.address;
    deliveryLat = restaurant.latitude;
    deliveryLon = restaurant.longitude;
  } else {
    if (!delivery) {
      throw new BadRequestError("Delivery address is required");
    }
    deliveryAddress = delivery.address;
    deliveryLat = delivery.latitude;
    deliveryLon = delivery.longitude;
    if (!deliveryAddress || deliveryLat == null || deliveryLon == null) {
      throw new BadRequestError("Complete delivery address is required");
    }
  }

  let scheduledForDate = null;
  if (fulfillmentType === "SCHEDULED") {
    if (!scheduledFor) {
      throw new BadRequestError("Please choose a scheduled time");
    }
    scheduledForDate = new Date(scheduledFor);
    if (Number.isNaN(scheduledForDate.getTime()) || scheduledForDate.getTime() <= Date.now()) {
      throw new BadRequestError("Scheduled time must be in the future");
    }
  }

  const openState = computeOpenState(restaurant);
  if (!openState.isOpen) {
    const suffix =
      openState.status === "closed"
        ? `${restaurant.name} is closed right now${
            openState.todayHours ? ` (today: ${openState.todayHours})` : ""
          }`
        : `${restaurant.name} is not accepting orders right now`;
    throw new BadRequestError(suffix);
  }

  const menuIds = items.map((i) => i.menuItemId).filter(Boolean);
  const menuDocs = await MenuItem.find({
    _id: { $in: menuIds },
    restaurant: restaurant._id,
    isAvailable: true,
  });

  const menuMap = new Map(menuDocs.map((m) => [m._id.toString(), m]));

  const orderItems = [];
  let subtotal = 0;

  for (const line of items) {
    const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
    const menu = menuMap.get(String(line.menuItemId));
    if (!menu) {
      throw new BadRequestError("One or more menu items are invalid or unavailable");
    }

    let modifierResult;
    try {
      modifierResult = resolveMenuItemModifiers(menu, line.modifiers || line.modifierSelections);
    } catch (err) {
      throw new BadRequestError(err?.message || "Invalid item customization");
    }

    const unitPrice = modifierResult.unitPrice;
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    orderItems.push({
      menuItem: menu._id,
      name: menu.name,
      price: unitPrice,
      quantity: qty,
      modifiers: modifierResult.modifiers,
    });
  }

  if (subtotal < restaurant.minOrderAmount) {
    throw new BadRequestError(
      `Minimum order for ${restaurant.name} is GH₵${restaurant.minOrderAmount.toFixed(2)}`
    );
  }

  const customer = req.user;
  const customerUser = await User.findById(customer.id).select("isSuspended");
  if (customerUser?.isSuspended) {
    throw new BadRequestError("Your account is suspended. Contact support.");
  }

  const settings = await getSettings();
  let driverFee = 0;
  let deliveryFee = 0;
  let deliveryDistanceKm = null;
  if (fulfillmentType === "DELIVERY" || fulfillmentType === "SCHEDULED") {
    const { lat: storeLat, lon: storeLon } = assertStoreCoordinates(restaurant);
    let quote;
    try {
      quote = computeFoodDeliveryQuote(
        storeLat,
        storeLon,
        parseCoord(deliveryLat, "delivery latitude"),
        parseCoord(deliveryLon, "delivery longitude"),
        settings.fareRates || undefined
      );
    } catch (err) {
      throw new BadRequestError(err?.message || "Invalid delivery location");
    }
    driverFee = quote.deliveryFee;
    deliveryFee = quote.deliveryFee;
    deliveryDistanceKm = quote.distanceKm;
  }
  const serviceFee = computeFoodServiceFee(subtotal, settings);
  const total = subtotal + serviceFee + deliveryFee;

  const itemSummary = orderItems
    .map((i) => `${i.quantity}x ${i.name}`)
    .join(", ");

  const foodOrder = await FoodOrder.create({
    customer: customer.id,
    restaurant: restaurant._id,
    restaurantName: restaurant.name,
    items: orderItems,
    subtotal,
    serviceFee,
    deliveryFee,
    driverFee,
    deliveryDistanceKm,
    total,
    delivery: {
      address: deliveryAddress,
      latitude: deliveryLat,
      longitude: deliveryLon,
    },
    paymentMethod: paymentMethod === "MOBILE_MONEY" ? "MOBILE_MONEY" : "CASH",
    notes: notes?.trim() || null,
    promoCode: promoCode?.trim() || null,
    fulfillmentType,
    scheduledFor: scheduledForDate,
    status: "PLACED",
  });

  const populated = await FoodOrder.findById(foodOrder._id)
    .populate(
      "restaurant",
      "name cuisine imageEmoji address latitude longitude vertical estimatedPrepMinutes"
    )
    .populate("customer", "name phone")
    .lean();

  const io = req.app.get("io");
  if (io) {
    io.to(`food_order_${foodOrder._id}`).emit("foodOrderUpdated", populated);
    io.to(`customer_${customer.id}`).emit("foodOrderUpdated", populated);
    // Notify the restaurant's merchant/cook consoles in real time
    io.to(`restaurant_${restaurant._id}`).emit("newFoodOrder", populated);
  }

  notifyCustomerFoodOrderPush(customer.id, populated);
  notifyRestaurantStaffNewOrder(restaurant._id, populated);

  res.status(StatusCodes.CREATED).json({
    message: "Food order placed — waiting for restaurant",
    order: populated,
  });
};

function activePromoBanners(settings, vertical) {
  const list = Array.isArray(settings?.foodPromoBanners) ? settings.foodPromoBanners : [];
  const v = String(vertical || "FOOD").toUpperCase();
  return list
    .filter((b) => b?.enabled !== false && b?.imageUrl)
    .filter((b) => {
      const bv = String(b.vertical || "ALL").toUpperCase();
      return bv === "ALL" || bv === v;
    })
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((b) => ({
      imageUrl: b.imageUrl,
      vertical: b.vertical || "ALL",
    }));
}

/** GET /food/delivery-quote — distance-based delivery fee for a store + drop-off */
export const getFoodDeliveryQuote = async (req, res) => {
  const { restaurantId, latitude, longitude } = req.query;
  if (!restaurantId || latitude == null || longitude == null) {
    throw new BadRequestError("restaurantId, latitude, and longitude are required");
  }

  const restaurant = await Restaurant.findOne({ _id: restaurantId, isActive: true });
  if (!restaurant) {
    throw new NotFoundError("Restaurant not found");
  }

  const { lat: storeLat, lon: storeLon } = assertStoreCoordinates(restaurant);
  const settings = await getSettings();

  try {
    const quote = computeFoodDeliveryQuote(
      storeLat,
      storeLon,
      parseCoord(latitude, "latitude"),
      parseCoord(longitude, "longitude"),
      settings.fareRates || undefined
    );
    res.status(StatusCodes.OK).json(quote);
  } catch (err) {
    throw new BadRequestError(err?.message || "Could not quote delivery fee");
  }
};

/** GET /food/checkout-settings */
export const getFoodCheckoutSettings = async (req, res) => {
  const settings = await getSettings();
  const vertical = req.query?.vertical;
  res.status(StatusCodes.OK).json({
    serviceFeeRate: Number(settings?.foodServiceFeeRate ?? 0.08),
    serviceFeeMin: Number(settings?.foodServiceFeeMin ?? 2),
    serviceFeeMax: Number(settings?.foodServiceFeeMax ?? 12),
    fareRates: settings?.fareRates ?? null,
    promoBanners: activePromoBanners(settings, vertical),
  });
};

/** POST /food/orders/:id/rate — customer rates restaurant after order completes */
export const rateFoodOrder = async (req, res) => {
  const { rating, review } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    throw new BadRequestError("Valid rating between 1 and 5 is required");
  }

  const order = await FoodOrder.findById(req.params.id);
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  if (order.customer.toString() !== req.user.id) {
    throw new NotFoundError("Order not found");
  }

  if (order.restaurantRating) {
    throw new BadRequestError("You have already rated this order");
  }

  const rateable =
    order.status === "DELIVERED" ||
    (order.fulfillmentType === "PICKUP" && order.status === "READY_FOR_PICKUP");

  if (!rateable) {
    throw new BadRequestError("You can rate the restaurant after your order is complete");
  }

  order.restaurantRating = rating;
  order.restaurantReview = review?.trim() || null;
  await order.save();

  await applyRestaurantRating(order.restaurant, rating);

  const populated = await FoodOrder.findById(order._id)
    .populate("restaurant", "name cuisine imageEmoji address latitude longitude rating vertical")
    .populate("ride")
    .lean();

  res.status(StatusCodes.OK).json({
    message: "Restaurant rating submitted",
    order: populated,
  });
};

/** GET /food/orders/:id */
export const getFoodOrder = async (req, res) => {
  const order = await FoodOrder.findById(req.params.id)
    .populate("restaurant", "name cuisine imageEmoji address latitude longitude vertical estimatedPrepMinutes")
    .populate("ride")
    .lean();

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  if (order.customer.toString() !== req.user.id) {
    throw new NotFoundError("Order not found");
  }

  res.status(StatusCodes.OK).json({ order });
};

/** GET /food/orders */
export const listMyFoodOrders = async (req, res) => {
  const orders = await FoodOrder.find({ customer: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("restaurant", "name imageEmoji cuisine vertical")
    .lean();

  res.status(StatusCodes.OK).json({ orders });
};

/** GET /food/orders/active — current in-progress order for customer */
export const getActiveFoodOrder = async (req, res) => {
  const terminal = ["DELIVERED", "CANCELLED"];
  const order = await FoodOrder.findOne({
    customer: req.user.id,
    status: { $nin: terminal },
  })
    .sort({ createdAt: -1 })
    .populate("restaurant", "name cuisine imageEmoji address latitude longitude vertical estimatedPrepMinutes")
    .populate("ride")
    .lean();

  res.status(StatusCodes.OK).json({ order: order || null });
};

/** Admin: list orders for restaurant console */
export const adminListFoodOrders = async (req, res) => {
  if (req.user.role !== "admin") {
    throw new BadRequestError("Admin access required");
  }

  const { status } = req.query;
  const query = {};
  if (status) query.status = status;

  const orders = await FoodOrder.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("restaurant", "name imageEmoji cuisine vertical")
    .populate("customer", "name phone")
    .populate("ride")
    .lean();

  res.status(StatusCodes.OK).json({ orders });
};

/** Admin / restaurant: accept, reject, or mark ready */
export const adminRestaurantOrderAction = async (req, res) => {
  if (req.user.role !== "admin") {
    throw new BadRequestError("Admin access required");
  }

  const { action } = req.body;
  const { cancelReason } = req.body;

  if (!["accept", "reject", "ready"].includes(action)) {
    throw new BadRequestError("action must be accept, reject, or ready");
  }

  const io = req.app.get("io");
  const result = await applyRestaurantAction(req.params.id, action, io, {
    cancelReason: cancelReason?.trim() || null,
  });

  if (result.error === "not_found") throw new NotFoundError("Order not found");
  if (result.error === "invalid_transition") {
    throw new BadRequestError("Cannot perform this action for the current order status");
  }
  if (result.error) throw new BadRequestError(result.error);

  res.status(StatusCodes.OK).json({ message: `Order ${action}`, order: result.order });
};
