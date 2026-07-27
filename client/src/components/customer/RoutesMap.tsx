import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
  InteractionManager,
  LayoutChangeEvent,
  Platform,
} from "react-native";
import React, { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { customMapStyle, indiaIntialRegion } from "@/utils/CustomMap";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
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

type LatLng = {
  latitude: number;
  longitude: number;
  address?: string;
};

type Point = { latitude: number; longitude: number };

export type RoutesMapEdgePadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type RoutesMapProps = {
  pickup: LatLng;
  drop: LatLng;
  /** Soft insets (px) reserved for top nav / labels inside the map view. */
  mapEdgePadding?: RoutesMapEdgePadding;
};

const defaultPadding: Required<RoutesMapEdgePadding> = {
  top: 72,
  right: 36,
  bottom: 40,
  left: 36,
};

function sampleCoordinates(coords: Point[], maxPoints = 48): Point[] {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const sampled = coords.filter((_, i) => i % step === 0);
  const last = coords[coords.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

/**
 * Build a camera region that keeps all points inside the map's visible pad box.
 * Prefer this over fitToCoordinates + mapPadding (those often double-apply insets on Google Maps).
 */
function regionForPoints(
  points: Point[],
  mapW: number,
  mapH: number,
  pad: { top: number; right: number; bottom: number; left: number }
): Region | null {
  const valid = points.filter(
    (p) =>
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude) &&
      Math.abs(p.latitude) <= 90 &&
      Math.abs(p.longitude) <= 180
  );
  if (valid.length === 0 || mapW < 80 || mapH < 80) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of valid) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }

  const latSpan = Math.max(maxLat - minLat, 0.004);
  const lngSpan = Math.max(maxLng - minLng, 0.004);

  const top = Math.max(12, Math.min(pad.top, mapH * 0.4));
  const bottom = Math.max(12, Math.min(pad.bottom, mapH * 0.3));
  const left = Math.max(12, Math.min(pad.left, mapW * 0.3));
  const right = Math.max(12, Math.min(pad.right, mapW * 0.3));

  const visibleH = Math.max(mapH - top - bottom, mapH * 0.35);
  const visibleW = Math.max(mapW - left - right, mapW * 0.35);

  // Zoom so the geographic span fits the inset rect, then match map aspect ratio.
  let latitudeDelta = (latSpan * mapH) / visibleH * 1.35;
  let longitudeDelta = (lngSpan * mapW) / visibleW * 1.35;
  const aspect = mapW / mapH;
  if (longitudeDelta / latitudeDelta < aspect) {
    longitudeDelta = latitudeDelta * aspect;
  } else {
    latitudeDelta = longitudeDelta / aspect;
  }

  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;

  // Shift camera so geographic midpoint lands in the visible center (not raw map center).
  const visibleCenterY = top + visibleH / 2;
  const mapCenterY = mapH / 2;
  const yShiftFrac = (mapCenterY - visibleCenterY) / mapH;
  const latitude = midLat - yShiftFrac * latitudeDelta;

  const visibleCenterX = left + visibleW / 2;
  const mapCenterX = mapW / 2;
  const xShiftFrac = (mapCenterX - visibleCenterX) / mapW;
  const longitude = midLng + xShiftFrac * longitudeDelta;

  return {
    latitude,
    longitude,
    latitudeDelta: Math.min(Math.max(latitudeDelta, 0.015), 0.55),
    longitudeDelta: Math.min(Math.max(longitudeDelta, 0.015), 0.55),
  };
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
  const fitTokenRef = useRef(0);
  const routeCoordsRef = useRef<Point[]>([]);
  const { width: winW, height: winH } = useWindowDimensions();
  const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 });
  const [mapReady, setMapReady] = useState(false);
  const [markersReady, setMarkersReady] = useState(false);
  const [routeCoords, setRouteCoords] = useState<Point[]>([]);
  const [markerTracks, setMarkerTracks] = useState(true);

  const pad = useMemo(
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
      height: mapLayout.height > 0 ? mapLayout.height : Math.max(winH * 0.55, 280),
    }),
    [mapLayout.width, mapLayout.height, winW, winH]
  );

  const layoutReady = mapLayout.width >= 80 && mapLayout.height >= 120;

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

  const applyCameraFit = useCallback(
    (coordinates: Point[], animated = true) => {
      if (!mapRef.current) return;
      const pts =
        coordinates.length >= 2 ? sampleCoordinates(coordinates) : [origin, destination];
      // Always include endpoints so a sparse polyline sample can't drop a pin off-frame.
      const withEnds = [...pts, origin, destination];

      const region = regionForPoints(withEnds, mapSize.width, mapSize.height, pad);
      if (!region) return;

      try {
        mapRef.current.animateToRegion(region, animated ? 350 : 0);
      } catch {
        /* native not ready */
      }
    },
    [destination, mapSize.height, mapSize.width, origin, pad]
  );

  const scheduleCameraFit = useCallback(
    (coordinates: Point[]) => {
      const token = ++fitTokenRef.current;
      const run = (animated: boolean) => {
        if (fitTokenRef.current !== token) return;
        applyCameraFit(coordinates, animated);
      };

      InteractionManager.runAfterInteractions(() => {
        run(false);
        setTimeout(() => run(true), 120);
        setTimeout(() => run(true), 450);
        setTimeout(() => run(true), 1000);
      });
    },
    [applyCameraFit]
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
      if (layoutReady) scheduleCameraFit(coords);
    });
    return () => {
      cancelled = true;
    };
  }, [mapReady, showDirections, origin, destination, scheduleCameraFit, layoutReady]);

  useEffect(() => {
    if (!mapReady) {
      setMarkersReady(false);
      return;
    }
    const t = setTimeout(() => setMarkersReady(true), 280);
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
  }, []);

  /** Fit once map is ready AND we know the real visible size above the sheet */
  useEffect(() => {
    if (!mapReady || !layoutReady) return;
    if (!Number.isFinite(origin.latitude) || !Number.isFinite(destination.latitude)) return;
    const pts = routeCoordsRef.current.length >= 2 ? routeCoordsRef.current : [origin, destination];
    scheduleCameraFit(pts);
  }, [
    mapReady,
    layoutReady,
    mapLayout.width,
    mapLayout.height,
    pad.top,
    pad.right,
    pad.bottom,
    pad.left,
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
    scheduleCameraFit,
  ]);

  /** Straight-line fallback when directions are unavailable */
  useEffect(() => {
    if (!mapReady || showDirections) return;
    routeCoordsRef.current = [origin, destination];
    setRouteCoords([origin, destination]);
  }, [mapReady, showDirections, origin, destination]);

  useEffect(() => {
    const t = setTimeout(() => setMarkerTracks(false), 2000);
    return () => clearTimeout(t);
  }, []);

  const initialRegion = useMemo(() => {
    return (
      regionForPoints([origin, destination], mapSize.width, mapSize.height, pad) ??
      indiaIntialRegion
    );
  }, [origin, destination, mapSize.width, mapSize.height, pad]);

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
        // customMapStyle can render blank tiles on some Android Google Maps builds
        customMapStyle={Platform.OS === "ios" ? customMapStyle : undefined}
        showsUserLocation={false}
        rotateEnabled={false}
        pitchEnabled={false}
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
        style={[mapStyles.gpsButton, styles.refitButton, { bottom: Math.max(pad.bottom, 24) + 8 }]}
        onPress={() => {
          const pts =
            routeCoordsRef.current.length >= 2 ? routeCoordsRef.current : [origin, destination];
          scheduleCameraFit(pts);
        }}
        activeOpacity={0.85}
        accessibilityLabel="Recenter route"
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
    backgroundColor: "#E8EEF5",
  },
  // Android: prefer flex sizing over absoluteFill — absoluteFill often yields a 0-size surface.
  map: {
    flex: 1,
    width: "100%",
    height: "100%",
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
