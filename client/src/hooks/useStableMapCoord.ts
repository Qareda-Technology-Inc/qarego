import { useMemo } from "react";
import { coordKey, parseMapCoord, type MapCoord } from "@/utils/mapDirections";

/** Memoized map coordinate — safe for useEffect/useCallback deps in rider + customer maps. */
export function useStableMapCoord(point: unknown): MapCoord | null {
  const key = coordKey(point);
  return useMemo(() => parseMapCoord(point), [key]);
}
