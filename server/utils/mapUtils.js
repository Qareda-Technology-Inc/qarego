export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const DEFAULT_RATE_STRUCTURE = {
  motorcycle: { baseFare: 8, perKmRate: 4, minimumFare: 20 },
  pragya: { baseFare: 12, perKmRate: 6, minimumFare: 28 },
  comfort: { baseFare: 18, perKmRate: 9, minimumFare: 45 },
};

/** Fare rates: motorcycle, pragya (tricycle), comfort (car). Distance in km. rateStructure optional (from Settings.fareRates). */
export const calculateFare = (distance, rateStructure = DEFAULT_RATE_STRUCTURE) => {
  const rates = rateStructure || DEFAULT_RATE_STRUCTURE;

  const fareCalculation = (baseFare, perKmRate, minimumFare) => {
    const calculatedFare = baseFare + distance * perKmRate;
    return Math.max(calculatedFare, minimumFare);
  };

  return {
    motorcycle: fareCalculation(
      rates.motorcycle?.baseFare ?? DEFAULT_RATE_STRUCTURE.motorcycle.baseFare,
      rates.motorcycle?.perKmRate ?? DEFAULT_RATE_STRUCTURE.motorcycle.perKmRate,
      rates.motorcycle?.minimumFare ?? DEFAULT_RATE_STRUCTURE.motorcycle.minimumFare
    ),
    pragya: fareCalculation(
      rates.pragya?.baseFare ?? DEFAULT_RATE_STRUCTURE.pragya.baseFare,
      rates.pragya?.perKmRate ?? DEFAULT_RATE_STRUCTURE.pragya.perKmRate,
      rates.pragya?.minimumFare ?? DEFAULT_RATE_STRUCTURE.pragya.minimumFare
    ),
    comfort: fareCalculation(
      rates.comfort?.baseFare ?? DEFAULT_RATE_STRUCTURE.comfort.baseFare,
      rates.comfort?.perKmRate ?? DEFAULT_RATE_STRUCTURE.comfort.perKmRate,
      rates.comfort?.minimumFare ?? DEFAULT_RATE_STRUCTURE.comfort.minimumFare
    ),
  };
};

/**
 * Food delivery estimate: base + per-km (no minimum clamp).
 * This avoids many different stores showing the same minimum fare.
 */
export const calculateFoodDeliveryFee = (distance, rateStructure = DEFAULT_RATE_STRUCTURE) => {
  const rates = rateStructure || DEFAULT_RATE_STRUCTURE;
  const baseFare = rates.motorcycle?.baseFare ?? DEFAULT_RATE_STRUCTURE.motorcycle.baseFare;
  const perKmRate = rates.motorcycle?.perKmRate ?? DEFAULT_RATE_STRUCTURE.motorcycle.perKmRate;
  return Math.max(0, baseFare + distance * perKmRate);
};

export const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};
