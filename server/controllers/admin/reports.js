// Admin reports: activity and money for any date range, compared with the period before it.
import User from "../../models/User.js";
import Ride from "../../models/Ride.js";
import FoodOrder from "../../models/FoodOrder.js";
import { StatusCodes } from "http-status-codes";

const DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366;
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** "2026-10-01" → that day's UTC midnight (Ghana is on UTC all year). */
function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dayKey = (d) => d.toISOString().slice(0, 10);

/** Commission recorded on each trip (negative amounts), so riders' cut = fare + commission. */
const tripCommissionLookup = {
  $lookup: {
    from: 'transactions',
    let: { rideId: '$_id' },
    pipeline: [
      { $match: { $expr: { $eq: ['$ride', '$$rideId'] }, type: 'COMMISSION_DEBIT' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ],
    as: 'commission',
  },
};
const commissionOf = { $ifNull: [{ $arrayElemAt: ['$commission.total', 0] }, 0] };

/**
 * Headline numbers for one period. Same rules as Finance: completed trips (rides and parcels)
 * and delivered store orders; food courier trips belong to their order and aren't counted twice.
 */
async function periodTotals(start, end) {
  const range = { $gte: start, $lt: end };
  const [[trips], [orders], cancelledOrders, newCustomers, newRiders, buyers] = await Promise.all([
    Ride.aggregate([
      { $match: { status: 'COMPLETED', foodOrder: null, createdAt: range } },
      tripCommissionLookup,
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          parcels: { $sum: { $cond: [{ $eq: ['$serviceType', 'DELIVERY'] }, 1, 0] } },
          gross: { $sum: '$fare' },
          commission: { $sum: commissionOf },
        },
      },
    ]),
    FoodOrder.aggregate([
      { $match: { status: 'DELIVERED', createdAt: range } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          gross: { $sum: '$total' },
          platform: { $sum: { $ifNull: ['$platformNet', 0] } },
          riders: { $sum: { $ifNull: ['$riderNet', 0] } },
        },
      },
    ]),
    FoodOrder.countDocuments({ status: 'CANCELLED', createdAt: range }),
    User.countDocuments({ role: 'customer', createdAt: range }),
    User.countDocuments({ role: 'rider', createdAt: range }),
    Promise.all([
      Ride.distinct('customer', { status: 'COMPLETED', foodOrder: null, createdAt: range }),
      FoodOrder.distinct('customer', { status: 'DELIVERED', createdAt: range }),
    ]),
  ]);

  const tripPlatform = -(trips?.commission || 0);
  const orderCount = orders?.count || 0;
  const activeCustomers = new Set([...buyers[0], ...buyers[1]].map(String)).size;
  return {
    trips: (trips?.count || 0) - (trips?.parcels || 0),
    parcels: trips?.parcels || 0,
    orders: orderCount,
    cancelledOrders,
    cancelRate: orderCount + cancelledOrders ? cancelledOrders / (orderCount + cancelledOrders) : 0,
    bookings: money((trips?.gross || 0) + (orders?.gross || 0)),
    income: money(tripPlatform + (orders?.platform || 0)),
    riderEarnings: money((trips?.gross || 0) - tripPlatform + (orders?.riders || 0)),
    newCustomers,
    newRiders,
    activeCustomers,
  };
}

/**
 * GET /admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD (both days included; default the last 30 days).
 */
export const getReport = async (req, res) => {
  const today = parseDay(dayKey(new Date()));
  const to = parseDay(req.query.to) || today;
  const from = parseDay(req.query.from) || new Date(to.getTime() - 29 * DAY);
  if (from > to) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'The start date is after the end date' });
  }
  const days = Math.round((to - from) / DAY) + 1;
  if (days > MAX_DAYS) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Pick a range of one year or less' });
  }

  const start = from;
  const end = new Date(to.getTime() + DAY);
  const prevStart = new Date(start.getTime() - days * DAY);
  const range = { $gte: start, $lt: end };
  const dayOf = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
  const verticalOf = { $ifNull: [{ $arrayElemAt: ['$store.vertical', 0] }, 'FOOD'] };
  const storeLookup = { $lookup: { from: 'restaurants', localField: 'restaurant', foreignField: '_id', as: 'store' } };

  const [
    totals,
    previous,
    tripDays,
    orderDays,
    tripServices,
    orderServices,
    topStores,
    topRiders,
    tripHours,
    orderHours,
  ] = await Promise.all([
    periodTotals(start, end),
    periodTotals(prevStart, start),
    Ride.aggregate([
      { $match: { status: 'COMPLETED', foodOrder: null, createdAt: range } },
      tripCommissionLookup,
      { $group: { _id: dayOf, count: { $sum: 1 }, gross: { $sum: '$fare' }, commission: { $sum: commissionOf } } },
    ]),
    FoodOrder.aggregate([
      { $match: { status: 'DELIVERED', createdAt: range } },
      {
        $group: {
          _id: dayOf,
          count: { $sum: 1 },
          gross: { $sum: '$total' },
          platform: { $sum: { $ifNull: ['$platformNet', 0] } },
        },
      },
    ]),
    Ride.aggregate([
      { $match: { status: 'COMPLETED', foodOrder: null, createdAt: range } },
      tripCommissionLookup,
      {
        $group: {
          _id: '$serviceType',
          count: { $sum: 1 },
          gross: { $sum: '$fare' },
          commission: { $sum: commissionOf },
        },
      },
    ]),
    FoodOrder.aggregate([
      { $match: { status: { $in: ['DELIVERED', 'CANCELLED'] }, createdAt: range } },
      storeLookup,
      {
        $group: {
          _id: verticalOf,
          count: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
          gross: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, '$total', 0] } },
          platform: {
            $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, { $ifNull: ['$platformNet', 0] }, 0] },
          },
        },
      },
    ]),
    // Stores ranked by what they sold (food subtotal, the figure merchants see).
    FoodOrder.aggregate([
      { $match: { status: { $in: ['DELIVERED', 'CANCELLED'] }, createdAt: range } },
      {
        $group: {
          _id: '$restaurant',
          name: { $last: '$restaurantName' },
          orders: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
          sales: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, '$subtotal', 0] } },
        },
      },
      { $sort: { sales: -1, orders: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'restaurants', localField: '_id', foreignField: '_id', as: 'store' } },
      {
        $project: {
          name: { $ifNull: [{ $arrayElemAt: ['$store.name', 0] }, '$name'] },
          vertical: verticalOf,
          orders: 1,
          cancelled: 1,
          sales: 1,
        },
      },
    ]),
    // Riders ranked by completed jobs: trips earn fare minus commission, store deliveries their order's rider share.
    Ride.aggregate([
      { $match: { status: 'COMPLETED', rider: { $ne: null }, createdAt: range } },
      tripCommissionLookup,
      { $lookup: { from: 'foodorders', localField: 'foodOrder', foreignField: '_id', as: 'order' } },
      // A gas order can take two legs (collect, then return); its rider share is split between them.
      {
        $lookup: {
          from: 'rides',
          let: { orderId: '$foodOrder' },
          pipeline: [
            { $match: { $expr: { $and: [{ $ne: ['$$orderId', null] }, { $eq: ['$foodOrder', '$$orderId'] }] }, status: 'COMPLETED' } },
            { $count: 'n' },
          ],
          as: 'legs',
        },
      },
      {
        $group: {
          _id: '$rider',
          jobs: { $sum: 1 },
          earned: {
            $sum: {
              $cond: [
                { $gt: ['$foodOrder', null] },
                {
                  $divide: [
                    { $ifNull: [{ $arrayElemAt: ['$order.riderNet', 0] }, 0] },
                    { $max: [1, { $ifNull: [{ $arrayElemAt: ['$legs.n', 0] }, 1] }] },
                  ],
                },
                { $add: ['$fare', commissionOf] },
              ],
            },
          },
        },
      },
      { $sort: { jobs: -1, earned: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      {
        $project: {
          name: { $arrayElemAt: ['$user.name', 0] },
          phone: { $arrayElemAt: ['$user.phone', 0] },
          jobs: 1,
          earned: 1,
        },
      },
    ]),
    Ride.aggregate([
      { $match: { status: 'COMPLETED', foodOrder: null, createdAt: range } },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
    ]),
    FoodOrder.aggregate([
      { $match: { status: 'DELIVERED', createdAt: range } },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
    ]),
  ]);

  // One row per day, empty days included, so the chart has no gaps.
  const tripsByDay = new Map(tripDays.map((d) => [d._id, d]));
  const ordersByDay = new Map(orderDays.map((d) => [d._id, d]));
  const daily = [];
  for (let t = start.getTime(); t < end.getTime(); t += DAY) {
    const key = dayKey(new Date(t));
    const tr = tripsByDay.get(key);
    const or = ordersByDay.get(key);
    daily.push({
      date: key,
      trips: tr?.count || 0,
      orders: or?.count || 0,
      bookings: money((tr?.gross || 0) + (or?.gross || 0)),
      income: money(-(tr?.commission || 0) + (or?.platform || 0)),
    });
  }

  const tripService = (type) => tripServices.find((s) => s._id === type);
  const byService = [
    ['RIDE', 'Rides'],
    ['DELIVERY', 'Parcels'],
  ]
    .map(([key, label]) => {
      const s = tripService(key);
      return {
        key,
        label,
        count: s?.count || 0,
        cancelled: null,
        bookings: money(s?.gross),
        income: money(-(s?.commission || 0)),
      };
    })
    .concat(
      ['FOOD', 'GROCERY', 'PHARMACY', 'GAS', 'LAUNDRY'].map((key) => {
        const s = orderServices.find((v) => v._id === key);
        return {
          key,
          label: { FOOD: 'Food', GROCERY: 'Groceries', PHARMACY: 'Pharmacy', GAS: 'Cooking gas', LAUNDRY: 'Laundry' }[key],
          count: s?.count || 0,
          cancelled: s?.cancelled || 0,
          bookings: money(s?.gross),
          income: money(s?.platform),
        };
      })
    );

  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count:
      (tripHours.find((h) => h._id === hour)?.count || 0) + (orderHours.find((h) => h._id === hour)?.count || 0),
  }));

  res.status(StatusCodes.OK).json({
    from: dayKey(from),
    to: dayKey(to),
    days,
    previousFrom: dayKey(prevStart),
    previousTo: dayKey(new Date(start.getTime() - DAY)),
    totals,
    previous,
    daily,
    byService,
    topStores: topStores.map((s) => ({ ...s, sales: money(s.sales) })),
    topRiders: topRiders.map((r) => ({ ...r, earned: money(r.earned) })),
    hours,
  });
};
