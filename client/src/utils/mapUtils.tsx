import axios from "axios";
import { useUserStore } from "@/store/userStore";

export type PlaceSuggestionHint = {
    title?: string;
    description?: string;
};

export type ResolvedPlace = {
    latitude: number;
    longitude: number;
    /** Human-readable label for inputs and trip summary (place name first). */
    address: string;
    name?: string;
    formattedAddress?: string;
};

const PLUS_CODE_RE = /^[A-Z0-9]{4,}\+[A-Z0-9]{2,3}$/i;
const PLUS_CODE_PREFIX_RE = /^[A-Z0-9]{4,}\+[A-Z0-9]{2,3}(?:\s*,\s*|\s+)/i;

function looksLikePlusCode(text: string): boolean {
    return PLUS_CODE_RE.test(text.trim());
}

function stripPlusCodePrefix(text: string): string {
    if (!text) return "";
    return text.replace(PLUS_CODE_PREFIX_RE, "").trim();
}

function buildPlaceDisplayAddress(opts: {
    name?: string;
    formattedAddress?: string;
    suggestionTitle?: string;
    suggestionDescription?: string;
}): string {
    const placeName = (opts.name || opts.suggestionTitle || "").trim();
    const secondary = (opts.suggestionDescription || "").trim();
    const formatted = stripPlusCodePrefix(opts.formattedAddress || "").trim();

    if (placeName && !looksLikePlusCode(placeName)) {
        if (secondary && !secondary.toLowerCase().startsWith(placeName.toLowerCase())) {
            return `${placeName}, ${secondary}`;
        }
        if (formatted && !formatted.toLowerCase().startsWith(placeName.toLowerCase())) {
            const tail = formatted
                .replace(new RegExp(`^${placeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},?\\s*`, "i"), "")
                .trim();
            if (tail && !looksLikePlusCode(tail)) {
                return `${placeName}, ${tail}`;
            }
        }
        return placeName;
    }

    if (opts.suggestionTitle && !looksLikePlusCode(opts.suggestionTitle)) {
        return secondary
            ? `${opts.suggestionTitle}, ${secondary}`
            : opts.suggestionTitle;
    }

    if (formatted && !looksLikePlusCode(formatted)) return formatted;
    return opts.formattedAddress || opts.suggestionTitle || "";
}

function pickBestGeocodeResult(results: any[]): any | null {
    if (!Array.isArray(results) || results.length === 0) return null;
    const score = (types: string[] = []) => {
        if (types.includes("plus_code")) return 0;
        if (types.includes("establishment") || types.includes("point_of_interest")) return 5;
        if (types.includes("premise") || types.includes("street_address")) return 4;
        if (types.includes("route") || types.includes("sublocality")) return 3;
        if (types.includes("locality")) return 2;
        return 1;
    };
    return [...results].sort((a, b) => score(b.types) - score(a.types))[0];
}

function labelFromGeocodeResult(result: any): string {
    const formatted = stripPlusCodePrefix(result?.formatted_address || "").trim();
    const premise =
        result?.address_components?.find((c: any) =>
            c.types?.some((t: string) =>
                ["establishment", "point_of_interest", "premise", "subpremise"].includes(t)
            )
        )?.long_name || "";

    if (premise && !looksLikePlusCode(premise)) {
        if (formatted && !formatted.toLowerCase().startsWith(premise.toLowerCase())) {
            return `${premise}, ${formatted}`;
        }
        return premise;
    }

    return formatted || result?.formatted_address || "";
}

export const getLatLong = async (
    placeId: string,
    suggestion?: PlaceSuggestionHint
): Promise<ResolvedPlace> => {
    try {
        const response = await axios.get("https://maps.googleapis.com/maps/api/place/details/json", {
            params: {
                placeid: placeId,
                fields: "geometry,formatted_address,name",
                key: process.env.EXPO_PUBLIC_MAP_API_KEY,
            },
        });
        const data = response.data;
        if (data.status === 'OK' && data.result) {
            const location = data.result.geometry.location;
            const formattedAddress = data.result.formatted_address;
            const name = data.result.name;
            const address = buildPlaceDisplayAddress({
                name,
                formattedAddress,
                suggestionTitle: suggestion?.title,
                suggestionDescription: suggestion?.description,
            });

            return {
                latitude: location.lat,
                longitude: location.lng,
                address,
                name: name || suggestion?.title,
                formattedAddress,
            };
        } else {
            throw new Error('Unable to fetch location details');
        }
    } catch (error) {
        throw new Error('Unable to fetch location details');
    }
}

export const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.EXPO_PUBLIC_MAP_API_KEY}`
        );
        if (response.data.status === 'OK') {
            const best = pickBestGeocodeResult(response.data.results);
            return best ? labelFromGeocodeResult(best) : "";
        } else {
            console.log('Geocoding failed: ', response.data.status);
            return ""
        }
    } catch (error) {
        console.log('Error during reverse geocoding: ', error);
        return ""
    }
};

function extractPlaceData(data: any) {
    return data.map((item: any) => ({
        place_id: item.place_id,
        title: item.structured_formatting?.main_text || item.description || "",
        description:
            item.structured_formatting?.secondary_text ||
            item.description ||
            "",
    }));
}

// Default bias for Ghana (Accra) when user location is not available
const GHANA_BIAS = "5.6037,-0.1870";

export const getPlacesSuggestions = async (query: string) => {
    const { location } = useUserStore.getState();
    const lat = location?.latitude;
    const lon = location?.longitude;
    const locationBias = lat != null && lon != null ? `${lat},${lon}` : GHANA_BIAS;
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json`, {
            params: {
                input: query,
                location: locationBias,
                radius: 50000,
                components: 'country:GH', // Ghana country code
                key: process.env.EXPO_PUBLIC_MAP_API_KEY,
            }
        }
        );
        const predictions = response.data?.predictions;
        return Array.isArray(predictions) ? extractPlaceData(predictions) : [];
    } catch (error) {
        console.error('Error fetching autocomplete suggestions:', error);
        return [];
    }
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export type FareRateStructure = {
    motorcycle?: { baseFare: number; perKmRate: number; minimumFare: number };
    pragya?: { baseFare: number; perKmRate: number; minimumFare: number };
    comfort?: { baseFare: number; perKmRate: number; minimumFare: number };
};

const DEFAULT_RATE_STRUCTURE: Required<FareRateStructure> = {
    motorcycle: { baseFare: 8, perKmRate: 4, minimumFare: 20 },
    pragya: { baseFare: 12, perKmRate: 6, minimumFare: 28 },
    comfort: { baseFare: 18, perKmRate: 9, minimumFare: 45 },
};

/** Fare rates: motorcycle, pragya (tricycle), comfort (car). Matches server mapUtils. */
export const calculateFare = (distance: number, rateStructure?: FareRateStructure | null) => {
    const rates = rateStructure || DEFAULT_RATE_STRUCTURE;

    const fareCalculation = (baseFare: number, perKmRate: number, minimumFare: number) => {
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

/** Food delivery estimate: base + per-km (no minimum clamp). */
export const calculateFoodDeliveryFee = (
    distance: number,
    rateStructure?: FareRateStructure | null
) => {
    const rates = rateStructure || DEFAULT_RATE_STRUCTURE;
    const baseFare =
        rates.motorcycle?.baseFare ?? DEFAULT_RATE_STRUCTURE.motorcycle.baseFare;
    const perKmRate =
        rates.motorcycle?.perKmRate ?? DEFAULT_RATE_STRUCTURE.motorcycle.perKmRate;
    return Math.max(0, baseFare + distance * perKmRate);
};

function quadraticBezierCurve(p1: any, p2: any, controlPoint: any, numPoints: any) {
    const points = [];
    const step = 1 / (numPoints - 1);

    for (let t = 0; t <= 1; t += step) {
        const x =
            (1 - t) ** 2 * p1[0] +
            2 * (1 - t) * t * controlPoint[0] +
            t ** 2 * p2[0];
        const y =
            (1 - t) ** 2 * p1[1] +
            2 * (1 - t) * t * controlPoint[1] +
            t ** 2 * p2[1];
        const coord = { latitude: x, longitude: y };
        points.push(coord);
    }

    return points;
}

const calculateControlPoint = (p1: any, p2: any) => {
    const d = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
    const scale = 1; // Scale factor to reduce bending
    const h = d * scale; // Reduced distance from midpoint
    const w = d / 2;
    const x_m = (p1[0] + p2[0]) / 2;
    const y_m = (p1[1] + p2[1]) / 2;

    const x_c =
        x_m +
        ((h * (p2[1] - p1[1])) /
            (2 * Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2))) *
        (w / d);
    const y_c =
        y_m -
        ((h * (p2[0] - p1[0])) /
            (2 * Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2))) *
        (w / d);

    const controlPoint = [x_c, y_c];
    return controlPoint;
};

export const getPoints = (places: any) => {
    const p1 = [places[0].latitude, places[0].longitude];
    const p2 = [places[1].latitude, places[1].longitude];
    const controlPoint = calculateControlPoint(p1, p2);

    return quadraticBezierCurve(p1, p2, controlPoint, 100);
};

/** Vehicle types: motorcycle, pragya (tricycle), comfort (car). Reuses existing icons. */
export type VehicleType = 'motorcycle' | 'pragya' | 'comfort';
export const vehicleIcons: Record<VehicleType, { icon: any }> = {
    motorcycle: { icon: require('@/assets/icons/bike.png') },
    pragya: { icon: require('@/assets/icons/auto.png') },
    comfort: { icon: require('@/assets/icons/cab.png') },
};

const legacyVehicleToNew: Record<string, VehicleType> = {
    bike: 'motorcycle',
    auto: 'pragya',
    cabEconomy: 'comfort',
    cabPremium: 'comfort',
};

/** Display label for vehicle (supports legacy bike/auto/cabEconomy/cabPremium). */
export function getVehicleLabel(vehicle: string): string {
    const v = (legacyVehicleToNew[vehicle] ?? vehicle) as VehicleType;
    const labels: Record<VehicleType, string> = {
        motorcycle: 'Motorcycle',
        pragya: 'Pragya',
        comfort: 'Comfort',
    };
    return labels[v] ?? vehicle;
}

/** Icon for vehicle (supports legacy keys). */
export function getVehicleIconSource(vehicle: string): any {
    const v = legacyVehicleToNew[vehicle] ?? vehicle;
    return vehicleIcons[v as VehicleType]?.icon ?? vehicleIcons.motorcycle.icon;
}

/** Map any vehicle key to API vehicle type for createRide. */
export function getVehicleForApi(vehicle: string | undefined): VehicleType {
    const v = legacyVehicleToNew[vehicle ?? ""] ?? vehicle ?? "motorcycle";
    return (v === "motorcycle" || v === "pragya" || v === "comfort" ? v : "motorcycle") as VehicleType;
}
  