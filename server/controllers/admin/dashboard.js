// Admin dashboard: headline stats and on-duty riders.
import User from "../../models/User.js";
import Ride from "../../models/Ride.js";
import { StatusCodes } from "http-status-codes";
import { formatCurrency } from "../../utils/currency.js";
import FoodOrder from "../../models/FoodOrder.js";
import Restaurant from "../../models/Restaurant.js";
import VendorApplication from "../../models/VendorApplication.js";
import { getSettings } from "../../utils/tripSettlement.js";

export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Helper for percentage change
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    // 1. Total Rides (Today vs Yesterday)
    const ridesToday = await Ride.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });
    const ridesYesterday = await Ride.countDocuments({
      createdAt: { $gte: yesterday, $lt: today }
    });
    const ridesChange = calculateChange(ridesToday, ridesYesterday);

    // 2. Active Drivers (Total Active vs Total Pending/Suspended)
    // Now using isOnline for a more accurate 'Active Now' count if desired, 
    // or keep 'Active Accounts'. Let's show 'Online Drivers' as the stat for better real-time utility.
    const onlineDrivers = await User.countDocuments({
      role: 'rider',
      isOnline: true
    });
    // For the change metric, we don't have history of 'online yesterday at this time', 
    // so we'll just show the total approved drivers as context or keep it simple.
    const approvedDrivers = await User.countDocuments({ 
        role: 'rider', 
        'driverDetails.status': 'active' 
    });
    
    // 3. New Sign-ups (Today vs Yesterday)
    const signupsToday = await User.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });
    const signupsYesterday = await User.countDocuments({
      createdAt: { $gte: yesterday, $lt: today }
    });
    const signupsChange = calculateChange(signupsToday, signupsYesterday);

    // 4. Revenue (Today vs Yesterday)
    const getRevenue = async (start, end) => {
      const result = await Ride.aggregate([
        {
          $match: {
            status: 'COMPLETED',
            updatedAt: { $gte: start, $lt: end }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$fare" }
          }
        }
      ]);
      return result[0]?.total || 0;
    };

    const revenueToday = await getRevenue(today, tomorrow);
    const revenueYesterday = await getRevenue(yesterday, today);
    const revenueChange = calculateChange(revenueToday, revenueYesterday);

    res.status(StatusCodes.OK).json({
      stats: [
        {
          name: 'Total Rides (Today)',
          stat: ridesToday.toString(),
          change: `${ridesChange.toFixed(1)}%`,
          changeType: ridesChange >= 0 ? 'increase' : 'decrease'
        },
        {
          name: 'Online Drivers',
          stat: onlineDrivers.toString(),
          change: `${approvedDrivers} total`, // Showing total fleet size as context
          changeType: 'increase'
        },
        {
          name: 'New Sign-ups',
          stat: signupsToday.toString(),
          change: `${signupsChange.toFixed(1)}%`,
          changeType: signupsChange >= 0 ? 'increase' : 'decrease'
        },
        {
          name: 'Revenue (Today)',
          stat: formatCurrency(revenueToday),
          change: `${revenueChange.toFixed(1)}%`,
          changeType: revenueChange >= 0 ? 'increase' : 'decrease'
        }
      ]
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch stats' });
  }
};

export const getActiveDrivers = async (req, res) => {
    try {
        const drivers = await User.find({
            role: 'rider',
            isOnline: true,
            currentLocation: { $exists: true }
        }).select('name phone currentLocation driverDetails.vehicle');

        // Transform to cleaner format for frontend
        const formattedDrivers = drivers.map(d => ({
            id: d._id,
            name: d.name,
            phone: d.phone,
            location: {
                lat: d.currentLocation.coordinates[1],
                lng: d.currentLocation.coordinates[0]
            },
            vehicle: d.driverDetails?.vehicle?.make + ' ' + d.driverDetails?.vehicle?.model
        }));

        res.status(StatusCodes.OK).json({ drivers: formattedDrivers });
    } catch (error) {
        console.error('Fetch active drivers error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch active drivers' });
    }
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const MINUTE = 60 * 1000;
/** Orders waiting this long for the store to accept need a nudge. */
const STORE_ACCEPT_LATE_MIN = 5;
/** Ready delivery orders with no rider after this long need help. */
const NO_RIDER_LATE_MIN = 10;
/** Ride requests still searching after this long. */
const RIDE_SEARCH_LATE_MIN = 5;

async function dayTotals(start, end) {
  const [trips] = await Ride.aggregate([
    { $match: { status: "COMPLETED", foodOrder: null, updatedAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: null,
        rides: { $sum: { $cond: [{ $eq: ["$serviceType", "DELIVERY"] }, 0, 1] } },
        parcels: { $sum: { $cond: [{ $eq: ["$serviceType", "DELIVERY"] }, 1, 0] } },
        gross: { $sum: "$fare" },
      },
    },
  ]);
  const orders = await FoodOrder.aggregate([
    { $match: { status: "DELIVERED", updatedAt: { $gte: start, $lt: end } } },
    { $lookup: { from: "restaurants", localField: "restaurant", foreignField: "_id", as: "store" } },
    {
      $group: {
        _id: { $ifNull: [{ $arrayElemAt: ["$store.vertical", 0] }, "FOOD"] },
        count: { $sum: 1 },
        gross: { $sum: "$total" },
      },
    },
  ]);
  const byVertical = Object.fromEntries(orders.map((o) => [o._id, o.count]));
  const ordersGross = orders.reduce((sum, o) => sum + o.gross, 0);
  return {
    rides: trips?.rides || 0,
    parcels: trips?.parcels || 0,
    food: byVertical.FOOD || 0,
    grocery: byVertical.GROCERY || 0,
    pharmacy: byVertical.PHARMACY || 0,
    gas: byVertical.GAS || 0,
    laundry: byVertical.LAUNDRY || 0,
    bookings: round2((trips?.gross || 0) + ordersGross),
  };
}

/**
 * GET /admin/overview — today across every service (vs yesterday), what's live now, and
 * the things an admin should act on. Ghana is on UTC, so days start at UTC midnight.
 */
export const getAdminOverview = async (_req, res) => {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * MINUTE);
  const settings = await getSettings();
  const debtLimit = settings.debtLimit ?? -100;

  const [today, yesterday] = await Promise.all([
    dayTotals(todayStart, now),
    dayTotals(yesterdayStart, todayStart),
  ]);

  const [
    onlineRiders,
    activeTrips,
    activeOrders,
    newCustomersToday,
    pendingRiders,
    pendingRiderCount,
    ridersOverLimit,
    lateAccept,
    noRider,
    lateRides,
    storeDebt,
    storesToReview,
    newApplications,
  ] = await Promise.all([
    User.countDocuments({ role: "rider", isOnline: true, deletedAt: null }),
    Ride.countDocuments({ status: { $in: ["START", "ARRIVED", "IN_PROGRESS"] } }),
    FoodOrder.countDocuments({ status: { $in: ["PLACED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP"] } }),
    User.countDocuments({ role: "customer", createdAt: { $gte: todayStart }, deletedAt: null }),
    User.find({ role: "rider", "driverDetails.status": "pending", deletedAt: null })
      .select("name phone createdAt")
      .sort({ createdAt: 1 })
      .limit(5)
      .lean(),
    User.countDocuments({ role: "rider", "driverDetails.status": "pending", deletedAt: null }),
    User.find({ role: "rider", balance: { $lt: debtLimit }, deletedAt: null })
      .select("name phone balance")
      .sort({ balance: 1 })
      .limit(5)
      .lean(),
    FoodOrder.find({ status: "PLACED", createdAt: { $lt: new Date(now - STORE_ACCEPT_LATE_MIN * MINUTE) } })
      .select("restaurantName createdAt total")
      .sort({ createdAt: 1 })
      .limit(5)
      .lean(),
    FoodOrder.find({
      status: "READY_FOR_PICKUP",
      fulfillmentType: { $ne: "PICKUP" },
      updatedAt: { $lt: new Date(now - NO_RIDER_LATE_MIN * MINUTE) },
    })
      .select("restaurantName updatedAt total ride")
      .populate("ride", "status rider")
      .sort({ updatedAt: 1 })
      .limit(10)
      .lean(),
    Ride.find({
      status: "SEARCHING_FOR_RIDER",
      foodOrder: null,
      createdAt: { $lt: new Date(now - RIDE_SEARCH_LATE_MIN * MINUTE) },
    })
      .select("serviceType pickup.address createdAt fare")
      .sort({ createdAt: 1 })
      .limit(5)
      .lean(),
    Restaurant.aggregate([
      { $match: { commissionOwed: { $gt: 0.004 } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$commissionOwed" } } },
    ]),
    Restaurant.find({ "review.status": "pending" })
      .select("name vertical review.submittedAt")
      .sort({ "review.submittedAt": 1 })
      .lean(),
    VendorApplication.find({ status: "new" }).select("businessName area createdAt").sort({ createdAt: 1 }).lean(),
  ]);

  const ago = (d) => Math.max(0, Math.round((now - new Date(d)) / MINUTE));
  const waitingForRider = noRider.filter((o) => !o.ride?.rider);

  res.status(StatusCodes.OK).json({
    today,
    yesterday,
    live: { onlineRiders, activeTrips, activeOrders, newCustomersToday },
    actions: {
      newApplications: {
        count: newApplications.length,
        items: newApplications.slice(0, 5).map((a) => ({
          _id: a._id,
          name: a.businessName,
          area: a.area,
          minutes: ago(a.createdAt),
        })),
      },
      storesToReview: {
        count: storesToReview.length,
        items: storesToReview.slice(0, 5).map((r) => ({
          _id: r._id,
          name: r.name,
          vertical: r.vertical,
          minutes: r.review?.submittedAt ? ago(r.review.submittedAt) : null,
        })),
      },
      pendingRiders: {
        count: pendingRiderCount,
        items: pendingRiders.map((r) => ({ _id: r._id, name: r.name || "New rider", phone: r.phone })),
      },
      ridersOverLimit: {
        debtLimit,
        items: ridersOverLimit.map((r) => ({
          _id: r._id,
          name: r.name || "Rider",
          phone: r.phone,
          owed: round2(-r.balance),
        })),
      },
      ordersWaitingAccept: lateAccept.map((o) => ({
        _id: o._id,
        store: o.restaurantName,
        minutes: ago(o.createdAt),
        total: round2(o.total),
      })),
      ordersWithoutRider: waitingForRider.slice(0, 5).map((o) => ({
        _id: o._id,
        store: o.restaurantName,
        minutes: ago(o.updatedAt),
        total: round2(o.total),
      })),
      ridesSearching: lateRides.map((r) => ({
        _id: r._id,
        type: r.serviceType === "DELIVERY" ? "Parcel" : "Ride",
        pickup: r.pickup?.address,
        minutes: ago(r.createdAt),
        fare: round2(r.fare),
      })),
      storesOwing: {
        count: storeDebt[0]?.count || 0,
        total: round2(storeDebt[0]?.total || 0),
      },
    },
  });
};
