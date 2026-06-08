import { View, Image, TouchableOpacity } from "react-native";
import React, { FC, useCallback, useEffect, useRef, useState } from "react";
import MapView, { Marker, Callout } from "react-native-maps";
import { customMapStyle, indiaIntialRegion } from "@/utils/CustomMap";
import MapDrivingRoute, {
  parseMapCoord,
  riderNearRoute,
} from "@/components/shared/MapDrivingRoute";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RFValue } from "react-native-responsive-fontsize";
import { mapStyles } from "@/styles/mapStyles";
import CustomText from "../shared/CustomText";
import { parseRideParcelMode } from "@/utils/parcelMode";
import { getCustomerRiderMapStatus } from "@/utils/customerCourierUi";

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
}) => {
  const isParcel = serviceType === "DELIVERY";
  const riderMapStatus = getCustomerRiderMapStatus(
    parseRideParcelMode({ serviceType, parcelMode }),
    status,
    serviceType,
    storeVertical
  );
  const mapRef = useRef<MapView>(null);
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFittedRef = useRef(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  const pickupCoord = parseMapCoord(pickup);
  const dropCoord = parseMapCoord(drop);
  const riderCoord = parseMapCoord(rider);
  const showRiderOnMap = riderNearRoute(riderCoord, pickupCoord, dropCoord);
  const isActiveRide = ACTIVE_STATUSES.has(status);
  const showRiderMarker = isActiveRide && !!riderCoord;

  const fitToMarkers = useCallback(async () => {
    if (isUserInteracting) return;

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
    } catch (error) {
      console.error("Error fitting to markers:", error);
    }
  }, [dropCoord, pickupCoord, riderCoord, showRiderMarker, isUserInteracting]);

  const scheduleFit = useCallback(() => {
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => {
      fitToMarkers();
    }, 600);
  }, [fitToMarkers]);

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
    if (!pickupCoord || !dropCoord) return;
    if (!hasFittedRef.current) scheduleFit();
  }, [dropCoord?.latitude, dropCoord?.longitude, pickupCoord?.latitude, pickupCoord?.longitude, status, scheduleFit]);

  useEffect(() => {
    if (!riderCoord || !isActiveRide || isUserInteracting) return;
    mapRef.current?.animateCamera(
      {
        center: riderCoord,
        zoom: 15,
      },
      { duration: 500 }
    );
  }, [
    riderCoord?.latitude,
    riderCoord?.longitude,
    courierRevision,
    isActiveRide,
    isUserInteracting,
  ]);

  useEffect(
    () => () => {
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    },
    []
  );

  return (
    <View style={{ height, width: "100%" }}>
      <MapView
        ref={mapRef}
        followsUserLocation={!isActiveRide}
        style={{ flex: 1 }}
        initialRegion={calculateInitialRegion()}
        provider="google"
        showsMyLocationButton={false}
        showsCompass={false}
        showsIndoors={false}
        customMapStyle={customMapStyle}
        showsUserLocation={!isActiveRide}
        onRegionChange={() => setIsUserInteracting(true)}
        onRegionChangeComplete={() => setIsUserInteracting(false)}
      >
        {status === "START" && showRiderOnMap && riderCoord && pickupCoord ? (
          <MapDrivingRoute
            origin={riderCoord}
            destination={pickupCoord}
            strokeColor="#4CAF50"
            strokeWidth={5}
            onReady={scheduleFit}
          />
        ) : null}

        {(status === "IN_PROGRESS" || status === "ARRIVED") &&
        showRiderOnMap &&
        riderCoord &&
        dropCoord ? (
          <MapDrivingRoute
            origin={riderCoord}
            destination={dropCoord}
            strokeColor="#2196F3"
            strokeWidth={5}
            onReady={scheduleFit}
          />
        ) : null}

        {status === "IN_PROGRESS" && (!showRiderOnMap || !riderCoord) && pickupCoord && dropCoord ? (
          <MapDrivingRoute
            origin={pickupCoord}
            destination={dropCoord}
            strokeColor="#FF9800"
            strokeWidth={5}
            onReady={scheduleFit}
          />
        ) : null}

        {dropCoord ? (
          <Marker
            coordinate={dropCoord}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={1}
            tracksViewChanges={false}
            title="Drop Location"
            description={drop?.address || "Drop location"}
          >
            <Image
              source={require("@/assets/icons/drop_marker.png")}
              style={{ height: 30, width: 30, resizeMode: "contain" }}
            />
            <Callout tooltip>
              <View style={{ padding: 10, maxWidth: 220, backgroundColor: "white", borderRadius: 8 }}>
                <CustomText fontFamily="SemiBold" fontSize={13} style={{ marginBottom: 6, color: "#333" }}>
                  Drop Location
                </CustomText>
                <CustomText fontSize={11} numberOfLines={3} style={{ color: "#666" }}>
                  {drop?.address || "Drop location"}
                </CustomText>
              </View>
            </Callout>
          </Marker>
        ) : null}

        {pickupCoord ? (
          <Marker
            coordinate={pickupCoord}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={2}
            tracksViewChanges={false}
            title="Pickup Location"
            description={pickup?.address || "Pickup location"}
          >
            <Image
              source={require("@/assets/icons/marker.png")}
              style={{ height: 30, width: 30, resizeMode: "contain" }}
            />
            <Callout tooltip>
              <View style={{ padding: 10, maxWidth: 220, backgroundColor: "white", borderRadius: 8 }}>
                <CustomText fontFamily="SemiBold" fontSize={13} style={{ marginBottom: 6, color: "#333" }}>
                  Pickup Location
                </CustomText>
                <CustomText fontSize={11} numberOfLines={3} style={{ color: "#666" }}>
                  {pickup?.address || "Pickup location"}
                </CustomText>
              </View>
            </Callout>
          </Marker>
        ) : null}

        {showRiderMarker && riderCoord ? (
          <Marker
            key={`courier-${courierRevision}`}
            coordinate={riderCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={3}
            flat
            rotation={rider?.heading || 0}
            image={require("@/assets/icons/cab_marker.png")}
            title={isParcel ? "Your courier" : "Your rider"}
            description={riderMapStatus}
          />
        ) : null}
      </MapView>

      <TouchableOpacity style={mapStyles.gpsButton} onPress={fitToMarkers}>
        <MaterialCommunityIcons
          name="crosshairs-gps"
          size={RFValue(16)}
          color="#3C75BE"
        />
      </TouchableOpacity>
    </View>
  );
};

export default LiveTrackingMap;
