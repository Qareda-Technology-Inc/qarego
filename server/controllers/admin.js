import User from "../models/User.js";
import Ride from "../models/Ride.js";
import Transaction from "../models/Transaction.js";
import Settings from "../models/Settings.js";
import { StatusCodes } from "http-status-codes";
import { formatCurrency } from "../utils/currency.js";
import { getSettings } from "../utils/tripSettlement.js";
import { generateOTP } from "../utils/mapUtils.js";
import {
  canRiderReceiveOffer,
  getEligibilityRejectReason,
} from "../utils/riderServiceEligibility.js";
import {
  catalogForAdminResponse,
  getPushTemplatesList,
  mergePushTemplates,
  normalizePushTemplateOverrides,
  invalidatePushTemplateCache,
  renderPushTemplateString,
  buildPushFromTemplate,
} from "../utils/pushNotificationTemplates.js";
import { isFirebaseConfigured } from "../utils/firebaseAdmin.js";
import PushBroadcast from "../models/PushBroadcast.js";
import {
  BROADCAST_AUDIENCE_IDS,
  BROADCAST_AUDIENCES,
  getBroadcastAudienceStats,
  sendBroadcastPush,
} from "../utils/pushBroadcast.js";

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

export const getAllTrips = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    const query = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (type && type !== 'ALL') {
      if (type === 'RIDE') query.serviceType = 'RIDE';
      else if (type === 'DELIVERY') query.serviceType = 'DELIVERY';
    }

    const trips = await Ride.find(query)
      .populate('customer', 'name phone email')
      .populate('rider', 'name phone email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Ride.countDocuments(query);

    res.status(StatusCodes.OK).json({
      trips,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalTrips: count
    });
  } catch (error) {
    console.error('Get all trips error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch trips' });
  }
};

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

/** GET /admin/settings - Get global settings (commission, debt limit) */
export const getSettingsAdmin = async (req, res) => {
  try {
    const settings = await getSettings();
    res.status(StatusCodes.OK).json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch settings' });
  }
};

/** PATCH /admin/settings - Update commission rate, debt limit, and/or fareRates by vehicle */
export const updateSettingsAdmin = async (req, res) => {
  try {
    const {
      commissionRate,
      debtLimit,
      fareRates,
      kitchenAlertSoundUrl,
      riderAlertSoundUrl,
      foodServiceFeeRate,
      foodServiceFeeMin,
      foodServiceFeeMax,
      commissionByService,
      vehicleCapabilityPolicy,
      serviceMaintenance,
      dispatchRankingWeights,
      reliabilityPolicy,
      pushNotificationTemplates,
      menuCategoryLayouts,
      foodPromoBanners,
    } = req.body;
    let settings = await Settings.findOne({ key: 'global' });
    if (!settings) {
      settings = await Settings.create({ key: 'global' });
    }
    if (typeof commissionRate === 'number' && commissionRate >= 0 && commissionRate <= 1) {
      settings.commissionRate = commissionRate;
    }
    if (typeof debtLimit === 'number') {
      settings.debtLimit = debtLimit;
    }
    if (commissionByService && typeof commissionByService === 'object') {
      const normalizedCommission = {};
      ['RIDE', 'DELIVERY', 'FOOD'].forEach((k) => {
        const v = Number(commissionByService[k]);
        if (Number.isFinite(v) && v >= 0 && v <= 1) normalizedCommission[k] = v;
      });
      if (Object.keys(normalizedCommission).length) {
        settings.commissionByService = {
          ...(settings.commissionByService || {}),
          ...normalizedCommission,
        };
      }
    }
    if (fareRates && typeof fareRates === 'object') {
      const validVehicles = ['motorcycle', 'pragya', 'comfort'];
      const normalized = {};
      validVehicles.forEach((v) => {
        if (fareRates[v] && typeof fareRates[v] === 'object') {
          normalized[v] = {
            baseFare: Number(fareRates[v].baseFare) || 0,
            perKmRate: Number(fareRates[v].perKmRate) || 0,
            minimumFare: Number(fareRates[v].minimumFare) || 0,
          };
        }
      });
      if (Object.keys(normalized).length) settings.fareRates = normalized;
    }
    if (typeof foodServiceFeeRate === 'number' && foodServiceFeeRate >= 0 && foodServiceFeeRate <= 1) {
      settings.foodServiceFeeRate = foodServiceFeeRate;
    }
    if (typeof foodServiceFeeMin === 'number' && foodServiceFeeMin >= 0) {
      settings.foodServiceFeeMin = foodServiceFeeMin;
    }
    if (typeof foodServiceFeeMax === 'number' && foodServiceFeeMax >= 0) {
      settings.foodServiceFeeMax = foodServiceFeeMax;
    }
    if (settings.foodServiceFeeMax < settings.foodServiceFeeMin) {
      settings.foodServiceFeeMax = settings.foodServiceFeeMin;
    }
    if (typeof kitchenAlertSoundUrl === 'string') {
      const trimmed = kitchenAlertSoundUrl.trim();
      settings.kitchenAlertSoundUrl = trimmed || '/sounds/new-order.mp3';
    }
    if (typeof riderAlertSoundUrl === 'string') {
      const trimmed = riderAlertSoundUrl.trim();
      settings.riderAlertSoundUrl = trimmed || '/sounds/rider.mp3';
    }
    if (vehicleCapabilityPolicy && typeof vehicleCapabilityPolicy === 'object') {
      const prev = settings.vehicleCapabilityPolicy || {};
      settings.vehicleCapabilityPolicy = {
        ...prev,
        ...(typeof vehicleCapabilityPolicy.pragyaFoodEnabled === 'boolean'
          ? { pragyaFoodEnabled: vehicleCapabilityPolicy.pragyaFoodEnabled }
          : {}),
        ...(typeof vehicleCapabilityPolicy.comfortFoodEnabled === 'boolean'
          ? { comfortFoodEnabled: vehicleCapabilityPolicy.comfortFoodEnabled }
          : {}),
      };
    }
    if (serviceMaintenance && typeof serviceMaintenance === 'object') {
      const prev = settings.serviceMaintenance || {};
      const next = { ...prev };
      ['RIDE', 'DELIVERY', 'FOOD'].forEach((k) => {
        if (typeof serviceMaintenance[k] === 'boolean') next[k] = serviceMaintenance[k];
      });
      settings.serviceMaintenance = next;
    }
    if (dispatchRankingWeights && typeof dispatchRankingWeights === "object") {
      const allowed = [
        "fareWeight",
        "earningsPerKmWeight",
        "pickupPenaltyPerKm",
        "urgencyWeight",
        "foodReadyBoost",
        "maxPickupKm",
      ];
      const prev = settings.dispatchRankingWeights || {};
      const next = { ...prev };
      allowed.forEach((k) => {
        const v = Number(dispatchRankingWeights[k]);
        if (Number.isFinite(v)) next[k] = v;
      });
      settings.dispatchRankingWeights = next;
    }
    if (reliabilityPolicy && typeof reliabilityPolicy === "object") {
      const prev = settings.reliabilityPolicy || {};
      const next = { ...prev };
      ["strikesBeforePause", "pauseDurationHours", "strikeDecayOnCompletion", "riderCancelStrikeWeight"].forEach(
        (k) => {
          const v = Number(reliabilityPolicy[k]);
          if (Number.isFinite(v) && v >= 0) next[k] = v;
        }
      );
      settings.reliabilityPolicy = next;
    }
    if (pushNotificationTemplates !== undefined) {
      const normalized = normalizePushTemplateOverrides(pushNotificationTemplates);
      if (!normalized.ok) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: normalized.message });
      }
      settings.pushNotificationTemplates = {
        ...(settings.pushNotificationTemplates || {}),
        ...normalized.value,
      };
      invalidatePushTemplateCache();
    }
    if (Array.isArray(menuCategoryLayouts)) {
      settings.menuCategoryLayouts = menuCategoryLayouts
        .map((row) => ({
          name: String(row?.name || "").trim(),
          displayLayout: row?.displayLayout === "row" ? "row" : "column",
        }))
        .filter((row) => row.name);
    }
    if (Array.isArray(foodPromoBanners)) {
      const verticals = new Set(["FOOD", "GROCERY", "PHARMACY", "ALL"]);
      settings.foodPromoBanners = foodPromoBanners
        .map((row, i) => ({
          imageUrl: String(row?.imageUrl || "").trim(),
          vertical: verticals.has(String(row?.vertical || "").toUpperCase())
            ? String(row.vertical).toUpperCase()
            : "ALL",
          enabled: row?.enabled !== false,
          sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : i,
        }))
        .filter((row) => row.imageUrl)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    await settings.save();
    res.status(StatusCodes.OK).json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to update settings' });
  }
};

/** GET /admin/push-templates — catalog + current title/body/enabled */
export const getPushTemplatesAdmin = async (_req, res) => {
  try {
    const templates = await getPushTemplatesList();
    res.status(StatusCodes.OK).json({
      catalog: catalogForAdminResponse(),
      templates,
      firebaseConfigured: isFirebaseConfigured(),
    });
  } catch (error) {
    console.error("Get push templates error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to fetch push templates" });
  }
};

/** PATCH /admin/push-templates — update templates only */
export const updatePushTemplatesAdmin = async (req, res) => {
  try {
    const normalized = normalizePushTemplateOverrides(req.body?.templates ?? req.body);
    if (!normalized.ok) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: normalized.message });
    }

    let settings = await Settings.findOne({ key: "global" });
    if (!settings) {
      settings = await Settings.create({ key: "global" });
    }

    settings.pushNotificationTemplates = {
      ...(settings.pushNotificationTemplates || {}),
      ...normalized.value,
    };
    await settings.save();
    invalidatePushTemplateCache();

    const templates = mergePushTemplates(settings.pushNotificationTemplates);
    res.status(StatusCodes.OK).json({
      message: "Push templates updated",
      templates,
    });
  } catch (error) {
    console.error("Update push templates error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to update push templates" });
  }
};

/** POST /admin/push-templates/preview — render title/body with sample variables */
export const previewPushTemplateAdmin = async (req, res) => {
  try {
    const { key, title, body, variables } = req.body;
    if (!key || typeof key !== "string") {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "key is required" });
    }

    const vars =
      variables && typeof variables === "object" && !Array.isArray(variables)
        ? variables
        : {};

    if (typeof title === "string" && typeof body === "string") {
      return res.status(StatusCodes.OK).json({
        title: renderPushTemplateString(title, vars),
        body: renderPushTemplateString(body, vars),
      });
    }

    const payload = await buildPushFromTemplate(key, vars, { type: "preview" });
    if (!payload) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Template not found or disabled",
      });
    }
    res.status(StatusCodes.OK).json({
      title: payload.title,
      body: payload.body,
    });
  } catch (error) {
    console.error("Preview push template error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to preview template" });
  }
};

/** GET /admin/push-broadcast — audience reach + recent broadcasts */
export const getPushBroadcastAdmin = async (_req, res) => {
  try {
    const [audiences, recent] = await Promise.all([
      getBroadcastAudienceStats(),
      PushBroadcast.find()
        .sort({ createdAt: -1 })
        .limit(25)
        .populate("sentBy", "name username")
        .lean(),
    ]);

    res.status(StatusCodes.OK).json({
      firebaseConfigured: isFirebaseConfigured(),
      audiences,
      recent: recent.map((row) => ({
        _id: row._id,
        title: row.title,
        body: row.body,
        audience: row.audience,
        audienceLabel: BROADCAST_AUDIENCES[row.audience]?.label || row.audience,
        deepLink: row.deepLink,
        usersTargeted: row.usersTargeted,
        devicesTargeted: row.devicesTargeted,
        sentOk: row.sentOk,
        sentFailed: row.sentFailed,
        status: row.status,
        sentByName: row.sentBy?.name || row.sentBy?.username || "Admin",
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get push broadcast error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to load broadcast data" });
  }
};

/** POST /admin/push-broadcast — send message to all devices in audience */
export const sendPushBroadcastAdmin = async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const body = String(req.body?.body || "").trim();
    const audience = String(req.body?.audience || "app_users");
    const deepLink = req.body?.deepLink ? String(req.body.deepLink).trim() : null;

    if (!title) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Title is required" });
    }
    if (!body) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Message is required" });
    }
    if (title.length > 120) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Title must be 120 characters or less" });
    }
    if (body.length > 500) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Message must be 500 characters or less" });
    }
    if (!BROADCAST_AUDIENCE_IDS.includes(audience)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Invalid audience" });
    }
    if (!isFirebaseConfigured()) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Firebase is not configured on the server — pushes cannot be sent",
      });
    }

    const record = await PushBroadcast.create({
      title,
      body,
      audience,
      deepLink,
      sentBy: req.user.id,
      status: "sending",
    });

    try {
      const stats = await sendBroadcastPush({
        title,
        body,
        audience,
        deepLink,
        sentBy: req.user.id,
        broadcastId: record._id,
      });

      res.status(StatusCodes.OK).json({
        message: "Broadcast sent",
        broadcast: {
          _id: record._id,
          ...stats,
          audience,
          audienceLabel: BROADCAST_AUDIENCES[audience]?.label,
        },
      });
    } catch (sendErr) {
      await PushBroadcast.findByIdAndUpdate(record._id, {
        status: "failed",
        errorMessage: sendErr?.message || "Send failed",
      });
      throw sendErr;
    }
  } catch (error) {
    console.error("Send push broadcast error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error?.message || "Failed to send broadcast",
    });
  }
};

const saveUploadedAlertSound = async (req, res, field, defaultFilename) => {
  if (!req.file) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Audio file is required' });
  }
  let settings = await Settings.findOne({ key: 'global' });
  if (!settings) {
    settings = await Settings.create({ key: 'global' });
  }
  const pathUrl = `/sounds/${req.file.filename}`;
  settings[field] = pathUrl;
  await settings.save();
  res.status(StatusCodes.OK).json({
    message: 'Alert sound saved',
    [field]: pathUrl,
  });
};

/** POST /admin/settings/kitchen-alert-sound */
export const uploadKitchenAlertSound = async (req, res) => {
  try {
    await saveUploadedAlertSound(req, res, 'kitchenAlertSoundUrl', 'new-order.mp3');
  } catch (error) {
    console.error('Upload kitchen alert sound error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to upload sound' });
  }
};

/** POST /admin/settings/rider-alert-sound */
export const uploadRiderAlertSound = async (req, res) => {
  try {
    await saveUploadedAlertSound(req, res, 'riderAlertSoundUrl', 'rider.mp3');
  } catch (error) {
    console.error('Upload rider alert sound error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to upload sound' });
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

/** POST /admin/drivers/:id/credit - Manual adjustment (credit driver balance) */
export const creditDriverBalance = async (req, res) => {
  try {
    const { id: driverId } = req.params;
    const { amount, note } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: 'Positive amount is required' });
    }
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'rider') {
      return res.status(404).json({ message: 'Driver not found' });
    }
    const balance = Number(driver.balance ?? 0) + amount;
    await User.findByIdAndUpdate(driverId, { balance });
    await Transaction.create({
      driver: driverId,
      amount,
      type: 'MANUAL_CREDIT',
      note: note || 'Admin credit',
      balanceAfter: balance
    });
    const updated = await User.findById(driverId).select('name phone balance');
    res.status(StatusCodes.OK).json({ message: 'Balance credited', driver: updated });
  } catch (error) {
    console.error('Credit driver error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to credit driver' });
  }
};

/** GET /admin/trips/:id - Get single trip with full details for dispute/detail view */
export const getTripById = async (req, res) => {
  try {
    const { id } = req.params;
    const trip = await Ride.findById(id)
      .populate('customer', 'name phone email')
      .populate('rider', 'name phone email driverDetails');
    if (!trip) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Trip not found' });
    }
    res.status(StatusCodes.OK).json({ trip });
  } catch (error) {
    console.error('Get trip by id error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch trip' });
  }
};

/** GET /admin/reports/rides-by-day - Rides per day for last N days (default 14) */
export const getRidesReport = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const report = await Ride.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          totalFare: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$fare', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(StatusCodes.OK).json({ report, days });
  } catch (error) {
    console.error('Rides report error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch report' });
  }
};

/** GET /admin/trips/active - Active (ongoing) trips for live map */
export const getActiveTrips = async (req, res) => {
  try {
    const activeStatuses = ['SEARCHING_FOR_RIDER', 'START', 'ARRIVED', 'IN_PROGRESS'];
    const trips = await Ride.find({ status: { $in: activeStatuses } })
      .populate('customer', 'name phone')
      .populate('rider', 'name phone currentLocation')
      .select('pickup drop status rider customer createdAt')
      .lean();

    const formatted = trips.map((t) => ({
      _id: t._id,
      status: t.status,
      pickup: t.pickup,
      drop: t.drop,
      customer: t.customer,
      rider: t.rider,
      createdAt: t.createdAt,
      riderLocation: t.rider?.currentLocation?.coordinates
        ? { lat: t.rider.currentLocation.coordinates[1], lng: t.rider.currentLocation.coordinates[0] }
        : null,
    }));

    res.status(StatusCodes.OK).json({ trips: formatted });
  } catch (error) {
    console.error('Get active trips error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to fetch active trips' });
  }
};

/** POST /admin/rides/:rideId/assign - Manual dispatch: assign a ride to a specific driver */
export const assignRideToDriver = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { driverId } = req.body;
    if (!driverId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'driverId is required' });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Ride not found' });
    }
    if (ride.status !== 'SEARCHING_FOR_RIDER') {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Ride is not pending assignment' });
    }

    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'rider') {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Driver not found' });
    }
    const driverStatus = driver.driverDetails?.status;
    if (driverStatus !== 'active') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Driver must have status Active to receive rides',
      });
    }

    const settings = await getSettings();
    if (!canRiderReceiveOffer(driver, ride, settings)) {
      const reason = getEligibilityRejectReason(driver, ride, settings);
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: reason || 'Driver cannot accept this service type with their vehicle',
      });
    }

    ride.rider = driverId;
    ride.status = 'START';
    ride.otp = ride.otp || generateOTP();
    await ride.save();

    const io = req.app.get('io');
    if (io) {
      const rideWithCustomer = await Ride.findById(rideId).populate('customer', 'name phone averageRating totalRatings');
      io.to(`rider_${driverId}`).emit('rideOffer', rideWithCustomer);
      const rideData = await Ride.findById(rideId).populate('customer rider');
      io.to(`ride_${rideId}`).emit('rideData', rideData);
    }

    res.status(StatusCodes.OK).json({ message: 'Ride assigned', ride: await Ride.findById(rideId).populate('customer rider') });
  } catch (error) {
    console.error('Assign ride error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to assign ride' });
  }
};

/** POST /admin/payouts/run - Execute weekly payouts: send balance to drivers via Hubtel (MoMo). */
export const runWeeklyPayouts = async (req, res) => {
  try {
    const { sendPayment } = await import('../utils/hubtelService.js');
    const baseUrl = process.env.BASE_URL || process.env.API_BASE_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl.replace(/\/$/, '')}/webhooks/hubtel-payout`;

    const drivers = await User.find({ role: 'rider', balance: { $gt: 0 } }).select('name phone balance');
    const results = { processed: 0, failed: 0, errors: [] };

    for (const driver of drivers) {
      const amount = Number(driver.balance);
      if (amount <= 0 || !driver.phone) continue;

      const clientReference = `payout_${driver._id}_${Date.now()}`;
      const result = await sendPayment({
        RecipientName: driver.name || 'Driver',
        RecipientMsisdn: driver.phone,
        Amount: amount,
        PrimaryCallbackUrl: callbackUrl,
        Description: 'QareGO Weekly Payout',
        ClientReference: clientReference,
      });

      if (result.success) {
        await User.findByIdAndUpdate(driver._id, { balance: 0 });
        const Transaction = (await import('../models/Transaction.js')).default;
        await Transaction.create({
          driver: driver._id,
          amount: -amount,
          type: 'PAYOUT',
          note: 'Weekly payout (Hubtel)',
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
