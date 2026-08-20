import { appAxios } from "./apiInterceptors";

export type ServiceZoneType = "RIDE" | "PARCEL" | "FOOD" | "GROCERY" | "PHARMACY";

export type ServiceCoverage = {
  inServiceArea: boolean;
  openMode: boolean;
  allowedServices: ServiceZoneType[];
  matchedZones: {
    _id: string;
    name: string;
    radiusKm: number;
    distanceKm: number;
    serviceTypes: ServiceZoneType[];
  }[];
  message: string | null;
};

export async function checkServiceCoverage(
  latitude: number,
  longitude: number
): Promise<ServiceCoverage> {
  const res = await appAxios.post("/service-zones/check", { latitude, longitude });
  return res.data as ServiceCoverage;
}
