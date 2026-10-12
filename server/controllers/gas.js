// Cooking gas requests (customer side). Pricing and station choice live in utils/gasOrders.js.
import FoodOrder from "../models/FoodOrder.js";
import User from "../models/User.js";
import { BadRequestError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import { getSettings } from "../utils/tripSettlement.js";
import { computeFoodOrderSplit } from "../utils/foodOrderSettlement.js";
import { assertServiceAvailableAt } from "../utils/serviceZones.js";
import { parseCoord } from "../utils/deliveryFare.js";
import { notifyCustomerFoodOrderPush } from "../utils/pushNotifications.js";
import { notifyRestaurantStaffNewOrder } from "../utils/vendorOrderNotifications.js";
import {
  buildGasQuote,
  findNearestGasStation,
  getGasConfig,
} from "../utils/gasOrders.js";

const NO_STATION = "No gas station is open near you right now. Please try again later.";

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
    cylinders: config.cylinders.filter((c) => c.active),
  });
};

/** GET /food/gas/quote?latitude&longitude&sizeKg&mode&quantity — price from the nearest station. */
export const getGasQuote = async (req, res) => {
  const settings = await getSettings();
  const config = getGasConfig(settings);
  if (!config.enabled) throw new BadRequestError("Gas delivery is not available right now");
  const { lat, lon } = readLocation(req.query);
  const nearest = await findNearestGasStation(lat, lon);
  if (!nearest) throw new BadRequestError(NO_STATION);
  let quote;
  try {
    quote = buildGasQuote({
      config,
      settings,
      mode: String(req.query.mode || "").toUpperCase(),
      sizeKg: req.query.sizeKg,
      quantity: req.query.quantity,
      distanceKm: nearest.distanceKm,
    });
  } catch (err) {
    throw new BadRequestError(err.message);
  }
  res.status(StatusCodes.OK).json({
    station: { _id: nearest.station._id, name: nearest.station.name },
    ...quote,
  });
};

/** POST /food/gas/orders — place a refill or exchange with the nearest open station. */
export const createGasOrder = async (req, res) => {
  const { mode: rawMode, sizeKg, quantity, delivery, paymentMethod, notes } = req.body || {};
  const settings = await getSettings();
  const config = getGasConfig(settings);
  if (!config.enabled) throw new BadRequestError("Gas delivery is not available right now");

  const method = paymentMethod === "MOBILE_MONEY" ? "MOBILE_MONEY" : "CASH";
  if (method === "MOBILE_MONEY" && !config.momoEnabled) {
    throw new BadRequestError("Gas orders are cash only for now");
  }
  if (!delivery?.address?.trim()) throw new BadRequestError("Pickup address is required");
  const { lat, lon } = readLocation(delivery);

  const customer = await User.findById(req.user.id).select("isSuspended");
  if (customer?.isSuspended) throw new BadRequestError("Your account is suspended. Contact support.");
  await assertServiceAvailableAt(lat, lon, "GAS");

  const nearest = await findNearestGasStation(lat, lon);
  if (!nearest) throw new BadRequestError(NO_STATION);
  const { station } = nearest;
  const mode = String(rawMode || "").toUpperCase();

  let quote;
  try {
    quote = buildGasQuote({ config, settings, mode, sizeKg, quantity, distanceKm: nearest.distanceKm });
  } catch (err) {
    throw new BadRequestError(err.message);
  }

  const split = computeFoodOrderSplit(
    { subtotal: quote.subtotal, deliveryFee: quote.deliveryFee, serviceFee: quote.serviceFee },
    settings,
    { stationCommissionRate: config.stationCommissionRate }
  );

  const order = await FoodOrder.create({
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
  });

  const populated = await FoodOrder.findById(order._id)
    .populate("restaurant", "name cuisine imageEmoji address latitude longitude vertical estimatedPrepMinutes")
    .populate("customer", "name phone")
    .lean();
  const io = req.app.get("io");
  if (io) {
    io.to(`customer_${req.user.id}`).emit("foodOrderUpdated", populated);
    io.to(`restaurant_${station._id}`).emit("newFoodOrder", populated);
  }
  notifyCustomerFoodOrderPush(req.user.id, populated);
  notifyRestaurantStaffNewOrder(station._id, populated);

  res.status(StatusCodes.CREATED).json({ order: populated });
};

