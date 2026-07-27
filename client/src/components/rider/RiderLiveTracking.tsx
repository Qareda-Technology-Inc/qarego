import { View, TouchableOpacity, Image, StyleSheet, useWindowDimensions, Platform } from "react-native";
import React, { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import { customMapStyle, indiaIntialRegion } from "@/utils/CustomMap";
import CustomText from "../shared/CustomText";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { RFValue } from "react-native-responsive-fontsize";
import { mapStyles } from "@/styles/mapStyles";
import { Colors } from "@/utils/Constants";
import { getVehicleMarkerType } from "@/utils/mapUtils";
import NearbyVehicleMarker from "@/components/customer/NearbyVehicleMarker";
import {
  getRiderDropLabel,
  getRiderPickupLabel,
  RiderOfferRide,
} from "@/utils/riderRideUtils";
import { coordKey, fetchDrivingPolyline, snapCoordKey } from "@/utils/mapDirections";
import { useStableMapCoord } from "@/hooks/useStableMapCoord";
import { openMapsToPoint } from "@/utils/openMapsNavigation";

type Point = { latitude: number; longitude: number };

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

  const top = Math.max(12, Math.min(pad.top, mapH * 0.35));
  const bottom = Math.max(12, Math.min(pad.bottom, mapH * 0.3));
  const left = Math.max(12, Math.min(pad.left, mapW * 0.3));
  const right = Math.max(12, Math.min(pad.right, mapW * 0.3));

  const visibleH = Math.max(mapH - top - bottom, mapH * 0.4);
  const visibleW = Math.max(mapW - left - right, mapW * 0.4);

  let latitudeDelta = ((latSpan * mapH) / visibleH) * 1.35;
  let longitudeDelta = ((lngSpan * mapW) / visibleW) * 1.35;
  const aspect = mapW / mapH;
  if (longitudeDelta / latitudeDelta < aspect) {
    longitudeDelta = latitudeDelta * aspect;
  } else {
    latitudeDelta = longitudeDelta / aspect;
  }

  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const visibleCenterY = top + visibleH / 2;
  const yShiftFrac = (mapH / 2 - visibleCenterY) / mapH;
  const visibleCenterX = left + visibleW / 2;
  const xShiftFrac = (mapW / 2 - visibleCenterX) / mapW;

  return {
    latitude: midLat - yShiftFrac * latitudeDelta,
    longitude: midLng + xShiftFrac * longitudeDelta,
    latitudeDelta: Math.min(Math.max(latitudeDelta, 0.015), 0.55),
    longitudeDelta: Math.min(Math.max(longitudeDelta, 0.015), 0.55),
  };
}

const RiderLiveTracking: FC<{
  drop: any;
  pickup: any;
  rider: any;
  status: string;
  vehicle?: string;
  serviceType?: RiderOfferRide["serviceType"];
  parcelMode?: RiderOfferRide["parcelMode"];
  restaurantName?: string;
  storeVertical?: RiderOfferRide["storeVertical"];
  foodOrderSummary?: string;
  /** Height of the map strip above the action panel (px). */
  mapHeight?: number;
  /** Reserved space at bottom of the map strip for FABs (not the sheet — sheet is outside). */
  bottomInset?: number;
}> = ({
  drop,
  status,
  pickup,
  rider,
  vehicle,
  serviceType,
  parcelMode,
  restaurantName,
  storeVertical,
  mapHeight,
  bottomInset = 72,
}) => {
  const { width: winW, height: winH } = useWindowDimensions();
  const rideMeta: RiderOfferRide = { serviceType, parcelMode, storeVertical, restaurantName };
  const pickupLabel = getRiderPickupLabel(rideMeta);
  const dropLabel = getRiderDropLabel(rideMeta);
  const vehicleMarkerType = getVehicleMarkerType(vehicle ?? "motorcycle");
  const mapRef = useRef<MapView>(null);
  const isUserInteractingRef = useRef(false);
  const fitTokenRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const [overlaysReady, setOverlaysReady] = useState(false);
  const [routeCoords, setRouteCoords] = useState<Point[]>([]);

  const pickupKey = coordKey(pickup);
  const dropKey = coordKey(drop);
  const riderKey = coordKey(rider);

  const pickupCoord = useStableMapCoord(pickup);
  const dropCoord = useStableMapCoord(drop);
  const riderCoord = useStableMapCoord(rider);

  const stripH = mapHeight && mapHeight > 120 ? mapHeight : Math.max(winH * 0.55, 280);
  const mapW = winW;

  const pad = useMemo(
    () => ({
      top: 56,
      right: 40,
      bottom: Math.max(bottomInset, 56),
      left: 40,
    }),
    [bottomInset]
  );

  const activeDestination = useMemo(() => {
    if (status === "START") return pickupCoord;
    if (status === "ARRIVED" || status === "IN_PROGRESS") return dropCoord;
    return dropCoord ?? pickupCoord;
  }, [status, pickupCoord, dropCoord]);

  const routeOrigin = useMemo(() => {
    if (status === "START" && riderCoord) return riderCoord;
    if ((status === "ARRIVED" || status === "IN_PROGRESS") && riderCoord) return riderCoord;
    if ((status === "ARRIVED" || status === "IN_PROGRESS") && pickupCoord) return pickupCoord;
    return riderCoord ?? pickupCoord;
  }, [status, riderCoord, pickupCoord]);

  const routeDestination = useMemo(() => {
    if (status === "START") return pickupCoord;
    if (status === "ARRIVED" || status === "IN_PROGRESS") return dropCoord;
    return dropCoord ?? pickupCoord;
  }, [status, pickupCoord, dropCoord]);

  const routeFetchKey = useMemo(() => {
    if (!routeOrigin || !routeDestination) return "";
    const originKey =
      status === "START" || status === "IN_PROGRESS"
        ? snapCoordKey(routeOrigin, 80)
        : coordKey(routeOrigin);
    const destKey = coordKey(routeDestination);
    return `${status}|${originKey}|${destKey}`;
  }, [status, routeOrigin, routeDestination]);

  const applyCameraFit = useCallback(
    (animated = true) => {
      if (isUserInteractingRef.current || !mapRef.current) return;

      const points: Point[] = [];
      // Active leg first — keeps the map focused on where the rider is going.
      if (riderCoord) points.push(riderCoord);
      if (activeDestination) points.push(activeDestination);
      // Include the other endpoint lightly so context isn't lost on short trips.
      if (status === "START" && dropCoord) points.push(dropCoord);
      if ((status === "ARRIVED" || status === "IN_PROGRESS") && pickupCoord) {
        points.push(pickupCoord);
      }
      if (points.length === 0) {
        if (pickupCoord) points.push(pickupCoord);
        if (dropCoord) points.push(dropCoord);
      }
      if (points.length === 0) return;

      const region = regionForPoints(points, mapW, stripH, pad);
      if (!region) return;
      try {
        mapRef.current.animateToRegion(region, animated ? 350 : 0);
      } catch {
        /* native not ready */
      }
    },
    [activeDestination, dropCoord, mapW, pad, pickupCoord, riderCoord, status, stripH]
  );

  const scheduleCameraFit = useCallback(() => {
    const token = ++fitTokenRef.current;
    const run = (animated: boolean) => {
      if (fitTokenRef.current !== token) return;
      applyCameraFit(animated);
    };
    run(false);
    setTimeout(() => run(true), 160);
    setTimeout(() => run(true), 500);
  }, [applyCameraFit]);

  useEffect(() => {
    if (!mapReady) {
      setOverlaysReady(false);
      return;
    }
    const t = setTimeout(() => setOverlaysReady(true), 240);
    return () => clearTimeout(t);
  }, [mapReady, status]);

  useEffect(() => {
    if (!mapReady || !routeOrigin || !routeDestination || !routeFetchKey) return;
    const fallback = [routeOrigin, routeDestination];
    setRouteCoords(fallback);
    let cancelled = false;
    void fetchDrivingPolyline(
      routeOrigin,
      routeDestination,
      process.env.EXPO_PUBLIC_MAP_API_KEY || ""
    ).then((coords) => {
      if (cancelled || !coords?.length) return;
      setRouteCoords(coords);
      scheduleCameraFit();
    });
    return () => {
      cancelled = true;
    };
  }, [mapReady, routeFetchKey, routeOrigin, routeDestination, scheduleCameraFit]);

  useEffect(() => {
    if (!mapReady) return;
    if (!pickupKey && !dropKey && !riderKey) return;
    scheduleCameraFit();
  }, [pickupKey, dropKey, riderKey, status, mapReady, stripH, scheduleCameraFit]);

  const initialRegion = useMemo(() => {
    const pts: Point[] = [];
    if (riderCoord) pts.push(riderCoord);
    if (activeDestination) pts.push(activeDestination);
    if (pickupCoord) pts.push(pickupCoord);
    if (dropCoord) pts.push(dropCoord);
    return regionForPoints(pts, mapW, stripH, pad) ?? indiaIntialRegion;
  }, [activeDestination, dropCoord, mapW, pad, pickupCoord, riderCoord, stripH]);

  const openNavigationApp = () => {
    const target = status === "START" ? pickup : drop;
    const label = status === "START" ? pickupLabel : dropLabel;
    if (!target) return;
    openMapsToPoint(target, label);
  };

  const routeColor = status === "START" ? "#22c55e" : Colors.tertiary;

  return (
    <View style={[styles.wrap, mapHeight ? { height: mapHeight } : styles.wrapFlex]}>
      <MapView
        ref={mapRef}
        followsUserLocation={false}
        style={styles.map}
        initialRegion={initialRegion}
        provider="google"
        showsMyLocationButton={false}
        showsCompass={false}
        showsIndoors={false}
        customMapStyle={Platform.OS === "ios" ? customMapStyle : undefined}
        showsUserLocation={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onMapReady={() => {
          setMapReady(true);
          scheduleCameraFit();
        }}
        onPanDrag={() => {
          isUserInteractingRef.current = true;
        }}
        onRegionChangeComplete={() => {
          // Allow refits again shortly after the rider stops panning.
          setTimeout(() => {
            isUserInteractingRef.current = false;
          }, 1200);
        }}
      >
        {mapReady && overlaysReady && routeCoords.length >= 2 ? (
          <Polyline
            coordinates={routeCoords}
            strokeColor={routeColor}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
            geodesic
          />
        ) : null}

        {mapReady && overlaysReady && dropCoord ? (
          <Marker
            coordinate={dropCoord}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={1}
            tracksViewChanges={false}
            title={dropLabel}
          >
            <View style={[styles.pinLabel, status !== "START" && styles.pinLabelActive]}>
              <CustomText fontSize={9} fontFamily="Bold" style={styles.pinLabelText}>
                {dropLabel}
              </CustomText>
            </View>
            <Image
              source={require("@/assets/icons/drop_marker.png")}
              style={styles.pinImage}
            />
          </Marker>
        ) : null}

        {mapReady && overlaysReady && pickupCoord ? (
          <Marker
            coordinate={pickupCoord}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={2}
            tracksViewChanges={false}
            title={pickupLabel}
          >
            <View style={[styles.pinLabel, status === "START" && styles.pinLabelActive]}>
              <CustomText fontSize={9} fontFamily="Bold" style={styles.pinLabelText}>
                {pickupLabel}
              </CustomText>
            </View>
            <Image source={require("@/assets/icons/marker.png")} style={styles.pinImage} />
          </Marker>
        ) : null}

        {mapReady && overlaysReady && riderCoord ? (
          <Marker
            coordinate={riderCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={3}
            tracksViewChanges={false}
          >
            <NearbyVehicleMarker type={vehicleMarkerType} rotation={rider?.heading || 0} />
          </Marker>
        ) : null}
      </MapView>

      {(status === "START" || status === "ARRIVED" || status === "IN_PROGRESS") && (
        <TouchableOpacity
          style={[styles.navFab, { bottom: Math.max(bottomInset - 8, 16) }]}
          onPress={openNavigationApp}
          activeOpacity={0.9}
        >
          <Ionicons name="navigate" size={20} color="#fff" />
          <CustomText fontFamily="Bold" fontSize={13} style={styles.navFabText}>
            Directions
          </CustomText>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[mapStyles.gpsButton, styles.refitBtn, { bottom: Math.max(bottomInset + 44, 72) }]}
        onPress={() => {
          isUserInteractingRef.current = false;
          scheduleCameraFit();
        }}
        activeOpacity={0.85}
        accessibilityLabel="Recenter map"
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={RFValue(16)} color={Colors.tertiary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#E8EEF5",
  },
  wrapFlex: {
    flex: 1,
  },
  map: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  navFab: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.tertiary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 8,
    gap: 8,
  },
  navFabText: {
    color: "#fff",
  },
  refitBtn: {
    zIndex: 8,
  },
  pinLabel: {
    backgroundColor: "rgba(15,23,42,0.78)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 2,
    alignSelf: "center",
  },
  pinLabelActive: {
    backgroundColor: Colors.theme,
  },
  pinLabelText: {
    color: "#fff",
  },
  pinImage: {
    height: 32,
    width: 32,
    resizeMode: "contain",
  },
});

export default memo(RiderLiveTracking);
