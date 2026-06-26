import { calculateDistance, calculateFoodDeliveryFee } from "./mapUtils.js";

export const MIN_FOOD_DELIVERY_KM = 0.1;
export const MAX_FOOD_DELIVERY_KM = 25;

export function parseCoord(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid ${label}`);
  }
  return n;
}

export function assertStoreCoordinates(restaurant) {
  const lat = Number(restaurant?.latitude);
  const lon = Number(restaurant?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("This store has no valid location on file");
  }
  return { lat, lon };
}

function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

function roundDistance(km) {
  return Math.round(km * 100) / 100;
}

/**
 * Courier ride pricing for a food order — matches customer delivery quote (no minimum fare).
 * @returns {{ distanceKm: number, driverFee: number }}
 */
export function resolveFoodCourierRidePricing(foodOrder, restaurant, fareRates) {
  let distanceKm = Number(foodOrder?.deliveryDistanceKm);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    const { lat: storeLat, lon: storeLon } = assertStoreCoordinates(restaurant);
    distanceKm = roundDistance(
      calculateDistance(
        storeLat,
        storeLon,
        parseCoord(foodOrder.delivery.latitude, "delivery latitude"),
        parseCoord(foodOrder.delivery.longitude, "delivery longitude")
      )
    );
  }

  let driverFee = Number(foodOrder?.driverFee);
  if (!Number.isFinite(driverFee) || driverFee <= 0) {
    driverFee = roundMoney(calculateFoodDeliveryFee(distanceKm, fareRates));
  }

  return { distanceKm, driverFee };
}

/**
 * Distance-based food delivery fee (base + per-km, motorcycle rates).
 * @returns {{ distanceKm: number, deliveryFee: number }}
 */
export function computeFoodDeliveryQuote(
  storeLat,
  storeLon,
  destLat,
  destLon,
  fareRates
) {
  const distanceKm = calculateDistance(storeLat, storeLon, destLat, destLon);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error("Could not calculate delivery distance. Check the delivery address.");
  }
  if (distanceKm < MIN_FOOD_DELIVERY_KM) {
    throw new Error(
      `Delivery address must be at least ${MIN_FOOD_DELIVERY_KM} km from the store`
    );
  }
  if (distanceKm > MAX_FOOD_DELIVERY_KM) {
    throw new Error(
      `Delivery is only available within ${MAX_FOOD_DELIVERY_KM} km of the store`
    );
  }

  const deliveryFee = roundMoney(calculateFoodDeliveryFee(distanceKm, fareRates));
  return {
    distanceKm: roundDistance(distanceKm),
    deliveryFee,
  };
}
