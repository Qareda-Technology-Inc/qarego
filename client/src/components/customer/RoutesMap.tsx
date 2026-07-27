import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
  InteractionManager,
  LayoutChangeEvent,
} from "react-native";
import React, { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { customMapStyle, indiaIntialRegion } from "@/utils/CustomMap";
import MapView, { Marker, Polyline } from "react-native-maps";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RFValue } from "react-native-responsive-fontsize";
import { mapStyles } from "@/styles/mapStyles";
import CustomText from "../shared/CustomText";
import { Colors } from "@/utils/Constants";
import { fetchDrivingPolyline } from "@/utils/mapDirections";

const apiKey = process.env.EXPO_PUBLIC_MAP_API_KEY || "";

/** Brand route line — high contrast on the map */
const ROUTE_STROKE = Colors.primary;
const ROUTE_WIDTH = 6;

const MIN_VISIBLE_MAP_PX = 120;

/** Extra breathing room around the route inside the padded (visible) map area. */
const FIT_MARGIN = { top: 36, right: 36, bottom: 36, left: 36 };

type LatLng = {
  latitude: number;
  longitude: number;
  address?: string;
};

function sampleCoordinates(
  coords: { latitude: number; longitude: number }[],
  maxPoints = 48
): { latitude: number; longitude: number }[] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const sampled = coords.filter((_, i) => i % step === 0);
  const last = coords[coords.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

export type RoutesMapEdgePadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type RoutesMapProps = {
  pickup: LatLng;
  drop: LatLng;
  /** Insets from map edges when fitting pickup → drop (e.g. large bottom = room for bottom sheet). */
  mapEdgePadding?: RoutesMapEdgePadding;
};

const defaultPadding: Required<RoutesMapEdgePadding> = {
  top: 52,
  right: 20,
  bottom: 52,
  left: 20,
};

/** Scale padding so top+bottom (and left+right) leave a real inner rect — huge bottom sheet values break fitToCoordinates on native maps. */
function clampEdgePadding(
  p: { top: number; right: number; bottom: number; left: number },
  mapW: number,
  mapH: number
): { top: number; right: number; bottom: number; left: number } {
  if (mapW < 80 || mapH < 80) return p;
  let { top, right, bottom, left } = p;
  if (top + bottom > mapH - MIN_VISIBLE_MAP_PX) {
    const avail = Math.max(mapH - MIN_VISIBLE_MAP_PX, MIN_VISIBLE_MAP_PX);
    const sum = top + bottom;
    const scale = sum > 0 ? avail / sum : 1;
    top = Math.max(24, top * scale);
    bottom = Math.max(24, bottom * scale);
  }
  if (left + right > mapW - MIN_VISIBLE_MAP_PX) {
    const avail = Math.max(mapW - MIN_VISIBLE_MAP_PX, MIN_VISIBLE_MAP_PX);
    const sum = left + right;
    const scale = sum > 0 ? avail / sum : 1;
    left = Math.max(16, left * scale);
    right = Math.max(16, right * scale);
  }
  return { top, right, bottom, left };
}

function LabeledPin({
  label,
  variant,
  icon,
}: {
  label: string;
  variant: "pickup" | "dropoff";
  icon: number;
}) {
  return (
    <View style={pinStyles.markerColumn}>
      <View style={[pinStyles.labelPill, variant === "pickup" ? pinStyles.labelPickup : pinStyles.labelDropoff]}>
        <CustomText fontFamily="SemiBold" fontSize={11} style={pinStyles.labelText}>
          {label}
        </CustomText>
      </View>
      <Image source={icon} style={pinStyles.pinImage} />
    </View>
  );
}

const RoutesMap: FC<RoutesMapProps> = ({ drop, pickup, mapEdgePadding }) => {
  const mapRef = useRef<MapView>(null);
  const mapReadyRef = useRef(false);
  const routeCoordsRef = useRef<{ latitude: number; longitude: number }[]>([]);
  const { width: winW, height: winH } = useWindowDimensions();
  const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 });
  const [mapReady, setMapReady] = useState(false);
  const [markersReady, setMarkersReady] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  /** Custom markers often render blank on Google Maps if this stays false (bitmap never captured). */
  const [markerTracks, setMarkerTracks] = useState(true);

  const edgePadding = useMemo(
    () => ({
      top: mapEdgePadding?.top ?? defaultPadding.top,
      right: mapEdgePadding?.right ?? defaultPadding.right,
      bottom: mapEdgePadding?.bottom ?? defaultPadding.bottom,
      left: mapEdgePadding?.left ?? defaultPadding.left,
    }),
    [mapEdgePadding]
  );

  const mapSize = useMemo(
    () => ({
      width: mapLayout.width > 0 ? mapLayout.width : winW,
      height: mapLayout.height > 0 ? mapLayout.height : winH,
    }),
    [mapLayout.width, mapLayout.height, winW, winH]
  );

  const paddingForFit = useMemo(
    () => clampEdgePadding(edgePadding, mapSize.width, mapSize.height),
    [edgePadding, mapSize.width, mapSize.height]
  );

  const edgePaddingForFit = useMemo(
    () => ({
      top: paddingForFit.top + FIT_MARGIN.top,
      right: paddingForFit.right + FIT_MARGIN.right,
      bottom: paddingForFit.bottom + FIT_MARGIN.bottom,
      left: paddingForFit.left + FIT_MARGIN.left,
    }),
    [paddingForFit]
  );

  const origin = useMemo(
    () => ({
      latitude: Number(pickup.latitude),
      longitude: Number(pickup.longitude),
    }),
    [pickup.latitude, pickup.longitude]
  );

  const destination = useMemo(
    () => ({
      latitude: Number(drop.latitude),
      longitude: Number(drop.longitude),
    }),
    [drop.latitude, drop.longitude]
  );

  const showDirections = Boolean(apiKey) && pickup?.latitude != null && drop?.latitude != null;

  const fitToCoordinates = useCallback(
    (coordinates: { latitude: number; longitude: number }[]) => {
      if (coordinates.length === 0 || !mapRef.current) return;
      const pts = sampleCoordinates(coordinates);
      try {
        mapRef.current.fitToCoordinates(pts, {
          edgePadding: edgePaddingForFit,
          animated: true,
        });
      } catch {
        /* native not ready */
      }
    },
    [edgePaddingForFit]
  );

  const scheduleCameraFit = useCallback(
    (coordinates: { latitude: number; longitude: number }[]) => {
      const run = () => fitToCoordinates(coordinates);
      InteractionManager.runAfterInteractions(() => {
        run();
        setTimeout(run, 280);
        setTimeout(run, 900);
        setTimeout(run, 1600);
      });
    },
    [fitToCoordinates]
  );

  useEffect(() => {
    if (!mapReady) return;
    const base = [origin, destination];
    routeCoordsRef.current = base;
    setRouteCoords(base);

    if (!showDirections) return;
    let cancelled = false;
    void fetchDrivingPolyline(origin, destination, apiKey).then((coords) => {
      if (cancelled || !coords?.length) return;
      routeCoordsRef.current = coords;
      setRouteCoords(coords);
      scheduleCameraFit(coords);
    });
    return () => {
      cancelled = true;
    };
  }, [mapReady, showDirections, origin, destination, scheduleCameraFit, apiKey]);

  useEffect(() => {
    if (!mapReady) {
      setMarkersReady(false);
      return;
    }
    const t = setTimeout(() => setMarkersReady(true), 320);
    return () => clearTimeout(t);
  }, [mapReady, origin.latitude, origin.longitude, destination.latitude, destination.longitude]);

  const onMapWrapperLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMapLayout((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height }
    );
  }, []);

  const onMapReady = useCallback(() => {
    mapReadyRef.current = true;
    setMapReady(true);
    if (!Number.isFinite(origin.latitude) || !Number.isFinite(destination.latitude)) return;
    const pts = routeCoordsRef.current.length >= 2 ? routeCoordsRef.current : [origin, destination];
    scheduleCameraFit(pts);
  }, [origin, destination, scheduleCameraFit]);

  /** After layout / padding changes, re-fit into the visible map strip */
  useEffect(() => {
    if (!mapReadyRef.current || mapLayout.width < 40) return;
    if (!Number.isFinite(origin.latitude) || !Number.isFinite(destination.latitude)) return;
    const pts = routeCoordsRef.current.length >= 2 ? routeCoordsRef.current : [origin, destination];
    const t = setTimeout(() => scheduleCameraFit(pts), 60);
    return () => clearTimeout(t);
  }, [edgePaddingForFit, mapLayout.width, mapLayout.height, origin, destination, scheduleCameraFit]);

  /** First mount: map may not fire onMapReady before first coords effect */
  useEffect(() => {
    if (!Number.isFinite(origin.latitude) || !Number.isFinite(destination.latitude)) return;
    routeCoordsRef.current = [origin, destination];
    const t = setTimeout(() => {
      if (mapReadyRef.current) scheduleCameraFit(routeCoordsRef.current);
    }, 400);
    return () => clearTimeout(t);
  }, [origin, destination, scheduleCameraFit]);

  /** Straight-line fallback when directions are unavailable */
  useEffect(() => {
    if (!mapReady || showDirections) return;
    routeCoordsRef.current = [origin, destination];
    setRouteCoords([origin, destination]);
    const t = setTimeout(() => scheduleCameraFit([origin, destination]), 120);
    return () => clearTimeout(t);
  }, [mapReady, showDirections, origin, destination, scheduleCameraFit]);

  /** Stop continuous marker re-rendering once labels have been captured */
  useEffect(() => {
    const t = setTimeout(() => setMarkerTracks(false), 2000);
    return () => clearTimeout(t);
  }, []);

  const initialRegion = useMemo(() => {
    if (
      pickup?.latitude != null &&
      drop?.latitude != null &&
      !Number.isNaN(Number(pickup.latitude)) &&
      !Number.isNaN(Number(drop.latitude))
    ) {
      const lat1 = Number(pickup.latitude);
      const lon1 = Number(pickup.longitude);
      const lat2 = Number(drop.latitude);
      const lon2 = Number(drop.longitude);
      const minLat = Math.min(lat1, lat2);
      const maxLat = Math.max(lat1, lat2);
      const minLon = Math.min(lon1, lon2);
      const maxLon = Math.max(lon1, lon2);
      const latDelta = Math.max((maxLat - minLat) * 1.6, 0.02);
      const lonDelta = Math.max((maxLon - minLon) * 1.6, 0.02);
      const midLat = (minLat + maxLat) / 2;
      const midLon = (minLon + maxLon) / 2;

      // Bias camera so the route sits in the visible strip above the bottom sheet.
      const h = mapSize.height;
      const visibleH = h - paddingForFit.top - paddingForFit.bottom;
      const visibleCenterY = paddingForFit.top + visibleH / 2;
      const mapCenterY = h / 2;
      const pixelShift = mapCenterY - visibleCenterY;
      const latOffset = h > 0 ? (pixelShift / h) * latDelta * 0.85 : 0;

      return {
        latitude: midLat - latOffset,
        longitude: midLon,
        latitudeDelta: latDelta,
        longitudeDelta: lonDelta,
      };
    }
    return indiaIntialRegion;
  }, [
    pickup?.latitude,
    pickup?.longitude,
    drop?.latitude,
    drop?.longitude,
    mapSize.height,
    paddingForFit.top,
    paddingForFit.bottom,
  ]);

  return (
    <View style={styles.mapWrap} onLayout={onMapWrapperLayout}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        provider="google"
        showsMyLocationButton={false}
        showsCompass={false}
        showsIndoors={false}
        customMapStyle={customMapStyle}
        showsUserLocation
        rotateEnabled={false}
        onMapReady={onMapReady}
      >
        {mapReady && routeCoords.length >= 2 ? (
          <Polyline
            coordinates={routeCoords}
            strokeColor={ROUTE_STROKE}
            strokeWidth={ROUTE_WIDTH}
            lineCap="round"
            lineJoin="round"
            geodesic
          />
        ) : null}

        {mapReady && markersReady && drop?.latitude != null ? (
          <Marker
            coordinate={{ latitude: Number(drop.latitude), longitude: Number(drop.longitude) }}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={1}
            tracksViewChanges={markerTracks}
            title="Dropoff"
            description={drop?.address || "Dropoff"}
          >
            <LabeledPin label="Dropoff" variant="dropoff" icon={require("@/assets/icons/drop_marker.png")} />
          </Marker>
        ) : null}

        {mapReady && markersReady && pickup?.latitude != null ? (
          <Marker
            coordinate={{
              latitude: Number(pickup.latitude),
              longitude: Number(pickup.longitude),
            }}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={2}
            tracksViewChanges={markerTracks}
            title="Pickup"
            description={pickup?.address || "Pickup"}
          >
            <LabeledPin label="Pickup" variant="pickup" icon={require("@/assets/icons/marker.png")} />
          </Marker>
        ) : null}
      </MapView>

      <TouchableOpacity
        style={[mapStyles.gpsButton, styles.refitButton, { bottom: paddingForFit.bottom + 12 }]}
        onPress={() => {
          const pts =
            routeCoordsRef.current.length >= 2 ? routeCoordsRef.current : [origin, destination];
          scheduleCameraFit(pts);
        }}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={RFValue(16)} color="#3C75BE" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  mapWrap: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  map: {
    flex: 1,
  },
  refitButton: {
    zIndex: 5,
  },
});

const pinStyles = StyleSheet.create({
  markerColumn: {
    alignItems: "center",
  },
  labelPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 4,
  },
  labelPickup: {
    backgroundColor: "#22c55e",
  },
  labelDropoff: {
    backgroundColor: "#ef4444",
  },
  labelText: {
    color: "#fff",
  },
  pinImage: {
    height: 30,
    width: 30,
    resizeMode: "contain",
  },
});

export default memo(RoutesMap);
