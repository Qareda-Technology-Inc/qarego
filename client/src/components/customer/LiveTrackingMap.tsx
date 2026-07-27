import { View, Image, TouchableOpacity, Platform } from "react-native";
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView, { Marker, Callout } from "react-native-maps";
import { customMapStyle, indiaIntialRegion } from "@/utils/CustomMap";
import MapDrivingRoute, { riderNearRoute } from "@/components/shared/MapDrivingRoute";
import NearbyVehicleMarker from "@/components/customer/NearbyVehicleMarker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RFValue } from "react-native-responsive-fontsize";
import { mapStyles } from "@/styles/mapStyles";
import CustomText from "../shared/CustomText";
import { parseRideParcelMode } from "@/utils/parcelMode";
import { getCustomerRiderMapStatus, getCustomerRouteLabels } from "@/utils/customerCourierUi";
import { getVehicleMarkerType } from "@/utils/mapUtils";
import { coordKey } from "@/utils/mapDirections";
import { useStableMapCoord } from "@/hooks/useStableMapCoord";

const ACTIVE_STATUSES = new Set(["START", "ARRIVED", "IN_PROGRESS"]);

const LiveTrackingMap: FC<{
  height: number;
  drop: any;
  pickup: any;
  rider: any;
  status: string;
  serviceType?: string;
  parcelMode?: string;
  storeVertical?: string;
  courierRevision?: number;
  vehicle?: string;
}> = ({
  drop,
  status,
  height,
  pickup,
  rider,
  serviceType,
  parcelMode,
  storeVertical,
  courierRevision = 0,
  vehicle = "motorcycle",
}) => {
  const isParcel = serviceType === "DELIVERY";
  const riderMapStatus = getCustomerRiderMapStatus(
    parseRideParcelMode({ serviceType, parcelMode }),
    status,
    serviceType,
    storeVertical
  );
  const routeLabels = getCustomerRouteLabels({ serviceType, parcelMode });
  const mapRef = useRef<MapView>(null);
  const mountedRef = useRef(true);
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFittedRef = useRef(false);
  const isUserInteractingRef = useRef(false);
  const lastCameraAtRef = useRef(0);
  const lastCameraCoordRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [overlaysReady, setOverlaysReady] = useState(false);

  const pickupKey = coordKey(pickup);
  const dropKey = coordKey(drop);
  const riderKey = coordKey(rider);

  const pickupCoord = useStableMapCoord(pickup);
  const dropCoord = useStableMapCoord(drop);
  const riderCoord = useStableMapCoord(rider);

  const showRiderOnMap = useMemo(
    () => riderNearRoute(riderCoord, pickupCoord, dropCoord),
    [riderKey, pickupKey, dropKey, riderCoord, pickupCoord, dropCoord]
  );
  const isActiveRide = ACTIVE_STATUSES.has(status);
  const isCompleted = status === "COMPLETED";
  const showRiderMarker = isActiveRide && !!riderCoord;
  const vehicleMarkerType = getVehicleMarkerType(vehicle);

  /**
   * Keep a single Directions/Polyline child mounted across status changes.
   * Swapping multiple MapDrivingRoute instances on COMPLETED unmounts native
   * Directions mid-flight and can kill the iOS process.
   */
  const activeRoute = useMemo(() => {
    if (isCompleted && pickupCoord && dropCoord) {
      return {
        origin: pickupCoord,
        destination: dropCoord,
        strokeColor: "#EDD228",
      };
    }
    if (
      (status === "START" || (status === "ARRIVED" && serviceType === "RIDE")) &&
      showRiderOnMap &&
      riderCoord &&
      pickupCoord
    ) {
      return { origin: riderCoord, destination: pickupCoord, strokeColor: "#4CAF50" };
    }
    if (
      (status === "IN_PROGRESS" ||
        (status === "ARRIVED" && (serviceType === "FOOD" || serviceType === "DELIVERY"))) &&
      showRiderOnMap &&
      riderCoord &&
      dropCoord
    ) {
      return { origin: riderCoord, destination: dropCoord, strokeColor: "#2196F3" };
    }
    if (status === "IN_PROGRESS" && pickupCoord && dropCoord) {
      return { origin: pickupCoord, destination: dropCoord, strokeColor: "#FF9800" };
    }
    if (pickupCoord && dropCoord) {
      return { origin: pickupCoord, destination: dropCoord, strokeColor: "#94a3b8" };
    }
    return null;
  }, [
    isCompleted,
    status,
    serviceType,
    showRiderOnMap,
    riderCoord,
    pickupCoord,
    dropCoord,
  ]);

  const fitToMarkers = useCallback(async () => {
    if (!mountedRef.current || isUserInteractingRef.current) return;
    if (isCompleted) return;

    const coordinates: { latitude: number; longitude: number }[] = [];
    if (pickupCoord) coordinates.push(pickupCoord);
    if (dropCoord) coordinates.push(dropCoord);
    if (showRiderMarker && riderCoord) coordinates.push(riderCoord);
    if (coordinates.length === 0) return;

    try {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 72, right: 48, bottom: 120, left: 48 },
        animated: true,
      });
      hasFittedRef.current = true;
    } catch {
      /* native not ready / torn down */
    }
  }, [dropCoord, pickupCoord, riderCoord, showRiderMarker, isCompleted]);

  const scheduleFit = useCallback(() => {
    if (isCompleted) return;
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => {
      void fitToMarkers();
    }, 600);
  }, [fitToMarkers, isCompleted]);

  const calculateInitialRegion = () => {
    if (riderCoord && dropCoord) {
      return {
        latitude: (riderCoord.latitude + dropCoord.latitude) / 2,
        longitude: (riderCoord.longitude + dropCoord.longitude) / 2,
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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pickupKey || !dropKey || isCompleted) return;
    if (!hasFittedRef.current) scheduleFit();
  }, [dropKey, pickupKey, status, scheduleFit, isCompleted]);

  useEffect(() => {
    // Never animate camera after the trip ends — fights Modal presentation on iOS.
    if (!riderCoord || !isActiveRide || isUserInteractingRef.current) return;
    if (!mountedRef.current) return;
    const now = Date.now();
    const prev = lastCameraCoordRef.current;
    const movedEnough =
      !prev ||
      Math.abs(prev.latitude - riderCoord.latitude) > 0.00025 ||
      Math.abs(prev.longitude - riderCoord.longitude) > 0.00025;
    if (!movedEnough || now - lastCameraAtRef.current < 2500) return;
    lastCameraAtRef.current = now;
    lastCameraCoordRef.current = riderCoord;
    try {
      mapRef.current?.animateCamera(
        {
          center: riderCoord,
          zoom: 15,
        },
        { duration: 800 }
      );
    } catch {
      /* ignore */
    }
  }, [riderKey, courierRevision, isActiveRide, riderCoord]);

  useEffect(() => {
    if (!mapReady) {
      setOverlaysReady(false);
      return;
    }
    // Keep overlays up on COMPLETED — don't tear markers down for a remount cycle.
    if (isCompleted) {
      setOverlaysReady(true);
      return;
    }
    const t = setTimeout(() => setOverlaysReady(true), 320);
    return () => clearTimeout(t);
  }, [mapReady, isCompleted, pickupKey, dropKey, riderKey]);

  return (
    <View style={{ height, width: "100%", backgroundColor: "#E8EEF5" }} pointerEvents={isCompleted ? "box-none" : "auto"}>
      <MapView
        ref={mapRef}
        // Never flip follows/showsUserLocation when the ride ends — that native
        // toggle during overlay teardown is a common iOS process kill.
        followsUserLocation={false}
        showsUserLocation={false}
        style={{ flex: 1, width: "100%", height: "100%" }}
        initialRegion={calculateInitialRegion()}
        provider="google"
        showsMyLocationButton={false}
        showsCompass={false}
        showsIndoors={false}
        customMapStyle={Platform.OS === "ios" ? customMapStyle : undefined}
        rotateEnabled={false}
        pitchEnabled={false}
        onMapReady={() => {
          setMapReady(true);
          scheduleFit();
        }}
        onPanDrag={() => {
          isUserInteractingRef.current = true;
        }}
        onRegionChangeComplete={() => {
          setTimeout(() => {
            isUserInteractingRef.current = false;
          }, 800);
        }}
      >
        {mapReady && overlaysReady && activeRoute ? (
          <MapDrivingRoute
            origin={activeRoute.origin}
            destination={activeRoute.destination}
            strokeColor={activeRoute.strokeColor}
            strokeWidth={5}
            onReady={isCompleted ? undefined : scheduleFit}
          />
        ) : null}

        {mapReady && overlaysReady && dropCoord ? (
          <Marker
            coordinate={dropCoord}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={1}
            tracksViewChanges={false}
            title={routeLabels.dropLabel}
            description={drop?.address || routeLabels.dropLabel}
          >
            <Image
              source={require("@/assets/icons/drop_marker.png")}
              style={{ height: 30, width: 30, resizeMode: "contain" }}
            />
            <Callout tooltip>
              <View style={{ padding: 10, maxWidth: 220, backgroundColor: "white", borderRadius: 8 }}>
                <CustomText fontFamily="SemiBold" fontSize={13} style={{ marginBottom: 6, color: "#333" }}>
                  {routeLabels.dropLabel}
                </CustomText>
                <CustomText fontSize={11} numberOfLines={3} style={{ color: "#666" }}>
                  {drop?.address || routeLabels.dropLabel}
                </CustomText>
              </View>
            </Callout>
          </Marker>
        ) : null}

        {mapReady && overlaysReady && pickupCoord ? (
          <Marker
            coordinate={pickupCoord}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={2}
            tracksViewChanges={false}
            title={routeLabels.pickupLabel}
            description={pickup?.address || routeLabels.pickupLabel}
          >
            <Image
              source={require("@/assets/icons/marker.png")}
              style={{ height: 30, width: 30, resizeMode: "contain" }}
            />
            <Callout tooltip>
              <View style={{ padding: 10, maxWidth: 220, backgroundColor: "white", borderRadius: 8 }}>
                <CustomText fontFamily="SemiBold" fontSize={13} style={{ marginBottom: 6, color: "#333" }}>
                  {routeLabels.pickupLabel}
                </CustomText>
                <CustomText fontSize={11} numberOfLines={3} style={{ color: "#666" }}>
                  {pickup?.address || routeLabels.pickupLabel}
                </CustomText>
              </View>
            </Callout>
          </Marker>
        ) : null}

        {mapReady && overlaysReady && showRiderMarker && riderCoord ? (
          <Marker
            key="courier-marker"
            coordinate={riderCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={3}
            title={isParcel ? "Your courier" : "Your rider"}
            description={riderMapStatus}
            tracksViewChanges={false}
          >
            <NearbyVehicleMarker type={vehicleMarkerType} rotation={rider?.heading || 0} />
          </Marker>
        ) : null}
      </MapView>

      {!isCompleted ? (
        <TouchableOpacity style={mapStyles.gpsButton} onPress={fitToMarkers}>
          <MaterialCommunityIcons name="crosshairs-gps" size={RFValue(16)} color="#3C75BE" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default LiveTrackingMap;
