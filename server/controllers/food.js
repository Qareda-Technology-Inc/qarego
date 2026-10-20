import { assertMomoEnabled } from "../utils/momoAvailability.js";
import Restaurant from "../models/Restaurant.js";
import MenuItem from "../models/MenuItem.js";
import FoodOrder, { FOOD_CODE_FIELDS } from "../models/FoodOrder.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import {
  assertStoreCoordinates,
  computeFoodDeliveryQuote,
  parseCoord,
} from "../utils/deliveryFare.js";
import { getSettings } from "../utils/tripSettlement.js";
import { computeFoodOrderSplit } from "../utils/foodOrderSettlement.js";
import { computeFoodServiceFee } from "../utils/foodServiceFee.js";
import { assertServiceAvailableAt } from "../utils/serviceZones.js";
import { applyLaundryCustomerDecision, applyRestaurantAction } from "../utils/foodOrderFlow.js";
import { computeOpenState } from "../utils/storeHours.js";
import { inferVerticalFromCategoryName } from "../utils/commerceStoreTypes.js";
import { buildMenuPayload } from "../utils/menuResponse.js";
import { MENU_ITEM_TAGS } from "../utils/menuDisplay.js";
import { resolveMenuItemModifiers } from "../utils/menuModifiers.js";
import { applyRestaurantRating } from "../utils/restaurantRating.js";
import { notifyCustomerFoodOrderPush } from "../utils/pushNotifications.js";
import { notifyRestaurantStaffNewOrder } from "../utils/vendorOrderNotifications.js";
import {
  normalizePrescriptionUrls,
  orderRequiresPrescription,
} from "../utils/prescription.js";


import { isDuplicateKeyError, readClientRequestId } from "../utils/idempotency.js";
import { listAssignableRiders } from "./merchant/orders.js";
import { availableNowFilter } from "../utils/menuAvailability.js";
import { countItems } from "../utils/laundryOrders.js";
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
  // Gas stations are reached through the Cooking gas flow, not the store lists.
  const restaurants = await Restaurant.find({ isActive: true, vertical: { $ne: "GAS" } })
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
    ...availableNowFilter(),
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
/** The order a retried checkout already created (same customer + clientRequestId). */
async function findReplayedFoodOrder(customerId, clientRequestId) {
  const existing = await FoodOrder.findOne({ customer: customerId, clientRequestId }).select("_id").lean();
  if (!existing) return null;
  return FoodOrder.findById(existing._id)
    .populate(
      "restaurant",
      "name cuisine imageEmoji address latitude longitude vertical estimatedPrepMinutes"
    )
    .populate("customer", "name phone")
    .lean();
}

export const createFoodOrder = async (req, res) => {
  const clientRequestId = readClientRequestId(req.body);
  if (clientRequestId) {
    const replay = await findReplayedFoodOrder(req.user.id, clientRequestId);
    if (replay) {
      return res.status(StatusCodes.OK).json({ message: "Order already placed", order: replay });
    }
  }
  const {
    restaurantId,
    items,
    delivery,
    paymentMethod,
    notes,
    fulfillmentType: fulfillmentRaw,
    scheduledFor,
    promoCode,
    prescriptionUrls: prescriptionUrlsRaw,
  } = req.body;

  if (paymentMethod === "MOBILE_MONEY") assertMomoEnabled();
  const fulfillmentType = ["DELIVERY", "PICKUP", "SCHEDULED"].includes(fulfillmentRaw)
    ? fulfillmentRaw
    : "DELIVERY";

  if (!restaurantId || !Array.isArray(items) || items.length === 0) {
    throw new BadRequestError("Restaurant and items are required");
  }

  // Gas is priced by the owner and ordered via /food/gas/orders, not store menus.
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    isActive: true,
    vertical: { $ne: "GAS" },
  });
  if (!restaurant) {
    throw new NotFoundError("Restaurant not found");
  }

  if (fulfillmentType === "PICKUP" && !restaurant.allowsPickup) {
    throw new BadRequestError(`${restaurant.name} does not offer pickup`);
  }
  // Laundry is collected from the customer and brought back (see utils/laundryOrders.js).
  const isLaundry = restaurant.vertical === "LAUNDRY";
  if (isLaundry && fulfillmentType !== "DELIVERY") {
    throw new BadRequestError("Laundry is collected from you and brought back, so choose delivery");
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
    ...availableNowFilter(),
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
    // Laundry: one fee covers both trips (collect and return), paid to the courier once.
    const trips = isLaundry ? 2 : 1;
    driverFee = Math.round(quote.deliveryFee * trips * 100) / 100;
    deliveryFee = driverFee;
    deliveryDistanceKm = quote.distanceKm;
  }
  const serviceFee = computeFoodServiceFee(subtotal, settings);
  // Round once so stored totals never carry float noise (e.g. 26.990000000000002).
  const total = Math.round((subtotal + serviceFee + deliveryFee) * 100) / 100;
  const split = computeFoodOrderSplit(
    { subtotal, deliveryFee, serviceFee },
    settings
  );

  const zoneService = ["GROCERY", "PHARMACY", "LAUNDRY"].includes(restaurant.vertical)
    ? restaurant.vertical
    : "FOOD";
  await assertServiceAvailableAt(deliveryLat, deliveryLon, zoneService);

  const prescriptionUrls = restaurant.vertical === "PHARMACY"
    ? normalizePrescriptionUrls(prescriptionUrlsRaw)
    : [];
  if (orderRequiresPrescription(restaurant.vertical, menuDocs) && prescriptionUrls.length === 0) {
    throw new BadRequestError(
      "This order includes prescription-only items. Please upload a photo of your prescription."
    );
  }

  const itemSummary = orderItems
    .map((i) => `${i.quantity}x ${i.name}`)
    .join(", ");

  let foodOrder;
  try {
    foodOrder = await FoodOrder.create({
    clientRequestId,
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
    ...split,
    delivery: {
      address: deliveryAddress,
      latitude: deliveryLat,
      longitude: deliveryLon,
    },
    paymentMethod: paymentMethod === "MOBILE_MONEY" ? "MOBILE_MONEY" : "CASH",
    paymentStatus: paymentMethod === "MOBILE_MONEY" ? "UNPAID" : "NOT_REQUIRED",
    notes: notes?.trim() || null,
    prescriptionUrls,
    promoCode: promoCode?.trim() || null,
    fulfillmentType,
    scheduledFor: scheduledForDate,
    status: "PLACED",
    laundry: isLaundry
      ? { estimatedSubtotal: subtotal, estimatedItemCount: countItems(orderItems) }
      : null,
  });
  } catch (err) {
    // Two copies of the same checkout arrived together: answer with the first.
    if (clientRequestId && isDuplicateKeyError(err)) {
      const replay = await findReplayedFoodOrder(req.user.id, clientRequestId);
      if (replay) {
        return res.status(StatusCodes.OK).json({ message: "Order already placed", order: replay });
      }
    }
    throw err;
  }

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

  // Gas is priced by the owner and ordered via /food/gas/orders, not store menus.
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    isActive: true,
    vertical: { $ne: "GAS" },
  });
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
    // Laundry is collected and brought back: two trips.
    if (restaurant.vertical === "LAUNDRY") {
      return res.status(StatusCodes.OK).json({
        ...quote,
        deliveryFee: Math.round(quote.deliveryFee * 2 * 100) / 100,
        roundTrip: true,
      });
    }
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
    .select(FOOD_CODE_FIELDS)
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

/** POST /food/orders/:id/cancel — customer cancels before the store accepts */
export const cancelMyFoodOrder = async (req, res) => {
  const owned = await FoodOrder.findOne({ _id: req.params.id, customer: req.user.id })
    .select("_id status")
    .lean();
  if (!owned) throw new NotFoundError("Order not found");

  const io = req.app.get("io");
  const result = await applyRestaurantAction(req.params.id, "customer_cancel", io, {
    cancelReason: req.body?.cancelReason?.trim() || "Cancelled by customer",
  });
  if (result.error === "invalid_transition" || result.error === "already_settled") {
    throw new BadRequestError(
      "The store has already started on this order. Contact the store to cancel."
    );
  }
  if (result.error) throw new BadRequestError("Could not cancel this order");

  res.status(StatusCodes.OK).json({ order: result.order });
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
    .select(FOOD_CODE_FIELDS)
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

  const { status, refundStatus } = req.query;
  const query = {};
  if (status) query.status = status;
  if (refundStatus) query.refundStatus = refundStatus;

  const orders = await FoodOrder.find(query)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("restaurant", "name imageEmoji cuisine vertical")
    .populate("customer", "name phone")
    .populate("ride")
    .lean();

  res.status(StatusCodes.OK).json({ orders });
};

/** Statuses an order may pass through, with a fallback time for orders saved before the timeline. */
function reconstructTimeline(order) {
  if (order.timeline?.length) return order.timeline;
  const events = [{ status: "PLACED", at: order.createdAt }];
  if (order.preparingStartedAt) events.push({ status: "PREPARING", at: order.preparingStartedAt });
  if (order.status === "CANCELLED" && order.cancelledAt) {
    events.push({ status: "CANCELLED", at: order.cancelledAt });
  } else if (order.status !== "PLACED" && order.status !== "PREPARING") {
    // Exact times weren't recorded before the timeline existed; show the last update.
    events.push({ status: order.status, at: order.settledAt || order.updatedAt, approximate: true });
  }
  if (order.refundedAt) events.push({ status: "REFUNDED", at: order.refundedAt });
  return events;
}

/** GET /food/admin/riders — active riders admin can assign a store delivery to. */
export const adminListAssignableRiders = async (req, res) => {
  if (req.user.role !== "admin") {
    throw new BadRequestError("Admin access required");
  }
  return listAssignableRiders(req, res);
};

/** GET /food/admin/orders/:id — everything support needs about one order. */
export const adminGetFoodOrder = async (req, res) => {
  if (req.user.role !== "admin") {
    throw new BadRequestError("Admin access required");
  }
  const order = await FoodOrder.findById(req.params.id)
    .populate({
      path: "restaurant",
      select: "name imageEmoji vertical address latitude longitude owner",
      populate: { path: "owner", select: "name phone" },
    })
    .populate("customer", "name phone")
    .populate({ path: "ride", select: "status rider fare gasLeg updatedAt", populate: { path: "rider", select: "name phone" } })
    .populate({
      path: "collectionRide",
      select: "status rider fare gasLeg updatedAt",
      populate: { path: "rider", select: "name phone" },
    })
    .lean();
  if (!order) throw new NotFoundError("Order not found");

  // Laundry collected by one rider and returned by another: show how the pay was split.
  const tripShare = order.collectionRide?._id
    ? await Transaction.find({
        type: { $in: ["TRIP_SHARE_CREDIT", "TRIP_SHARE_DEBIT"] },
        ride: { $in: [order.collectionRide._id, order.ride?._id].filter(Boolean) },
      })
        .select("type amount driver createdAt")
        .populate("driver", "name phone")
        .lean()
    : [];

  res.status(StatusCodes.OK).json({
    order: { ...order, timeline: reconstructTimeline(order), tripShare },
  });
};

/** Admin / restaurant: accept, reject, or mark ready */
export const adminRestaurantOrderAction = async (req, res) => {
  if (req.user.role !== "admin") {
    throw new BadRequestError("Admin access required");
  }

  const { action } = req.body;
  const { cancelReason } = req.body;

  if (action === "mark_refunded") {
    // Admin refunded the customer manually in Hubtel; record it.
    const order = await FoodOrder.findOneAndUpdate(
      { _id: req.params.id, refundStatus: "DUE" },
      { $set: { refundStatus: "REFUNDED", refundedAt: new Date(), paymentStatus: "REFUNDED" } },
      { new: true }
    ).lean();
    if (!order) throw new BadRequestError("No refund is due on this order");
    return res.status(StatusCodes.OK).json({ order });
  }

  const ADMIN_ACTIONS = ["accept", "reject", "ready", "assign_rider", "collected", "empty_returned"];
  if (!ADMIN_ACTIONS.includes(action)) {
    throw new BadRequestError(`action must be one of: ${[...ADMIN_ACTIONS, "mark_refunded"].join(", ")}`);
  }
  const { driverId } = req.body;
  if (action === "assign_rider" && !driverId) {
    throw new BadRequestError("driverId is required to assign a rider");
  }

  const io = req.app.get("io");
  const result = await applyRestaurantAction(req.params.id, action, io, {
    cancelReason: cancelReason?.trim() || null,
    cancelledBy: "ADMIN",
    driverId: driverId || null,
  });

  if (result.error === "not_found") throw new NotFoundError("Order not found");
  if (result.error === "invalid_transition") {
    throw new BadRequestError("Cannot perform this action for the current order status");
  }
  if (result.error === "gas_in_custody") {
    throw new BadRequestError(
      "The customer's cylinder or laundry is with the courier or the store. Return it before cancelling."
    );
  }
  if (result.error === "gas_not_at_station") {
    throw new BadRequestError("The customer's empty cylinder hasn't reached the station yet");
  }
  if (result.error === "laundry_not_at_shop") {
    throw new BadRequestError("The laundry hasn't reached the shop yet");
  }
  if (result.error === "laundry_not_counted") {
    throw new BadRequestError("The shop hasn't counted the items and confirmed the price yet");
  }
  if (result.error === "laundry_awaiting_customer") {
    throw new BadRequestError("Waiting for the customer to approve the new price");
  }
  if (result.error === "collect_first_assign") {
    throw new BadRequestError(
      "This order is collected first. You can pick a rider for the return trip once the store marks it ready."
    );
  }
  if (result.error === "already_settled") {
    throw new BadRequestError("This order has already been paid out and can no longer be cancelled");
  }
  if (result.error === "payment_required") {
    throw new BadRequestError(
      result.message || "Customer must complete MoMo payment before accepting this order"
    );
  }
  if (result.error === "driver_not_found") throw new BadRequestError("Rider not found");
  if (result.error === "driver_not_active") throw new BadRequestError("Rider must be active to take orders");
  if (result.error === "driver_ineligible") {
    throw new BadRequestError(result.message || "This rider's vehicle can't take store deliveries");
  }
  if (result.error) throw new BadRequestError(result.error);

  res.status(StatusCodes.OK).json({ message: `Order ${action}`, order: result.order });
};

/** POST /food/orders/:id/laundry-price { decision: approve | decline } — answer the shop's count. */
export const answerLaundryPrice = async (req, res) => {
  const result = await applyLaundryCustomerDecision(req.params.id, req.user.id, req.body?.decision, req.app.get("io"));
  if (result.error === "not_found") throw new NotFoundError("Order not found");
  if (result.error === "bad_decision") throw new BadRequestError("decision must be approve or decline");
  if (result.error) throw new BadRequestError(result.message || "This order isn't waiting for your answer");
  res.status(StatusCodes.OK).json({ order: result.order });
};
