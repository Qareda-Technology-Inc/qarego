import { appAxios } from "./apiInterceptors";

export type ParcelPointKind = "BUS_STATION" | "MALL" | "SHOP" | "OFFICE" | "OTHER";

export type ParcelPoint = {
  _id: string;
  name: string;
  kind: ParcelPointKind;
  address?: string | null;
  latitude: number;
  longitude: number;
  instructions?: string | null;
  hours?: string | null;
  canPickup: boolean;
  canDrop: boolean;
  distanceKm: number | null;
};

/** Admin-added parcel pickup / drop-off points, nearest first when a position is given. */
export const fetchParcelPoints = async (
  latitude?: number | null,
  longitude?: number | null
): Promise<ParcelPoint[]> => {
  try {
    const params: Record<string, number> = {};
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      params.lat = latitude as number;
      params.lon = longitude as number;
    }
    const res = await appAxios.get("/parcel-points", { params });
    return Array.isArray(res.data?.points) ? res.data.points : [];
  } catch {
    return [];
  }
};

/**
 * The address text saved on the trip. Riders navigate by the coordinates, so the
 * "where to meet" note is more useful to them than the street address.
 */
export const parcelPointAddress = (p: ParcelPoint): string => {
  if (p.instructions) return `${p.name} · ${p.instructions}`;
  return p.address ? `${p.name}, ${p.address}` : p.name;
};
