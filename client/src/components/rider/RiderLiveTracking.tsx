import { View, TouchableOpacity, Image, StyleSheet } from "react-native";
import React, { FC, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, Polyline } from "react-native-maps";
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

const MAP_BOTTOM_PAD = 300;

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
}> = ({ drop, status, pickup, rider, vehicle, serviceType, parcelMode, restaurantName, storeVertical }) => {
  const rideMeta: RiderOfferRide = { serviceType, parcelMode, storeVertical, restaurantName };
  const pickupLabel = getRiderPickupLabel(rideMeta);
  const dropLabel = getRiderDropLabel(rideMeta);
  const vehicleMarkerType = getVehicleMarkerType(vehicle ?? "motorcycle");
  const mapRef = useRef<MapView>(null);
  const isUserInteractingRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [overlaysReady, setOverlaysReady] = useState(false);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);

  const pickupKey = coordKey(pickup);
  const dropKey = coordKey(drop);
  const riderKey = coordKey(rider);

  const pickupCoord = useStableMapCoord(pickup);
  const dropCoord = useStableMapCoord(drop);
  const riderCoord = useStableMapCoord(rider);

  const activeDestination = useMemo(() => {
    if (status === "START") return pickupCoord;
    if (status === "ARRIVED" || status === "IN_PROGRESS") return dropCoord;
    return dropCoord ?? pickupCoord;
  }, [status, pickupCoord, dropCoord]);

  const routeOrigin = useMemo(() => {
    if (status === "START" && riderCoord) return riderCoord;
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
    // While riding to pickup, snap GPS so we don't hit Directions on every tick.
    const originKey =
      status === "START" ? snapCoordKey(routeOrigin, 80) : coordKey(routeOrigin);
    const destKey = coordKey(routeDestination);
    return `${status}|${originKey}|${destKey}`;
  }, [status, routeOrigin, routeDestination]);

  const fitToMarkers = useCallback(async () => {
    if (isUserInteractingRef.current) return;
    const coordinates: { latitude: number; longitude: number }[] = [];
    if (pickupCoord) coordinates.push(pickupCoord);
    if (dropCoord) coordinates.push(dropCoord);
    if (riderCoord) coordinates.push(riderCoord);
    if (coordinates.length === 0) return;
    try {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 72, right: 40, bottom: MAP_BOTTOM_PAD, left: 40 },
        animated: true,
      });
    } catch {
      /* native not ready */
    }
  }, [dropCoord, pickupCoord, riderCoord]);

  useEffect(() => {
    if (!mapReady) {
      setOverlaysReady(false);
      return;
    }
    const t = setTimeout(() => setOverlaysReady(true), 280);
    return () => clearTimeout(t);
  }, [mapReady, status]);

  useEffect(() => {
    if (!mapReady || !routeOrigin || !routeDestination || !routeFetchKey) return;
    const fallback = [routeOrigin, routeDestination];
    setRouteCoords(fallback);
    let cancelled = false;
    void fetchDrivingPolyline(routeOrigin, routeDestination, process.env.EXPO_PUBLIC_MAP_API_KEY || "").then(
      (coords) => {
        if (cancelled || !coords?.length) return;
        setRouteCoords(coords);
        void fitToMarkers();
      }
    );
    return () => {
      cancelled = true;
    };
  }, [mapReady, routeFetchKey, routeOrigin, routeDestination, fitToMarkers]);

  useEffect(() => {
    if (!mapReady || !pickupKey || !dropKey) return;
    void fitToMarkers();
  }, [pickupKey, dropKey, riderKey, status, mapReady, fitToMarkers]);

  const calculateInitialRegion = () => {
    if (activeDestination && riderCoord) {
      return {
        latitude: (activeDestination.latitude + riderCoord.latitude) / 2,
        longitude: (activeDestination.longitude + riderCoord.longitude) / 2,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };
    }
    if (pickupCoord && dropCoord) {
      return {
        latitude: (pickupCoord.latitude + dropCoord.latitude) / 2,
        longitude: (pickupCoord.longitude + dropCoord.longitude) / 2,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return indiaIntialRegion;
  };

  const openNavigationApp = () => {
    const target =
      status === "START"
        ? pickup
        : drop;
    const label = status === "START" ? pickupLabel : dropLabel;
    if (!target) return;
    openMapsToPoint(target, label);
  };

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        followsUserLocation={status === "START" || status === "IN_PROGRESS"}
        style={styles.map}
        initialRegion={calculateInitialRegion()}
        provider="google"
        showsMyLocationButton={false}
        showsCompass={false}
        showsIndoors={false}
        customMapStyle={customMapStyle}
        showsUserLocation
        onMapReady={() => {
          setMapReady(true);
          fitToMarkers();
        }}
        onRegionChange={() => {
          isUserInteractingRef.current = true;
        }}
        onRegionChangeComplete={() => {
          isUserInteractingRef.current = false;
        }}
      >
        {mapReady && overlaysReady && routeCoords.length >= 2 ? (
          <Polyline
            coordinates={routeCoords}
            strokeColor={status === "START" ? "#16a34a" : "#0284c7"}
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
            <Image
              source={require("@/assets/icons/marker.png")}
              style={styles.pinImage}
            />
          </Marker>
        ) : null}

        {mapReady && overlaysReady && riderCoord ? (
          <Marker coordinate={riderCoord} anchor={{ x: 0.5, y: 0.5 }} zIndex={3} tracksViewChanges={false}>
            <NearbyVehicleMarker type={vehicleMarkerType} rotation={rider?.heading || 0} />
          </Marker>
        ) : null}
      </MapView>

      {(status === "START" || status === "ARRIVED" || status === "IN_PROGRESS") && (
        <TouchableOpacity style={styles.navFab} onPress={openNavigationApp} activeOpacity={0.9}>
          <Ionicons name="navigate" size={22} color="#fff" />
          <CustomText fontFamily="Bold" fontSize={13} style={{ color: "#fff", marginLeft: 8 }}>
            Directions
          </CustomText>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[mapStyles.gpsButton, styles.refitBtn]} onPress={fitToMarkers} activeOpacity={0.85}>
        <MaterialCommunityIcons name="crosshairs-gps" size={RFValue(16)} color="#3C75BE" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  navFab: {
    position: "absolute",
    bottom: MAP_BOTTOM_PAD - 58,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f766e",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 8,
  },
  refitBtn: {
    bottom: MAP_BOTTOM_PAD - 8,
    zIndex: 8,
  },
  pinLabel: {
    backgroundColor: "rgba(15,23,42,0.75)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 2,
    alignSelf: "center",
  },
  pinLabelActive: {
    backgroundColor: Colors.primary,
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
