import Ride from "../models/Ride.js";
import User from "../models/User.js";
import { getRideEligibilityServiceType } from "./riderServiceEligibility.js";
import { getRiderReliabilityRecord } from "./riderReliability.js";
import { getCommissionRateForService } from "./tripSettlement.js";
import { computeNetEarning } from "./offerRanking.js";

export const SERVICE_TYPES = ["RIDE", "DELIVERY", "FOOD"];

export const SERVICE_LABELS = {
  RIDE: "Rides",
  DELIVERY: "Parcels",
  FOOD: "Food",
};

export function parseAnalyticsDays(queryDays, defaultDays = 14, maxDays = 90) {
  const n = parseInt(queryDays, 10);
  if (!Number.isFinite(n) || n < 1) return defaultDays;
  return Math.min(maxDays, n);
}

export function analyticsPeriodStart(days) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function computeAcceptanceRate(offersAccepted, offersDeclined) {
  const seen = (Number(offersAccepted) || 0) + (Number(offersDeclined) || 0);
  if (seen <= 0) return null;
  return Math.round(((Number(offersAccepted) || 0) / seen) * 1000) / 10;
}

/** Lifetime offer response stats from driverDetails.reliability */
export function reliabilityStatsToServiceMetrics(reliabilityRecord = {}) {
  return SERVICE_TYPES.map((serviceType) => {
    const s = reliabilityRecord[serviceType] || {};
    const offersAccepted = Number(s.offersAccepted) || 0;
    const offersDeclined = Number(s.offersDeclined) || 0;
    const completed = Number(s.completed) || 0;
    const strikes = Number(s.strikes) || 0;
    return {
      serviceType,
      label: SERVICE_LABELS[serviceType],
      offersAccepted,
      offersDeclined,
      offersSeen: offersAccepted + offersDeclined,
      acceptanceRate: computeAcceptanceRate(offersAccepted, offersDeclined),
      completed,
      strikes,
      isPaused: !!s.isPaused,
    };
  });
}

export function summarizeServiceMetrics(services) {
  const totals = services.reduce(
    (acc, s) => {
      acc.offersAccepted += s.offersAccepted;
      acc.offersDeclined += s.offersDeclined;
      acc.completed += s.completed;
      acc.strikes += s.strikes;
      return acc;
    },
    { offersAccepted: 0, offersDeclined: 0, completed: 0, strikes: 0 }
  );
  return {
    ...totals,
    offersSeen: totals.offersAccepted + totals.offersDeclined,
    acceptanceRate: computeAcceptanceRate(totals.offersAccepted, totals.offersDeclined),
  };
}

/** Completed trips for a rider in [start, now), grouped by serviceType */
export async function aggregateRiderTripsInPeriod(riderId, start) {
  const rows = await Ride.aggregate([
    {
      $match: {
        rider: riderId,
        status: "COMPLETED",
        createdAt: { $gte: start },
      },
    },
    {
      $group: {
        _id: { $ifNull: ["$serviceType", "RIDE"] },
        trips: { $sum: 1 },
        grossFare: { $sum: "$fare" },
      },
    },
  ]);

  const byService = {};
  for (const key of SERVICE_TYPES) {
    byService[key] = { trips: 0, grossFare: 0, netEarning: 0 };
  }
  let totalTrips = 0;
  let totalGross = 0;
  let totalNet = 0;

  for (const row of rows) {
    const key = SERVICE_TYPES.includes(row._id) ? row._id : "RIDE";
    const gross = Math.round((row.grossFare || 0) * 100) / 100;
    byService[key].trips = row.trips;
    byService[key].grossFare = gross;
    totalTrips += row.trips;
    totalGross += gross;
  }

  return { byService, totalTrips, totalGross, totalNet };
}

export function applyNetEarningsToTripStats(byService, settings) {
  let totalNet = 0;
  const services = SERVICE_TYPES.map((serviceType) => {
    const row = byService[serviceType] || { trips: 0, grossFare: 0 };
    const rate = getCommissionRateForService(settings, serviceType);
    const netEarning = Math.round(computeNetEarning(row.grossFare, rate) * 100) / 100;
    totalNet += netEarning;
    return {
      serviceType,
      label: SERVICE_LABELS[serviceType],
      trips: row.trips,
      grossFare: row.grossFare,
      netEarning,
      commissionRate: rate,
    };
  });
  return { services, totalNet: Math.round(totalNet * 100) / 100 };
}

/** Platform trip volume by service in period */
export async function aggregatePlatformTripsInPeriod(start) {
  const [byServiceRows, dailyRows, statusRows] = await Promise.all([
    Ride.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $ifNull: ["$serviceType", "RIDE"] },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
          searching: {
            $sum: { $cond: [{ $eq: ["$status", "SEARCHING_FOR_RIDER"] }, 1, 0] },
          },
          grossCompleted: {
            $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$fare", 0] },
          },
        },
      },
    ]),
    Ride.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            serviceType: { $ifNull: ["$serviceType", "RIDE"] },
          },
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]),
    Ride.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const tripsByService = SERVICE_TYPES.map((serviceType) => {
    const row = byServiceRows.find((r) => r._id === serviceType) || {};
    return {
      serviceType,
      label: SERVICE_LABELS[serviceType],
      total: row.total || 0,
      completed: row.completed || 0,
      searching: row.searching || 0,
      grossCompleted: Math.round((row.grossCompleted || 0) * 100) / 100,
      completionRate:
        row.total > 0
          ? Math.round(((row.completed || 0) / row.total) * 1000) / 10
          : null,
    };
  });

  const dailyMap = {};
  for (const row of dailyRows) {
    const day = row._id.day;
    const st = SERVICE_TYPES.includes(row._id.serviceType)
      ? row._id.serviceType
      : "RIDE";
    if (!dailyMap[day]) {
      dailyMap[day] = { date: day, total: 0, completed: 0, byService: {} };
    }
    dailyMap[day].total += row.count;
    dailyMap[day].completed += row.completed;
    dailyMap[day].byService[st] = {
      total: row.count,
      completed: row.completed,
    };
  }

  const statusBreakdown = {};
  for (const row of statusRows) {
    statusBreakdown[row._id] = row.count;
  }

  const tripTotals = tripsByService.reduce(
    (acc, s) => {
      acc.total += s.total;
      acc.completed += s.completed;
      return acc;
    },
    { total: 0, completed: 0 }
  );

  return {
    tripsByService,
    tripTotals: {
      ...tripTotals,
      completionRate:
        tripTotals.total > 0
          ? Math.round((tripTotals.completed / tripTotals.total) * 1000) / 10
          : null,
    },
    daily: Object.values(dailyMap),
    statusBreakdown,
  };
}

/** Sum reliability counters across active riders */
export async function aggregatePlatformReliabilityStats() {
  const riders = await User.find({
    role: "rider",
    "driverDetails.status": "active",
  })
    .select("driverDetails.reliability name")
    .lean();

  const byService = {};
  for (const key of SERVICE_TYPES) {
    byService[key] = {
      serviceType: key,
      label: SERVICE_LABELS[key],
      offersAccepted: 0,
      offersDeclined: 0,
      completed: 0,
      strikes: 0,
      ridersPaused: 0,
    };
  }

  const riderLeaderboard = [];

  for (const rider of riders) {
    const rec = getRiderReliabilityRecord(rider);
    let riderAccepted = 0;
    let riderDeclined = 0;
    let riderCompleted = 0;

    for (const key of SERVICE_TYPES) {
      const s = rec[key];
      byService[key].offersAccepted += s.offersAccepted || 0;
      byService[key].offersDeclined += s.offersDeclined || 0;
      byService[key].completed += s.completed || 0;
      byService[key].strikes += s.strikes || 0;
      if (s.isPaused) byService[key].ridersPaused += 1;
      riderAccepted += s.offersAccepted || 0;
      riderDeclined += s.offersDeclined || 0;
      riderCompleted += s.completed || 0;
    }

    const offersSeen = riderAccepted + riderDeclined;
    if (riderCompleted > 0 || offersSeen > 0) {
      riderLeaderboard.push({
        riderId: rider._id,
        name: rider.name,
        completed: riderCompleted,
        offersAccepted: riderAccepted,
        offersDeclined: riderDeclined,
        offersSeen,
        acceptanceRate: computeAcceptanceRate(riderAccepted, riderDeclined),
      });
    }
  }

  const offerResponseByService = SERVICE_TYPES.map((key) => {
    const s = byService[key];
    return {
      ...s,
      offersSeen: s.offersAccepted + s.offersDeclined,
      acceptanceRate: computeAcceptanceRate(s.offersAccepted, s.offersDeclined),
    };
  });

  riderLeaderboard.sort((a, b) => b.completed - a.completed);

  return {
    activeRiders: riders.length,
    offerResponseByService,
    offerResponseTotals: summarizeServiceMetrics(offerResponseByService),
    topRidersByCompletions: riderLeaderboard.slice(0, 10),
    lowAcceptanceRiders: riderLeaderboard
      .filter((r) => r.offersSeen >= 5 && r.acceptanceRate != null && r.acceptanceRate < 50)
      .sort((a, b) => (a.acceptanceRate ?? 0) - (b.acceptanceRate ?? 0))
      .slice(0, 8),
  };
}

export async function buildRiderDispatchAnalytics(user, settings, days) {
  const start = analyticsPeriodStart(days);
  const reliabilityRecord = getRiderReliabilityRecord(user);
  const lifetime = reliabilityStatsToServiceMetrics(reliabilityRecord);
  const tripAgg = await aggregateRiderTripsInPeriod(user._id, start);
  const { services: periodTrips, totalNet } = applyNetEarningsToTripStats(
    tripAgg.byService,
    settings
  );

  const lifetimeTotals = summarizeServiceMetrics(lifetime);

  const periodByService = periodTrips.map((p) => {
    const life = lifetime.find((l) => l.serviceType === p.serviceType);
    return { ...p, lifetimeAcceptanceRate: life?.acceptanceRate ?? null };
  });

  return {
    days,
    periodStart: start.toISOString(),
    lifetime: {
      services: lifetime,
      totals: lifetimeTotals,
    },
    period: {
      services: periodByService,
      totals: {
        trips: tripAgg.totalTrips,
        grossFare: Math.round(tripAgg.totalGross * 100) / 100,
        netEarning: totalNet,
      },
    },
  };
}

export async function buildPlatformDispatchAnalytics(settings, days) {
  const start = analyticsPeriodStart(days);
  const [trips, reliability] = await Promise.all([
    aggregatePlatformTripsInPeriod(start),
    aggregatePlatformReliabilityStats(),
  ]);

  return {
    days,
    periodStart: start.toISOString(),
    trips,
    reliability,
  };
}

/** Enrich single driver profile with analytics snippet */
export function buildDriverAnalyticsSnippet(user, settings) {
  const reliabilityRecord = getRiderReliabilityRecord(user);
  const services = reliabilityStatsToServiceMetrics(reliabilityRecord);
  return {
    services,
    totals: summarizeServiceMetrics(services),
  };
}
