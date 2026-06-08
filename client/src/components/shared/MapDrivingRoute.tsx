import React, { memo, useMemo, useState } from "react";
import { Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { getPoints } from "@/utils/mapUtils";
import {
  canRequestDrivingRoute,
  isDirectionsZeroResults,
  parseMapCoord,
  riderNearRoute,
  type MapCoord,
} from "@/utils/mapDirections";

const apikey = process.env.EXPO_PUBLIC_MAP_API_KEY || "";

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
  const o = useMemo(() => parseMapCoord(origin), [origin]);
  const d = useMemo(() => parseMapCoord(destination), [destination]);
  const [fallback, setFallback] = useState(false);

  const usePolyline =
    fallback ||
    !apikey ||
    !o ||
    !d ||
    !canRequestDrivingRoute(o, d);

  if (!o || !d) return null;

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

export { parseMapCoord, riderNearRoute, type MapCoord };
