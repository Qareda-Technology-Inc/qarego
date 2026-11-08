// Cooking gas requests (customer side). Pricing and station choice live in utils/gasOrders.js.
import { isCommissionFree } from "../utils/commissionFree.js";
import { assertNoUnpaidRide } from "../utils/ridePayments.js";
import FoodOrder from "../models/FoodOrder.js";
import User from "../models/User.js";
import { BadRequestError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import { getSettings } from "../utils/tripSettlement.js";
import { isMomoEnabled } from "../utils/momoAvailability.js";
import { computeFoodOrderSplit } from "../utils/foodOrderSettlement.js";
import { assertServiceAvailableAt } from "../utils/serviceZones.js";
import { parseCoord } from "../utils/deliveryFare.js";
import { notifyCustomerFoodOrderPush } from "../utils/pushNotifications.js";
import { notifyRestaurantStaffNewOrder } from "../utils/vendorOrderNotifications.js";
import { buildGasQuote, findGasStore, getGasConfig } from "../utils/gasOrders.js";
import { applyRestaurantAction } from "../utils/foodOrderFlow.js";

import { isDuplicateKeyError, readClientRequestId } from "../utils/idempotency.js";
const NO_STATION = "No gas station is open near you right now. Please try again later.";
const CLOSED = "Gas delivery is closed right now. Please try again later.";

/** The store for this location, or a BadRequestError explaining why there isn't one. */
async function gasStoreFor(lat, lon, config) {
  const found = await findGasStore(lat, lon, config);
  if (!found) throw new BadRequestError(NO_STATION);
  if (found.closed) throw new BadRequestError(CLOSED);
  return found;
}

function readLocation(src) {
  try {
    return {
      lat: parseCoord(src?.latitude ?? src?.lat, "latitude"),
      lon: parseCoord(src?.longitude ?? src?.lon, "longitude"),
    };
  } catch (err) {
    throw new BadRequestError(err?.message || "A valid location is required");
  }
}

/** GET /food/gas/options — sizes and prices set by the owner. */
export const getGasOptions = async (_req, res) => {
  const config = getGasConfig(await getSettings());
  res.status(StatusCodes.OK).json({
    enabled: config.enabled,
    momoEnabled: config.momoEnabled,
    amountRefill: config.amountRefill,
    cylinders: config.cylinders.filter((c) => c.active),
  });
};

/** GET /food/gas/quote?latitude&longitude&sizeKg&mode&quantity&amount? — price from the nearest station. */
export const getGasQuote = async (req, res) => {
  const settings = await getSettings();
  const config = getGasConfig(settings);
  if (!config.enabled) throw new BadRequestError("Gas delivery is not available right now");
  const { lat, lon } = readLocation(req.query);
  const nearest = await gasStoreFor(lat, lon, config);
  let quote;
  try {
    quote = buildGasQuote({
      config,
      settings,
      mode: String(req.query.mode || "").toUpperCase(),
      sizeKg: req.query.sizeKg,
      quantity: req.query.quantity,
      amount: req.query.amount,
      distanceKm: nearest.distanceKm,
    });
  } catch (err) {
    throw new BadRequestError(err.message);
  }
  res.status(StatusCodes.OK).json({
    station: { _id: nearest.station._id, name: nearest.station.name },
    // QareGO's own gas: refills are paid in cash to the rider when they collect the cylinder.
    cashOnly: nearest.house && String(req.query.mode || "").toUpperCase() === "REFILL",
    ...quote,
  });
};

/** POST /food/gas/orders — place a refill or exchange with the nearest open station. */
async function findReplayedGasOrder(customerId, clientRequestId) {
  const existing = await FoodOrder.findOne({ customer: customerId, clientRequestId }).select("_id").lean();
  if (!existing) return null;
  return FoodOrder.findById(existing._id)
    .populate("restaurant", "name cuisine imageEmoji address latitude longitude vertical estimatedPrepMinutes")
    .populate("customer", "name phone")
    .lean();
}

export const createGasOrder = async (req, res) => {
  // Retried request (lost reply on a weak signal): return the order it already created.
  const clientRequestId = readClientRequestId(req.body);
  if (clientRequestId) {
    const replay = await findReplayedGasOrder(req.user.id, clientRequestId);
    if (replay) return res.status(StatusCodes.OK).json({ order: replay });
  }
  const { mode: rawMode, sizeKg, quantity, amount, delivery, paymentMethod, notes } = req.body || {};
  const settings = await getSettings();
  const config = getGasConfig(settings);
  if (!config.enabled) throw new BadRequestError("Gas delivery is not available right now");

  const method = paymentMethod === "MOBILE_MONEY" ? "MOBILE_MONEY" : "CASH";
  if (method === "MOBILE_MONEY" && !(config.momoEnabled && isMomoEnabled())) {
    throw new BadRequestError("Gas orders are cash only for now");
  }
  if (!delivery?.address?.trim()) throw new BadRequestError("Pickup address is required");
  const { lat, lon } = readLocation(delivery);
  await assertNoUnpaidRide(req.user.id, req.io);

  const customer = await User.findById(req.user.id).select("isSuspended");
  if (customer?.isSuspended) throw new BadRequestError("Your account is suspended. Contact support.");
  await assertServiceAvailableAt(lat, lon, "GAS");

  const nearest = await gasStoreFor(lat, lon, config);
  const { station, house } = nearest;
  const mode = String(rawMode || "").toUpperCase();
  // QareGO's own refills: the rider takes the gas money in cash when collecting the empty and
  // pays the filling place with it, so they're cash only.
  if (house && mode === "REFILL" && method === "MOBILE_MONEY") {
    throw new BadRequestError("Gas refills are paid in cash to the rider when they collect your cylinder");
  }

  let quote;
  try {
    quote = buildGasQuote({ config, settings, mode, sizeKg, quantity, amount, distanceKm: nearest.distanceKm });
  } catch (err) {
    throw new BadRequestError(err.message);
  }

  const split = computeFoodOrderSplit(
    { subtotal: quote.subtotal, deliveryFee: quote.deliveryFee, serviceFee: quote.serviceFee },
    settings,
    // QareGO's own store earns the whole gas price, so there's no station commission.
    { stationCommissionRate: house ? 0 : config.stationCommissionRate, commissionFree: isCommissionFree(station) }
  );

  let order;
  try {
    order = await FoodOrder.create({
    clientRequestId,
    customer: req.user.id,
    restaurant: station._id,
    restaurantName: station.name,
    items: [{ name: quote.itemName, price: quote.unitPrice, quantity: quote.quantity, modifiers: [] }],
    subtotal: quote.subtotal,
    serviceFee: quote.serviceFee,
    deliveryFee: quote.deliveryFee,
    driverFee: quote.deliveryFee,
    deliveryDistanceKm: quote.distanceKm,
    total: quote.total,
    ...split,
    delivery: { address: delivery.address.trim(), latitude: lat, longitude: lon },
    paymentMethod: method,
    paymentStatus: method === "MOBILE_MONEY" ? "UNPAID" : "NOT_REQUIRED",
    notes: notes?.trim() || null,
    fulfillmentType: "DELIVERY",
    status: "PLACED",
    gasMode: mode,
    gasSizeKg: quote.cylinder.sizeKg,
    gasAmount: quote.gasAmount,
    gasByQarego: house,
  });
  } catch (err) {
    if (clientRequestId && isDuplicateKeyError(err)) {
      const replay = await findReplayedGasOrder(req.user.id, clientRequestId);
      if (replay) return res.status(StatusCodes.OK).json({ order: replay });
    }
    throw err;
  }

  const io = req.app.get("io");
  // QareGO's own gas is accepted straight away (a rider is sent at once). MoMo orders wait for
  // the payment; the order scheduler accepts them once paid.
  let autoAccepted = false;
  if (house && method === "CASH") {
    const accepted = await applyRestaurantAction(order._id, "accept", io);
    if (accepted.error) console.warn("[gas] auto-accept failed:", String(order._id), accepted.error);
    else autoAccepted = true; // that already told the customer
  }

  const populated = await FoodOrder.findById(order._id)
    .populate("restaurant", "name cuisine imageEmoji address latitude longitude vertical estimatedPrepMinutes")
    .populate("customer", "name phone")
    .lean();
  if (io) {
    io.to(`customer_${req.user.id}`).emit("foodOrderUpdated", populated);
    io.to(`restaurant_${station._id}`).emit("newFoodOrder", populated);
  }
  if (!autoAccepted) notifyCustomerFoodOrderPush(req.user.id, populated);
  notifyRestaurantStaffNewOrder(station._id, populated);

  res.status(StatusCodes.CREATED).json({ order: populated });
};

