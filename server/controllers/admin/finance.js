// Admin finance: stats, transactions, food payments, rider credits and weekly payouts.
import StoreLedgerEntry from "../../models/StoreLedgerEntry.js";
import Restaurant from "../../models/Restaurant.js";
import User from "../../models/User.js";
import Ride from "../../models/Ride.js";
import Transaction from "../../models/Transaction.js";
import { StatusCodes } from "http-status-codes";
import { getSettings } from "../../utils/tripSettlement.js";
import { appendWebhookToken } from "../../middleware/hubtelWebhookAuth.js";
import FoodPayment from "../../models/FoodPayment.js";
import FoodOrder from "../../models/FoodOrder.js";
import { settleFoodOrderOnDelivery } from "../../utils/foodOrderSettlement.js";
import { sendPayment } from "../../utils/hubtelService.js";

export const getFinanceStats = async (req, res) => {
  try {
    const settings = await getSettings();
    const commissionRate = settings.commissionRate ?? 0.15;

    const totalRevenue = await Ride.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: "$fare" } } }
    ]);

    const monthlyRevenue = await Ride.aggregate([
      { $match: { status: 'COMPLETED' } },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$fare" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const total = totalRevenue[0]?.total || 0;
    const platformIncome = total * commissionRate;
    const driverEarnings = total - platformIncome;

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
      totalRevenue: total,
      platformIncome,
      driverEarnings,
      totalCommissionOwed,
      totalDriverBalance,
      commissionRate,
      monthlyRevenue
    });
  } catch (error) {
    console.error('Finance stats error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch finance stats' });
  }
};

/** GET /admin/transactions - List transactions (optional ?driverId=) */
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
        .populate("order", "status total subtotal paymentStatus settlementStatus settledAt createdAt")
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
  try {
    const payment = await FoodPayment.findById(req.params.id);
    if (!payment) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Payment not found" });
    }
    if (payment.status !== "success") {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Cannot retry payout before payment success" });
    }

    const order = await FoodOrder.findById(payment.order);
    if (!order) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Order not found" });
    }

    if (order.settlementStatus === "settled") {
      return res.status(StatusCodes.OK).json({
        message: "Order already settled",
        order,
        payment,
      });
    }

    if (order.settlementStatus === "failed" || order.settlementStatus === "processing") {
      // Allow reclaim when a leg failed, or when Hubtel accepted but callback never arrived.
      const details = { ...(order.settlementDetails || {}) };
      for (const field of ["restaurant", "rider"]) {
        if (details[field]?.status === "pending") {
          details[field] = {
            ...details[field],
            status: "failed",
            error: "Retry: previous payout unconfirmed",
            // New ClientReference on next send (Hubtel may reject duplicate refs).
            reference: null,
          };
        }
      }
      order.settlementDetails = details;
      order.settlementStatus = "pending";
      order.settlementError = null;
      await order.save();
    }

    const result = await settleFoodOrderOnDelivery(order._id);
    const refreshedOrder = await FoodOrder.findById(order._id).lean();

    res.status(StatusCodes.OK).json({
      message:
        refreshedOrder?.settlementStatus === "settled"
          ? "Settlement completed"
          : refreshedOrder?.settlementStatus === "failed"
            ? "Settlement failed — check restaurant/rider payout phones and Hubtel balance"
            : refreshedOrder?.settlementStatus === "processing"
              ? "Disbursement submitted — waiting for Hubtel payout callback"
              : "Settlement pending — order may not be delivered yet",
      result,
      order: refreshedOrder,
      payment,
    });
  } catch (error) {
    console.error("Retry food payout admin error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to retry food settlement" });
  }
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
  try {
    const { sendPayment, makeShortHubtelRef, detectGhMomoChannel } = await import('../utils/hubtelService.js');
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
      const amount = Number(driver.balance);
      if (amount <= 0 || !driver.phone) continue;

      const clientReference = makeShortHubtelRef('po', driver._id);
      const result = await sendPayment({
        RecipientName: driver.name || 'Driver',
        RecipientMsisdn: driver.phone,
        Amount: amount,
        PrimaryCallbackUrl: callbackUrl,
        Description: 'QareGO Weekly Payout',
        ClientReference: clientReference,
        Channel: detectGhMomoChannel(driver.phone),
      });

      if (result.success) {
        await User.findByIdAndUpdate(driver._id, { balance: 0 });
        const Transaction = (await import('../models/Transaction.js')).default;
        await Transaction.create({
          driver: driver._id,
          amount: -amount,
          type: 'PAYOUT',
          note: 'Weekly payout (Hubtel)',
          reference: clientReference,
          balanceAfter: 0,
        });
        results.processed++;
      } else {
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

/** GET /admin/store-debts — stores holding QareGO's share from cash pickup orders. */
export const getStoreDebtsAdmin = async (_req, res) => {
  const stores = await Restaurant.find({ commissionOwed: { $gt: 0.004 } })
    .select("name address commissionOwed owner")
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
      owed: Math.round(Number(s.commissionOwed) * 100) / 100,
    })),
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
