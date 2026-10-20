import mongoose from "mongoose";
import User from "../../models/User.js";
import FoodOrder from "../../models/FoodOrder.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, NotFoundError } from "../../errors/index.js";
import { applyLaundryCountAction, applyRestaurantAction } from "../../utils/foodOrderFlow.js";

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
/**
 * POST /merchant/orders/:id/laundry-count { items: [{ menuItemId, quantity }] } — the shop's count
 * once a laundry bag arrives. Costs more than the estimate → the customer approves first.
 */
export const countMyLaundryOrder = async (req, res) => {
  const order = await FoodOrder.findOne({ _id: req.params.id, restaurant: req.restaurantId }).select("_id");
  if (!order) throw new NotFoundError("Order not found");
  const result = await applyLaundryCountAction(req.params.id, req.body?.items, req.app.get("io"));
  if (result.error === "not_found") throw new NotFoundError("Order not found");
  if (result.error === "laundry_not_at_shop") throw new BadRequestError("The laundry hasn't reached your shop yet");
  if (result.error === "bad_count") throw new BadRequestError(result.message);
  if (result.error) throw new BadRequestError("This order can't be counted now");
  res.status(StatusCodes.OK).json({ order: result.order, priceRaised: result.priceRaised });
};

export const myOrderAction = async (req, res) => {
  const { action, cancelReason, driverId } = req.body;
  if (!["accept", "reject", "ready", "assign_rider", "empty_returned", "collected"].includes(action)) {
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
  if (result.error === "gas_in_custody") {
    throw new BadRequestError(
      "The customer's cylinder or laundry is with the courier or your shop. Return it before cancelling."
    );
  }
  if (result.error === "gas_not_at_station") {
    throw new BadRequestError("The customer's empty cylinder hasn't reached the station yet");
  }
  if (result.error === "laundry_not_at_shop") {
    throw new BadRequestError("The laundry hasn't reached your shop yet");
  }
  if (result.error === "laundry_not_counted") {
    throw new BadRequestError("Count the items and confirm the price first");
  }
  if (result.error === "laundry_awaiting_customer") {
    throw new BadRequestError("Waiting for the customer to approve the new price");
  }
  if (result.error === "already_settled") {
    throw new BadRequestError("This order has already been paid out and can no longer be cancelled");
  }
  if (result.error === "payment_required") {
    throw new BadRequestError(
      result.message || "Customer must complete MoMo payment before accepting this order"
    );
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
