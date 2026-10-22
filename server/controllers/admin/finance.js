// Admin finance: stats, transactions, food payments, rider credits and weekly payouts.
import StoreLedgerEntry from "../../models/StoreLedgerEntry.js";
import Restaurant from "../../models/Restaurant.js";
import User from "../../models/User.js";
import Ride from "../../models/Ride.js";
import Transaction from "../../models/Transaction.js";
import { StatusCodes } from "http-status-codes";
import { assertMomoEnabled } from "../../utils/momoAvailability.js";
import { getSettings } from "../../utils/tripSettlement.js";
import { appendWebhookToken } from "../../middleware/hubtelWebhookAuth.js";
import FoodPayment from "../../models/FoodPayment.js";
import FoodOrder from "../../models/FoodOrder.js";
import { retryFoodOrderSettlement } from "../../utils/foodOrderSettlement.js";
import { sendPayment } from "../../utils/hubtelService.js";

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * GET /admin/finance — money across every service, from what was actually recorded:
 * trips (rides and parcels) use their commission entries; store orders (food, grocery,
 * pharmacy, gas) use the split frozen on each delivered order. Food courier trips are
 * part of their order, so they are not counted again as trips.
 */
export const getFinanceStats = async (req, res) => {
  try {
    // Commission comes from each completed trip's own entries, so entries left behind by
    // deleted or test rides never count.
    const [tripTotals] = await Ride.aggregate([
      { $match: { status: 'COMPLETED', foodOrder: null } },
      {
        $lookup: {
          from: 'transactions',
          let: { rideId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$ride', '$$rideId'] }, type: 'COMMISSION_DEBIT' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ],
          as: 'commission',
        },
      },
      {
        $group: {
          _id: null,
          gross: { $sum: '$fare' },
          count: { $sum: 1 },
          commission: { $sum: { $ifNull: [{ $arrayElemAt: ['$commission.total', 0] }, 0] } },
        },
      },
    ]);

    const orderByVertical = await FoodOrder.aggregate([
      { $match: { status: 'DELIVERED' } },
      { $lookup: { from: 'restaurants', localField: 'restaurant', foreignField: '_id', as: 'store' } },
      {
        $group: {
          _id: { $ifNull: [{ $arrayElemAt: ['$store.vertical', 0] }, 'FOOD'] },
          count: { $sum: 1 },
          gross: { $sum: '$total' },
          platform: { $sum: { $ifNull: ['$platformNet', 0] } },
          riders: { $sum: { $ifNull: ['$riderNet', 0] } },
        },
      },
      { $sort: { gross: -1 } },
    ]);

    const trips = {
      count: tripTotals?.count || 0,
      gross: money(tripTotals?.gross),
      platform: money(-(tripTotals?.commission || 0)),
    };
    const storeOrders = orderByVertical.reduce(
      (acc, v) => ({
        count: acc.count + v.count,
        gross: money(acc.gross + v.gross),
        platform: money(acc.platform + v.platform),
        riders: money(acc.riders + v.riders),
      }),
      { count: 0, gross: 0, platform: 0, riders: 0 }
    );

    // Per calendar month (year included, so two Octobers never merge).
    const monthKey = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
    const [tripMonths, orderMonths] = await Promise.all([
      Ride.aggregate([
        { $match: { status: 'COMPLETED', foodOrder: null } },
        { $group: { _id: monthKey, count: { $sum: 1 }, gross: { $sum: '$fare' } } },
      ]),
      FoodOrder.aggregate([
        { $match: { status: 'DELIVERED' } },
        {
          $group: {
            _id: monthKey,
            count: { $sum: 1 },
            gross: { $sum: '$total' },
            platform: { $sum: { $ifNull: ['$platformNet', 0] } },
          },
        },
      ]),
    ]);
    const months = new Map();
    for (const m of tripMonths) {
      months.set(m._id, { month: m._id, trips: m.count, orders: 0, gross: m.gross, orderPlatform: 0 });
    }
    for (const m of orderMonths) {
      const row = months.get(m._id) || { month: m._id, trips: 0, orders: 0, gross: 0, orderPlatform: 0 };
      row.orders = m.count;
      row.gross += m.gross;
      row.orderPlatform = m.platform;
      months.set(m._id, row);
    }
    const monthlyRevenue = [...months.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({ month: m.month, trips: m.trips, orders: m.orders, gross: money(m.gross) }));

    // Total commission owed by drivers (sum of negative balances)
    const driverDebt = await User.aggregate([
      { $match: { role: 'rider', balance: { $lt: 0 } } },
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);
    const totalCommissionOwed = Math.abs(driverDebt[0]?.total || 0);

    // Total driver balance (positive = we owe them; negative = they owe us)
    const allDriverBalances = await User.aggregate([
      { $match: { role: 'rider' } },
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);
    const totalDriverBalance = allDriverBalances[0]?.total || 0;

    res.status(StatusCodes.OK).json({
      totalRevenue: money(trips.gross + storeOrders.gross),
      platformIncome: money(trips.platform + storeOrders.platform),
      driverEarnings: money(trips.gross - trips.platform + storeOrders.riders),
      trips,
      storeOrders: {
        count: storeOrders.count,
        gross: storeOrders.gross,
        platform: storeOrders.platform,
        byVertical: orderByVertical.map((v) => ({
          vertical: v._id,
          count: v.count,
          gross: money(v.gross),
          platform: money(v.platform),
        })),
      },
      totalCommissionOwed,
      totalDriverBalance,
      monthlyRevenue,
    });
  } catch (error) {
    console.error('Finance stats error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch finance stats' });
  }
};

export const getTransactionsAdmin = async (req, res) => {
  try {
    const { driverId, limit = 50, page = 1 } = req.query;
    const query = driverId ? { driver: driverId } : {};
    const skip = (Number(page) - 1) * Number(limit);
    const [transactions, total] = await Promise.all([
      Transaction.find(query).populate('ride', 'fare status').populate('driver', 'name phone').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Transaction.countDocuments(query)
    ]);
    res.status(StatusCodes.OK).json({ transactions, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch transactions' });
  }
};

/** GET /admin/food-payments - monitor checkout + payout pipeline */
export const getFoodPaymentsAdmin = async (req, res) => {
  try {
    const {
      status,
      payoutStatus,
      restaurantId,
      q,
      page = 1,
      limit = 25,
    } = req.query;
    const query = {};
    if (status) query.status = String(status);
    if (payoutStatus) query.payoutStatus = String(payoutStatus);
    if (restaurantId) query.restaurant = restaurantId;
    if (q) {
      query.clientReference = { $regex: String(q).trim(), $options: "i" };
    }
    const nPage = Math.max(1, Number(page) || 1);
    const nLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const skip = (nPage - 1) * nLimit;

    const [rows, total] = await Promise.all([
      FoodPayment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(nLimit)
        .populate("restaurant", "name payoutConfig")
        .populate("customer", "name phone")
        .populate("order", "status total subtotal paymentStatus settlementStatus settlementError settledAt createdAt")
        .lean(),
      FoodPayment.countDocuments(query),
    ]);

    res.status(StatusCodes.OK).json({
      payments: rows,
      total,
      page: nPage,
      totalPages: Math.ceil(total / nLimit),
    });
  } catch (error) {
    console.error("Get food payments admin error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to load food payments" });
  }
};

/** POST /admin/food-payments/:id/retry-payout - retry delivery-time food settlement disbursement */
export const retryFoodPaymentPayoutAdmin = async (req, res) => {
  // Payouts go out by mobile money, which is paused until the new provider is live.
  assertMomoEnabled();
  const payment = await FoodPayment.findById(req.params.id).lean();
  if (!payment) {
    return res.status(StatusCodes.NOT_FOUND).json({ message: "Payment not found" });
  }
  if (payment.status !== "success") {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "Cannot retry payout before payment success" });
  }
  const { order, message } = await retryFoodOrderSettlement(payment.order);
  if (!order) return res.status(StatusCodes.BAD_REQUEST).json({ message });
  res.status(StatusCodes.OK).json({ message, order, payment });
};

/** POST /admin/drivers/:id/credit - Manual adjustment (credit driver balance) */
export const creditDriverBalance = async (req, res) => {
  try {
    const { id: driverId } = req.params;
    const { amount: rawAmount, note, kind } = req.body;
    const amount = Math.round(Number(rawAmount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Positive amount is required' });
    }
    // CASH_REPAYMENT = rider handed over the commission they owe in cash.
    const isCashRepayment = kind === 'CASH_REPAYMENT';
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'rider') {
      return res.status(404).json({ message: 'Driver not found' });
    }
    const balance = Math.round((Number(driver.balance ?? 0) + amount) * 100) / 100;
    const update = { balance };
    // Same rule as a MoMo debt top-up: a debt suspension lifts once nothing is owed.
    const reactivated = driver.driverDetails?.status === 'suspended_debt' && balance >= 0;
    if (reactivated) update['driverDetails.status'] = 'active';
    await User.findByIdAndUpdate(driverId, update);
    await Transaction.create({
      driver: driverId,
      amount,
      type: 'MANUAL_CREDIT',
      note: note?.trim() || (isCashRepayment ? 'Cash commission payment' : 'Admin credit'),
      balanceAfter: balance
    });
    const updated = await User.findById(driverId).select('name phone balance driverDetails.status');
    res.status(StatusCodes.OK).json({ message: 'Balance credited', driver: updated, reactivated });
  } catch (error) {
    console.error('Credit driver error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to credit driver' });
  }
};

/** POST /admin/payouts/run - Execute weekly payouts: send balance to drivers via Hubtel (MoMo). */
export const runWeeklyPayouts = async (req, res) => {
  assertMomoEnabled();
  try {
    const { makeShortHubtelRef } = await import('../../utils/hubtelService.js');
    const { sendMomoPayout } = await import('../../utils/momoPayout.js');
    const baseUrl =
      process.env.BASE_URL ||
      process.env.PUBLIC_API_URL ||
      process.env.API_BASE_URL ||
      'http://localhost:3000';
    const callbackUrl = appendWebhookToken(
      `${baseUrl.replace(/\/$/, '')}/webhooks/hubtel-payout`
    );

    const drivers = await User.find({ role: 'rider', balance: { $gt: 0 } }).select('name phone balance');
    const results = { processed: 0, failed: 0, errors: [] };

    for (const driver of drivers) {
      const amount = Math.round(Number(driver.balance) * 100) / 100;
      if (amount <= 0 || !driver.phone) continue;

      // Take the money off the wallet first (only if it's still there), so a trip settling
      // mid-run isn't lost and the same balance can't be paid twice.
      const taken = await User.findOneAndUpdate(
        { _id: driver._id, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { new: true }
      ).select('balance');
      if (!taken) continue;
      const balanceAfter = Math.round(Number(taken.balance) * 100) / 100;

      const clientReference = makeShortHubtelRef('po', driver._id);
      const Transaction = (await import('../../models/Transaction.js')).default;
      await Transaction.create({
        driver: driver._id,
        amount: -amount,
        type: 'PAYOUT',
        note: 'Weekly payout',
        reference: clientReference,
        balanceAfter,
      });
      const result = await sendMomoPayout({
        name: driver.name || 'Driver',
        phone: driver.phone,
        amount,
        reference: clientReference,
        reason: 'QareGO weekly payout',
        callbackUrl,
      });

      if (result.success) {
        results.processed++;
      } else {
        // Couldn't send: give it back straight away.
        const back = await User.findByIdAndUpdate(driver._id, { $inc: { balance: amount } }, { new: true }).select('balance');
        await Transaction.create({
          driver: driver._id,
          amount,
          type: 'MANUAL_CREDIT',
          note: `Payout failed — balance restored (${result.error})`,
          reference: `reversal_${clientReference}`,
          balanceAfter: Math.round(Number(back?.balance ?? 0) * 100) / 100,
        });
        results.failed++;
        results.errors.push({ driverId: driver._id, error: result.error });
      }
    }

    res.status(StatusCodes.OK).json({
      message: 'Payout run completed',
      ...results,
    });
  } catch (error) {
    console.error('Run payouts error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to run payouts' });
  }
};

/** GET /admin/rider-debts — riders who owe commission (negative balance), most owed first. */
export const getRiderDebtsAdmin = async (_req, res) => {
  const settings = await getSettings();
  const riders = await User.find({ role: 'rider', balance: { $lt: 0 }, deletedAt: null })
    .select('name phone balance driverDetails.status driverDetails.vehicle')
    .sort({ balance: 1 })
    .limit(500)
    .lean();
  res.status(StatusCodes.OK).json({
    debtLimit: settings.debtLimit ?? -100,
    riders: riders.map((r) => ({
      _id: r._id,
      name: r.name,
      phone: r.phone,
      owed: Math.round(-Number(r.balance) * 100) / 100,
      status: r.driverDetails?.status || 'active',
    })),
  });
};

/**
 * GET /admin/store-debts — stores holding QareGO's share from cash pickup orders.
 * ?all=1 lists every store, including ones at zero or in credit.
 */
export const getStoreDebtsAdmin = async (req, res) => {
  const all = req.query?.all === "1" || req.query?.all === "true";
  const stores = await Restaurant.find(all ? {} : { commissionOwed: { $gt: 0.004 } })
    .select("name address commissionOwed owner vertical isActive")
    .populate("owner", "name phone")
    .sort({ commissionOwed: -1 })
    .limit(500)
    .lean();
  res.status(StatusCodes.OK).json({
    stores: stores.map((s) => ({
      _id: s._id,
      name: s.name,
      address: s.address,
      owner: s.owner ? { name: s.owner.name, phone: s.owner.phone } : null,
      vertical: s.vertical,
      isActive: s.isActive !== false,
      owed: Math.round((Number(s.commissionOwed) || 0) * 100) / 100,
    })),
  });
};

/**
 * GET /admin/stores/:id/ledger — why a store's balance changed (same rows the merchant sees).
 * Query: page, limit
 */
export const getStoreLedgerAdmin = async (req, res) => {
  const store = await Restaurant.findById(req.params.id).select("name commissionOwed").lean();
  if (!store) return res.status(StatusCodes.NOT_FOUND).json({ message: "Store not found" });
  const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const perPage = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const query = { restaurant: store._id };
  const [total, rows] = await Promise.all([
    StoreLedgerEntry.countDocuments(query),
    StoreLedgerEntry.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * perPage)
      .limit(perPage)
      .lean(),
  ]);
  res.status(StatusCodes.OK).json({
    store: { _id: store._id, name: store.name, owed: money(store.commissionOwed) },
    entries: rows.map((e) => ({
      _id: e._id,
      createdAt: e.createdAt,
      type: e.type,
      amount: money(e.amount),
      owedAfter: money(e.owedAfter),
      note: e.note,
      foodOrder: e.foodOrder ? String(e.foodOrder) : null,
    })),
    total,
    page: pageNum,
    pages: Math.max(Math.ceil(total / perPage), 1),
  });
};

/** POST /admin/stores/:id/commission-payment — store paid QareGO its share in cash. */
export const recordStoreCommissionPayment = async (req, res) => {
  const amount = Math.round(Number(req.body?.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: "Positive amount is required" });
  }
  const store = await Restaurant.findByIdAndUpdate(
    req.params.id,
    { $inc: { commissionOwed: -amount } },
    { new: true }
  );
  if (!store) return res.status(StatusCodes.NOT_FOUND).json({ message: "Store not found" });
  const owedAfter = Math.round(Number(store.commissionOwed) * 100) / 100;
  await StoreLedgerEntry.create({
    restaurant: store._id,
    type: "CASH_PAYMENT",
    amount: -amount,
    owedAfter,
    note: req.body?.note?.trim() || "Cash payment received",
  });
  res.status(StatusCodes.OK).json({ owed: owedAfter });
};
