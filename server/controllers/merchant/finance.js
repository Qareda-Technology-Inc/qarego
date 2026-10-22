import mongoose from "mongoose";
import Restaurant from "../../models/Restaurant.js";
import FoodOrder from "../../models/FoodOrder.js";
import StoreLedgerEntry from "../../models/StoreLedgerEntry.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../../errors/index.js";
import { isCommissionFree } from "../../utils/commissionFree.js";

// A MoMo order pays the store and the rider separately. The store sees only its own payout, so
// a failed rider transfer doesn't show as "failed" on an order the store was paid for.
const STORE_LEG_TO_STATUS = { sent: "settled", not_applicable: "settled", pending: "processing", failed: "failed" };
const STORE_PAYOUT_STATUS = {
  $switch: {
    branches: Object.entries(STORE_LEG_TO_STATUS).map(([leg, status]) => ({
      case: { $eq: ["$settlementDetails.restaurant.status", leg] },
      then: status,
    })),
    default: { $ifNull: ["$settlementStatus", "pending"] },
  },
};
const storePayoutStatus = (o) =>
  STORE_LEG_TO_STATUS[o.settlementDetails?.restaurant?.status] || o.settlementStatus;

/**
 * GET /merchant/finance — owner earnings across all stores or one store.
 * Query: from, to (YYYY-MM-DD), restaurantId=all|<id>, page, limit
 */
export const getMyFinance = async (req, res) => {
  const {
    from,
    to,
    restaurantId: restaurantIdParam = "all",
    page = 1,
    limit = 25,
  } = req.query;

  const restaurants = await Restaurant.find({ owner: req.user.id })
    .select("name imageEmoji commissionFreeUntil")
    .sort({ createdAt: 1 })
    .lean();

  if (!restaurants.length) {
    return res.status(StatusCodes.OK).json({
      from: null,
      to: null,
      scope: { restaurantId: "all" },
      summary: emptyFinanceSummary(),
      byStore: [],
      transactions: [],
      total: 0,
      page: 1,
      pages: 1,
    });
  }

  const ownedIds = restaurants.map((r) => r._id);
  const ownedKey = new Set(ownedIds.map(String));

  let scopeIds = ownedIds;
  let scopeRestaurantId = "all";
  let storeName;

  if (restaurantIdParam && String(restaurantIdParam) !== "all") {
    const id = String(restaurantIdParam);
    if (!ownedKey.has(id)) {
      throw new BadRequestError("Store not found or not owned by you");
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError("Invalid store id");
    }
    scopeIds = [new mongoose.Types.ObjectId(id)];
    scopeRestaurantId = id;
    storeName = restaurants.find((r) => String(r._id) === id)?.name;
  }

  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  defaultFrom.setHours(0, 0, 0, 0);

  const createdAt = {};
  if (from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      createdAt.$gte = start;
    }
  } else {
    createdAt.$gte = defaultFrom;
  }
  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      createdAt.$lte = end;
    }
  } else {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    createdAt.$lte = end;
  }

  const rangeFrom = createdAt.$gte;
  const rangeTo = createdAt.$lte;

  const match = {
    restaurant: { $in: scopeIds },
    status: { $ne: "CANCELLED" },
    createdAt,
  };

  const moneyFields = {
    gross: { $ifNull: ["$subtotal", 0] },
    commission: { $ifNull: ["$restaurantCommission", 0] },
    net: {
      $ifNull: [
        "$restaurantNet",
        { $subtract: [{ $ifNull: ["$subtotal", 0] }, { $ifNull: ["$restaurantCommission", 0] }] },
      ],
    },
  };

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const skip = (pageNum - 1) * limitNum;

  const [summaryAgg, byStoreAgg, byPaymentAgg, total, transactions] = await Promise.all([
    FoodOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          grossSales: { $sum: moneyFields.gross },
          commission: { $sum: moneyFields.commission },
          netEarnings: { $sum: moneyFields.net },
          settled: {
            $sum: {
              $cond: [{ $eq: [STORE_PAYOUT_STATUS, "settled"] }, moneyFields.net, 0],
            },
          },
          pendingSettlement: {
            $sum: {
              $cond: [
                {
                  $in: [
                    STORE_PAYOUT_STATUS,
                    ["pending", "processing", "failed"],
                  ],
                },
                moneyFields.net,
                0,
              ],
            },
          },
        },
      },
    ]),
    FoodOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$restaurant",
          orderCount: { $sum: 1 },
          grossSales: { $sum: moneyFields.gross },
          commission: { $sum: moneyFields.commission },
          netEarnings: { $sum: moneyFields.net },
        },
      },
    ]),
    FoodOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ["$paymentMethod", "UNKNOWN"] },
          orderCount: { $sum: 1 },
          netEarnings: { $sum: moneyFields.net },
          grossSales: { $sum: moneyFields.gross },
        },
      },
    ]),
    FoodOrder.countDocuments(match),
    FoodOrder.find(match)
      .select(
        "restaurant status paymentMethod paymentStatus subtotal restaurantCommission restaurantNet commissionFree settlementStatus settlementDetails.restaurant.status settledAt createdAt customer"
      )
      .populate("customer", "name phone")
      .populate("restaurant", "name imageEmoji")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  const raw = summaryAgg[0] || {};
  const summary = {
    orderCount: raw.orderCount || 0,
    grossSales: round2(raw.grossSales),
    commission: round2(raw.commission),
    netEarnings: round2(raw.netEarnings),
    settled: round2(raw.settled),
    pendingSettlement: round2(raw.pendingSettlement),
    byPaymentMethod: {
      CASH: { orderCount: 0, grossSales: 0, netEarnings: 0 },
      MOBILE_MONEY: { orderCount: 0, grossSales: 0, netEarnings: 0 },
    },
  };

  for (const row of byPaymentAgg) {
    const key = row._id === "CASH" || row._id === "MOBILE_MONEY" ? row._id : null;
    if (!key) continue;
    summary.byPaymentMethod[key] = {
      orderCount: row.orderCount || 0,
      grossSales: round2(row.grossSales),
      netEarnings: round2(row.netEarnings),
    };
  }

  const storeMap = new Map(restaurants.map((r) => [String(r._id), r]));
  const byStore = byStoreAgg
    .map((row) => {
      const id = String(row._id);
      const store = storeMap.get(id);
      return {
        restaurantId: id,
        name: store?.name || "Store",
        imageEmoji: store?.imageEmoji,
        orderCount: row.orderCount || 0,
        grossSales: round2(row.grossSales),
        commission: round2(row.commission),
        netEarnings: round2(row.netEarnings),
      };
    })
    .sort((a, b) => b.netEarnings - a.netEarnings);

  // Include owned stores with zero activity in the selected range when viewing all
  if (scopeRestaurantId === "all") {
    const seen = new Set(byStore.map((s) => s.restaurantId));
    for (const r of restaurants) {
      const id = String(r._id);
      if (seen.has(id)) continue;
      byStore.push({
        restaurantId: id,
        name: r.name,
        imageEmoji: r.imageEmoji,
        orderCount: 0,
        grossSales: 0,
        commission: 0,
        netEarnings: 0,
      });
    }
  }

  const txRows = transactions.map((o) => {
    const gross = Number(o.subtotal) || 0;
    const commission = Number(o.restaurantCommission) || 0;
    const net =
      o.restaurantNet != null
        ? Number(o.restaurantNet)
        : Math.max(0, gross - commission);
    return {
      _id: o._id,
      createdAt: o.createdAt,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      settlementStatus: storePayoutStatus(o),
      settledAt: o.settledAt,
      subtotal: gross,
      restaurantCommission: commission,
      restaurantNet: net,
      commissionFree: !!o.commissionFree,
      customer: o.customer
        ? { name: o.customer.name, phone: o.customer.phone }
        : null,
      restaurant: o.restaurant
        ? {
            _id: o.restaurant._id,
            name: o.restaurant.name,
            imageEmoji: o.restaurant.imageEmoji,
          }
        : null,
    };
  });

  res.status(StatusCodes.OK).json({
    from: rangeFrom ? rangeFrom.toISOString().slice(0, 10) : null,
    to: rangeTo ? rangeTo.toISOString().slice(0, 10) : null,
    scope: {
      restaurantId: scopeRestaurantId,
      storeName: storeName || null,
    },
    summary,
    byStore,
    // Stores in scope that are in their commission-free period, and until when.
    freePeriods: restaurants
      .filter((r) => scopeIds.some((id) => String(id) === String(r._id)) && isCommissionFree(r))
      .map((r) => ({ restaurantId: String(r._id), name: r.name, until: r.commissionFreeUntil })),
    transactions: txRows,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
  });
};

function emptyFinanceSummary() {
  return {
    orderCount: 0,
    grossSales: 0,
    commission: 0,
    netEarnings: 0,
    settled: 0,
    pendingSettlement: 0,
    byPaymentMethod: {
      CASH: { orderCount: 0, grossSales: 0, netEarnings: 0 },
      MOBILE_MONEY: { orderCount: 0, grossSales: 0, netEarnings: 0 },
    },
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * GET /merchant/ledger — what each owned store owes QareGO and why it changed.
 * Query: restaurantId=all|<id>, page, limit
 */
export const getMyLedger = async (req, res) => {
  const { restaurantId: restaurantIdParam = "all", page = 1, limit = 25 } = req.query;

  const restaurants = await Restaurant.find({ owner: req.user.id })
    .select("name imageEmoji commissionOwed")
    .sort({ createdAt: 1 })
    .lean();
  const ownedKey = new Set(restaurants.map((r) => String(r._id)));

  let scope = restaurants;
  if (restaurantIdParam && String(restaurantIdParam) !== "all") {
    const id = String(restaurantIdParam);
    if (!ownedKey.has(id)) throw new BadRequestError("Store not found or not owned by you");
    scope = restaurants.filter((r) => String(r._id) === id);
  }

  const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const balances = scope.map((r) => ({
    restaurantId: String(r._id),
    name: r.name,
    imageEmoji: r.imageEmoji,
    owed: money(r.commissionOwed),
  }));

  const perPage = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const query = { restaurant: { $in: scope.map((r) => r._id) } };
  const [total, rows] = await Promise.all([
    StoreLedgerEntry.countDocuments(query),
    StoreLedgerEntry.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * perPage)
      .limit(perPage)
      .lean(),
  ]);
  const byId = new Map(restaurants.map((r) => [String(r._id), r]));

  res.status(StatusCodes.OK).json({
    balances,
    totalOwed: money(balances.reduce((sum, b) => sum + b.owed, 0)),
    entries: rows.map((e) => {
      const store = byId.get(String(e.restaurant));
      return {
        _id: e._id,
        createdAt: e.createdAt,
        type: e.type,
        amount: money(e.amount),
        owedAfter: money(e.owedAfter),
        note: e.note,
        foodOrder: e.foodOrder ? String(e.foodOrder) : null,
        restaurant: store ? { _id: String(store._id), name: store.name, imageEmoji: store.imageEmoji } : null,
      };
    }),
    total,
    page: pageNum,
    pages: Math.max(Math.ceil(total / perPage), 1),
  });
};
