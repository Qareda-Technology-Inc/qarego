import User from "../../models/User.js";
import Restaurant from "../../models/Restaurant.js";
import MenuItem from "../../models/MenuItem.js";
import FoodOrder from "../../models/FoodOrder.js";
import { StatusCodes } from "http-status-codes";
import { getSettings } from "../../utils/tripSettlement.js";
import { resolveKitchenAlertSoundUrl } from "../../utils/platformAlertSound.js";
import { buildReadiness, countItemsWithPhotos, reviewStatus } from "../../utils/storeReadiness.js";

/**
 * GET /merchant/overview — owner dashboard across ALL their stores.
 * Returns totals plus a per-store breakdown (staff, menu, today's orders/revenue,
 * pending/active counts). Owner-only.
 */
export const getMyOverview = async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const restaurants = await Restaurant.find({ owner: req.user.id })
    .select(
      "name imageEmoji cuisine vertical address isActive isAcceptingOrders imageUrl latitude longitude openingHours licence review.status review.note review.submittedAt review.decidedAt"
    )
    .sort({ createdAt: 1 })
    .lean();

  const ids = restaurants.map((r) => r._id);

  const byRestaurant = (arr) => new Map(arr.map((c) => [String(c._id), c]));

  const [menuCounts, cookCounts, todayAgg, pendingAgg, activeAgg, photoCounts] = await Promise.all([
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
    countItemsWithPhotos(ids),
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
      reviewStatus: reviewStatus(r),
      readiness: buildReadiness(r, photoCounts.get(key) || 0),
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
