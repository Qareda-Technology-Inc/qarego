// Cooking gas (LPG): owner-set cylinder prices, nearest-station selection and quotes.
// Gas orders are FoodOrders on a GAS-vertical store (a partner filling station), so the
// merchant portal, tracking, cash split, cancellation and settlement are shared with food.
import Restaurant from "../models/Restaurant.js";
import { calculateDistance } from "./mapUtils.js";
import { storeOpenState } from "./storeDebt.js";
import { getSettings } from "./tripSettlement.js";
import { computeFoodServiceFee } from "./foodServiceFee.js";
import { MAX_FOOD_DELIVERY_KM, MIN_FOOD_DELIVERY_KM } from "./deliveryFare.js";

export const GAS_MODES = ["REFILL", "EXCHANGE"];
export const MAX_GAS_CYLINDERS = 3;

// Placeholders until the owner sets real prices in admin settings.
const DEFAULT_CYLINDERS = [
  { sizeKg: 3, label: "3 kg", refillPrice: 51, exchangePrice: 61, active: true },
  { sizeKg: 6, label: "6 kg", refillPrice: 102, exchangePrice: 115, active: true },
  { sizeKg: 12.5, label: "12.5 kg", refillPrice: 212.5, exchangePrice: 230, active: true },
  { sizeKg: 14.5, label: "14.5 kg", refillPrice: 246.5, exchangePrice: 265, active: true },
];

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Courier fee for the round trip; separate from ride/food rates so gas can be priced on its own.
const DEFAULT_DELIVERY = { baseFare: 10, perKmRate: 3, minimumFare: 15 };

function normalizeDelivery(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const num = (v, fallback) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? round2(v) : fallback);
  return {
    baseFare: num(d.baseFare, DEFAULT_DELIVERY.baseFare),
    perKmRate: num(d.perKmRate, DEFAULT_DELIVERY.perKmRate),
    minimumFare: num(d.minimumFare, DEFAULT_DELIVERY.minimumFare),
  };
}

/** Round-trip courier fee: base + km × rate (km already covers both directions), at least the minimum. */
export function computeGasDeliveryFee(roundTripKm, delivery) {
  const d = normalizeDelivery(delivery);
  return round2(Math.max(d.minimumFare, d.baseFare + Number(roundTripKm) * d.perKmRate));
}

/** Normalised gas config from settings, with safe defaults. */
export function getGasConfig(settings) {
  const raw = settings?.gas && typeof settings.gas === "object" ? settings.gas : {};
  const cylinders = (Array.isArray(raw.cylinders) && raw.cylinders.length
    ? raw.cylinders
    : DEFAULT_CYLINDERS
  )
    .map((c) => ({
      sizeKg: Number(c.sizeKg),
      label: String(c.label || `${c.sizeKg} kg`),
      refillPrice: round2(c.refillPrice),
      exchangePrice: round2(c.exchangePrice),
      active: c.active !== false,
    }))
    .filter((c) => c.sizeKg > 0 && c.refillPrice >= 0 && c.exchangePrice >= 0)
    .sort((a, b) => a.sizeKg - b.sizeKg);

  const rate = Number(raw.stationCommissionRate);
  return {
    enabled: raw.enabled !== false,
    momoEnabled: raw.momoEnabled === true,
    stationCommissionRate: Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.05,
    delivery: normalizeDelivery(raw.delivery),
    cylinders,
  };
}

/** Validates an admin PATCH payload; returns the value to store or throws an Error. */
export function normalizeGasConfigInput(input) {
  if (!input || typeof input !== "object") throw new Error("gas must be an object");
  const out = {
    enabled: input.enabled !== false,
    momoEnabled: input.momoEnabled === true,
    stationCommissionRate: Number(input.stationCommissionRate ?? 0.05),
    delivery: normalizeDelivery(input.delivery),
    cylinders: [],
  };
  for (const k of ["baseFare", "perKmRate", "minimumFare"]) {
    const v = input.delivery?.[k];
    if (v !== undefined && !(Number(v) >= 0)) throw new Error("Gas delivery rates must be 0 or more");
  }
  if (!(out.stationCommissionRate >= 0 && out.stationCommissionRate <= 1)) {
    throw new Error("Station commission must be between 0 and 1");
  }
  const seen = new Set();
  for (const c of Array.isArray(input.cylinders) ? input.cylinders : []) {
    const sizeKg = Number(c.sizeKg);
    const refillPrice = Number(c.refillPrice);
    const exchangePrice = Number(c.exchangePrice);
    if (!(sizeKg > 0 && sizeKg <= 100)) throw new Error("Cylinder size must be between 0 and 100 kg");
    if (!(refillPrice >= 0) || !(exchangePrice >= 0)) throw new Error("Prices must be 0 or more");
    if (seen.has(sizeKg)) throw new Error(`Duplicate cylinder size ${sizeKg} kg`);
    seen.add(sizeKg);
    out.cylinders.push({
      sizeKg,
      label: String(c.label || `${sizeKg} kg`).trim().slice(0, 30),
      refillPrice: round2(refillPrice),
      exchangePrice: round2(exchangePrice),
      active: c.active !== false,
    });
  }
  if (!out.cylinders.length) throw new Error("Add at least one cylinder size");
  return out;
}

/** Nearest active, open, accepting gas station within delivery range, or null. */
export async function findNearestGasStation(lat, lon, now = new Date()) {
  const stations = await Restaurant.find({ vertical: "GAS", isActive: true }).lean();
  const settings = await getSettings();
  let best = null;
  for (const s of stations) {
    if (s.latitude == null || s.longitude == null) continue;
    if (s.isAcceptingOrders === false) continue;
    if (!storeOpenState(s, settings, now).isOpen) continue; // also skips one over its debt limit
    const km = calculateDistance(Number(s.latitude), Number(s.longitude), lat, lon);
    if (!Number.isFinite(km) || km > MAX_FOOD_DELIVERY_KM) continue;
    if (!best || km < best.distanceKm) best = { station: s, distanceKm: km };
  }
  return best;
}

/**
 * Price a gas order. Both modes are a round trip between the customer and the station
 * (REFILL: collect empty → station → back; EXCHANGE: full to customer → empty back to station),
 * so the courier fee covers twice the one-way distance.
 */
export function buildGasQuote({ config, settings, mode, sizeKg, quantity, distanceKm }) {
  if (!GAS_MODES.includes(mode)) throw new Error("Choose refill or exchange");
  const cylinder = config.cylinders.find((c) => c.active && c.sizeKg === Number(sizeKg));
  if (!cylinder) throw new Error("That cylinder size is not available");
  const qty = Math.min(MAX_GAS_CYLINDERS, Math.max(1, parseInt(quantity, 10) || 1));
  const unitPrice = mode === "REFILL" ? cylinder.refillPrice : cylinder.exchangePrice;
  const subtotal = round2(unitPrice * qty);
  const oneWayKm = Math.max(MIN_FOOD_DELIVERY_KM, Number(distanceKm) || 0);
  const deliveryFee = computeGasDeliveryFee(oneWayKm * 2, config.delivery);
  const serviceFee = computeFoodServiceFee(subtotal, settings);
  return {
    cylinder,
    quantity: qty,
    unitPrice,
    subtotal,
    deliveryFee,
    serviceFee,
    total: round2(subtotal + deliveryFee + serviceFee),
    distanceKm: Math.round(oneWayKm * 100) / 100,
    itemName: `${cylinder.label} gas ${mode === "REFILL" ? "refill" : "exchange"}`,
  };
}
