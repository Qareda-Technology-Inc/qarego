// Admin settings: global settings and alert-sound uploads.
import Settings from "../../models/Settings.js";
import { StatusCodes } from "http-status-codes";
import { getSettings } from "../../utils/tripSettlement.js";
import { normalizePushTemplateOverrides, invalidatePushTemplateCache } from "../../utils/pushNotificationTemplates.js";
import { getGasConfig, normalizeGasConfigInput } from "../../utils/gasOrders.js";

// Always send gas settings with defaults filled in, so the admin form has something to edit.
const withGas = (settings) => ({ ...settings.toObject(), gas: getGasConfig(settings) });

/** GET /admin/settings - Get global settings (commission, debt limit) */
export const getSettingsAdmin = async (req, res) => {
  try {
    const settings = await getSettings();
    res.status(StatusCodes.OK).json(withGas(settings));
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
      minCashoutAmount,
      fareRates,
      kitchenAlertSoundUrl,
      riderAlertSoundUrl,
      foodServiceFeeRate,
      foodServiceFeeMin,
      foodServiceFeeMax,
      foodDeliveryCommissionRate,
      storeFreePeriodDays,
      storeDebtLimit,
      lateCancelFee,
      lateCancelLimit,
      lateCancelWindowDays,
      lateCancelBlockDays,
      commissionByService,
      vehicleCapabilityPolicy,
      serviceMaintenance,
      dispatchRankingWeights,
      reliabilityPolicy,
      pushNotificationTemplates,
      menuCategoryLayouts,
      foodPromoBanners,
      gas,
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
    if (typeof minCashoutAmount === 'number' && minCashoutAmount >= 0) {
      settings.minCashoutAmount = minCashoutAmount;
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
    if (typeof lateCancelFee === 'number' && Number.isFinite(lateCancelFee) && lateCancelFee >= 0) {
      settings.lateCancelFee = Math.round(lateCancelFee * 100) / 100;
    }
    if (Number.isInteger(lateCancelLimit) && lateCancelLimit >= 0) settings.lateCancelLimit = lateCancelLimit;
    if (Number.isInteger(lateCancelWindowDays) && lateCancelWindowDays >= 1) settings.lateCancelWindowDays = lateCancelWindowDays;
    if (Number.isInteger(lateCancelBlockDays) && lateCancelBlockDays >= 1) settings.lateCancelBlockDays = lateCancelBlockDays;
    if (typeof storeDebtLimit === 'number' && Number.isFinite(storeDebtLimit) && storeDebtLimit >= 0) {
      settings.storeDebtLimit = Math.round(storeDebtLimit * 100) / 100;
    }
    if (Number.isInteger(storeFreePeriodDays) && storeFreePeriodDays >= 0 && storeFreePeriodDays <= 365) {
      settings.storeFreePeriodDays = storeFreePeriodDays;
    }
    if (typeof foodDeliveryCommissionRate === 'number' && foodDeliveryCommissionRate >= 0 && foodDeliveryCommissionRate <= 1) {
      settings.foodDeliveryCommissionRate = foodDeliveryCommissionRate;
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
      const verticals = new Set(["FOOD", "GROCERY", "PHARMACY", "LAUNDRY", "ALL"]);
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
    if (gas !== undefined) {
      try {
        settings.gas = normalizeGasConfigInput(gas);
      } catch (err) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
      }
    }
    await settings.save();
    res.status(StatusCodes.OK).json(withGas(settings));
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Failed to update settings' });
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
