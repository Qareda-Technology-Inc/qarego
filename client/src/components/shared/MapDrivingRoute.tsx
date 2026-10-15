import React, { memo, useEffect, useMemo, useState } from "react";
import { Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { getPoints } from "@/utils/mapUtils";
import {
  canRequestDrivingRoute,
  coordKey,
  distanceKm,
  isDirectionsZeroResults,
  parseMapCoord,
  riderNearRoute,
  type MapCoord,
} from "@/utils/mapDirections";

const apikey = process.env.EXPO_PUBLIC_MAP_API_KEY || "";
const MIN_ROUTE_KM = 0.02;

type Props = {
  origin: unknown;
  destination: unknown;
  strokeColor: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
  onReady?: (result: { distance: number; duration: number }) => void;
};

const MapDrivingRoute: React.FC<Props> = ({
  origin,
  destination,
  strokeColor,
  strokeWidth = 5,
  lineDashPattern,
  onReady,
}) => {
  const originKey = coordKey(origin);
  const destinationKey = coordKey(destination);
  const o = useMemo(() => parseMapCoord(origin), [originKey]);
  const d = useMemo(() => parseMapCoord(destination), [destinationKey]);
  const [fallback, setFallback] = useState(false);

  // New origin/destination must retry Directions — don't stick on a prior ZERO_RESULTS.
  useEffect(() => {
    setFallback(false);
  }, [originKey, destinationKey]);

  const usePolyline =
    fallback ||
    !apikey ||
    !o ||
    !d ||
    !canRequestDrivingRoute(o, d);

  if (!o || !d) return null;
  // Nothing to draw when the ends (nearly) coincide, e.g. a courier waiting at the store.
  // The curved fallback line degenerates to NaN points there, which made Google Maps on
  // Android run out of memory.
  if (distanceKm(o, d) < MIN_ROUTE_KM) return null;

  if (usePolyline) {
    return (
      <Polyline
        coordinates={getPoints([o, d])}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        geodesic
        lineDashPattern={lineDashPattern ?? [10, 8]}
      />
    );
  }

  return (
    <MapViewDirections
      origin={o}
      destination={d}
      apikey={apikey}
      strokeColor={strokeColor}
      strokeColors={[strokeColor]}
      strokeWidth={strokeWidth}
      precision="high"
      lineDashPattern={lineDashPattern}
      onReady={(result) => onReady?.(result)}
      onError={(error) => {
        if (isDirectionsZeroResults(error)) {
          setFallback(true);
        } else if (__DEV__) {
          console.log("Directions error:", error);
        }
      }}
    />
  );
};

export default memo(MapDrivingRoute);

export { parseMapCoord, riderNearRoute, coordKey, type MapCoord };
