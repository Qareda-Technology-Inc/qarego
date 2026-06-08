import User from "../models/User.js";
import { StatusCodes } from "http-status-codes";
import { getSettings } from "../utils/tripSettlement.js";
import {
  normalizeVehicleCategory,
  getVehicleSupportedServices,
} from "../utils/riderServiceEligibility.js";
import {
  buildServicePreferencesPayload,
  applyPresetToPreferences,
  normalizeServicePreferencesInput,
  detectPresetFromPreferences,
  PRESET_IDS,
  SERVICE_PRESETS,
} from "../utils/riderServicePreferences.js";
import { getDispatchWeights } from "../utils/offerRanking.js";
import {
  buildRiderReliabilityPayload,
  recordReliabilityEvent,
  clearExpiredPauses,
} from "../utils/riderReliability.js";
import {
  buildPlatformDispatchAnalytics,
  buildDriverAnalyticsSnippet,
  parseAnalyticsDays,
} from "../utils/dispatchAnalytics.js";

const VEHICLE_ROWS = ["motorcycle", "pragya", "comfort"];

function buildVehicleCapabilityMatrix(settings) {
  return VEHICLE_ROWS.map((vehicle) => ({
    vehicle,
    supportedServices: getVehicleSupportedServices(vehicle, settings),
  }));
}

function formatModeLabel(effective) {
  if (!effective) return "—";
  const parts = [];
  if (effective.RIDE) parts.push("Rides");
  if (effective.DELIVERY) parts.push("Parcels");
  if (effective.FOOD) parts.push("Food");
  return parts.length ? parts.join(", ") : "None active";
}

/** GET /admin/dispatch/overview */
export const getDispatchOverview = async (req, res) => {
  try {
    const settings = await getSettings();
    const now = new Date();
    const [onlineActive, totalActive, totalRiders, ridersWithServicePause] = await Promise.all([
      User.countDocuments({
        role: "rider",
        isOnline: true,
        "driverDetails.status": "active",
      }),
      User.countDocuments({ role: "rider", "driverDetails.status": "active" }),
      User.countDocuments({ role: "rider" }),
      User.countDocuments({
        role: "rider",
        $or: [
          { "driverDetails.reliability.RIDE.pausedUntil": { $gt: now } },
          { "driverDetails.reliability.DELIVERY.pausedUntil": { $gt: now } },
          { "driverDetails.reliability.FOOD.pausedUntil": { $gt: now } },
        ],
      }),
    ]);

    const maintenance = settings.serviceMaintenance || {};
    const pausedServices = ["RIDE", "DELIVERY", "FOOD"].filter((k) => maintenance[k]);

    res.status(StatusCodes.OK).json({
      serviceMaintenance: maintenance,
      vehicleCapabilityPolicy: settings.vehicleCapabilityPolicy || {},
      commissionByService: settings.commissionByService || null,
      commissionRate: settings.commissionRate,
      dispatchRankingWeights: settings.dispatchRankingWeights || getDispatchWeights(settings),
      vehicleCapabilityMatrix: buildVehicleCapabilityMatrix(settings),
      riders: {
        total: totalRiders,
        active: totalActive,
        onlineOnDuty: onlineActive,
        withServicePause: ridersWithServicePause,
      },
      reliabilityPolicy: settings.reliabilityPolicy || {},
      pausedServices,
      presets: Object.keys(SERVICE_PRESETS).map((id) => ({
        id,
        label: id.replace(/_/g, " "),
      })),
    });
  } catch (error) {
    console.error("Dispatch overview error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to load dispatch overview" });
  }
};

/** GET /admin/dispatch/analytics — platform offer acceptance & trip volume */
export const getDispatchAnalytics = async (req, res) => {
  try {
    const days = parseAnalyticsDays(req.query.days, 14);
    const settings = await getSettings();
    const payload = await buildPlatformDispatchAnalytics(settings, days);
    res.status(StatusCodes.OK).json(payload);
  } catch (error) {
    console.error("Dispatch analytics error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to load dispatch analytics" });
  }
};

/** GET /admin/dispatch/drivers — directory with work mode + online */
export const getDispatchDrivers = async (req, res) => {
  try {
    const settings = await getSettings();
    const { status, category, online } = req.query;
    const query = { role: "rider" };
    if (status) query["driverDetails.status"] = status;
    if (category) query["driverDetails.vehicle.category"] = category;
    if (online === "true") query.isOnline = true;

    const drivers = await User.find(query)
      .select(
        "name phone email driverDetails isOnline balance averageRating totalRatings createdAt"
      )
      .sort({ isOnline: -1, name: 1 })
      .lean();

    const list = drivers.map((d) => {
      const vehicle = normalizeVehicleCategory(d.driverDetails?.vehicle?.category);
      const supported = getVehicleSupportedServices(vehicle, settings);
      const meta = buildServicePreferencesPayload(d, {
        vehicleCategory: vehicle,
        vehicleSupportedServices: supported,
      });
      const analytics = buildDriverAnalyticsSnippet(d, settings);
      return {
        _id: d._id,
        name: d.name,
        phone: d.phone,
        email: d.email,
        isOnline: !!d.isOnline,
        balance: d.balance,
        averageRating: d.averageRating,
        totalRatings: d.totalRatings,
        status: d.driverDetails?.status || "pending",
        vehicleCategory: vehicle,
        vehicleLabel: `${d.driverDetails?.vehicle?.make || ""} ${d.driverDetails?.vehicle?.model || ""}`.trim(),
        servicePreset: meta.servicePreset,
        effectiveMode: formatModeLabel(meta.effectivePreferences),
        effectivePreferences: meta.effectivePreferences,
        vehicleSupportedServices: supported,
        acceptanceRate: analytics.totals.acceptanceRate,
        offersSeen: analytics.totals.offersSeen,
      };
    });

    res.status(StatusCodes.OK).json({ drivers: list });
  } catch (error) {
    console.error("Dispatch drivers error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to load drivers" });
  }
};

/** GET /admin/dispatch/drivers/:id */
export const getDriverDispatchProfile = async (req, res) => {
  try {
    const driver = await User.findOne({ _id: req.params.id, role: "rider" }).select(
      "name phone driverDetails isOnline"
    );
    if (!driver) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Driver not found" });
    }
    const settings = await getSettings();
    const vehicle = normalizeVehicleCategory(driver.driverDetails?.vehicle?.category);
    const supported = getVehicleSupportedServices(vehicle, settings);
    await clearExpiredPauses(driver._id);
    const driverFresh = await User.findById(driver._id).select("driverDetails role");

    res.status(StatusCodes.OK).json({
      driver: {
        _id: driver._id,
        name: driver.name,
        phone: driver.phone,
        isOnline: driver.isOnline,
        status: driver.driverDetails?.status,
      },
      ...buildServicePreferencesPayload(driverFresh, {
        vehicleCategory: vehicle,
        vehicleSupportedServices: supported,
      }),
      reliability: buildRiderReliabilityPayload(driverFresh, settings),
      analytics: buildDriverAnalyticsSnippet(driverFresh, settings),
    });
  } catch (error) {
    console.error("Driver dispatch profile error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to load driver dispatch profile" });
  }
};

/** PATCH /admin/dispatch/drivers/:id/service-preferences */
/** PATCH /admin/dispatch/drivers/:id/reliability — reset strikes or admin-pause service */
export const adminUpdateDriverReliability = async (req, res) => {
  try {
    const { action, serviceType } = req.body || {};
    const driver = await User.findOne({ _id: req.params.id, role: "rider" });
    if (!driver) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Driver not found" });
    }
    const settings = await getSettings();
    if (action === "reset" && serviceType) {
      await recordReliabilityEvent(driver._id, serviceType, "ADMIN_RESET", settings);
    } else if (action === "pause" && serviceType) {
      await recordReliabilityEvent(driver._id, serviceType, "ADMIN_PAUSE", settings);
    } else if (action === "reset_all") {
      for (const st of ["RIDE", "DELIVERY", "FOOD"]) {
        await recordReliabilityEvent(driver._id, st, "ADMIN_RESET", settings);
      }
    } else {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "action must be reset, pause, or reset_all with serviceType where required",
      });
    }
    const fresh = await User.findById(driver._id).select("driverDetails role");
    res.status(StatusCodes.OK).json({
      message: "Reliability updated",
      reliability: buildRiderReliabilityPayload(fresh, settings),
    });
  } catch (error) {
    console.error("Admin update driver reliability error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to update reliability" });
  }
};

export const adminUpdateDriverServicePreferences = async (req, res) => {
  try {
    const { preset, servicePreferences: prefsBody } = req.body || {};
    const driver = await User.findOne({ _id: req.params.id, role: "rider" });
    if (!driver) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Driver not found" });
    }
    if (!driver.driverDetails) driver.driverDetails = {};

    const existing =
      driver.driverDetails.servicePreferences?.toObject?.() ||
      driver.driverDetails.servicePreferences ||
      {};

    let nextPrefs = null;
    if (preset && PRESET_IDS.includes(preset)) {
      nextPrefs = applyPresetToPreferences(preset, existing);
      driver.driverDetails.servicePreset = preset;
    }
    const normalized = normalizeServicePreferencesInput(prefsBody);
    if (normalized) {
      nextPrefs = nextPrefs || { ...existing };
      for (const key of Object.keys(normalized)) {
        nextPrefs[key] = { ...(nextPrefs[key] || {}), ...normalized[key] };
      }
      if (!preset) {
        driver.driverDetails.servicePreset = detectPresetFromPreferences(nextPrefs);
      }
    }
    if (!nextPrefs) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Provide preset or servicePreferences",
      });
    }

    driver.driverDetails.servicePreferences = nextPrefs;
    driver.markModified("driverDetails");
    await driver.save();

    const settings = await getSettings();
    const vehicle = normalizeVehicleCategory(driver.driverDetails?.vehicle?.category);
    const supported = getVehicleSupportedServices(vehicle, settings);

    res.status(StatusCodes.OK).json({
      message: "Driver work mode updated",
      ...buildServicePreferencesPayload(driver, {
        vehicleCategory: vehicle,
        vehicleSupportedServices: supported,
      }),
    });
  } catch (error) {
    console.error("Admin update driver service prefs error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to update work mode" });
  }
};
