import { View, TouchableOpacity, Image, Linking, Platform, Alert } from "react-native";
import React, { FC, memo, useEffect, useRef, useState } from "react";
import MapView, { Marker, Polyline, Callout } from "react-native-maps";
import { customMapStyle, indiaIntialRegion } from "@/utils/CustomMap";
import CustomText from "../shared/CustomText";
import { FontAwesome6, MaterialCommunityIcons } from "@expo/vector-icons";
import { RFValue } from "react-native-responsive-fontsize";
import { mapStyles } from "@/styles/mapStyles";
import { Colors } from "@/utils/Constants";
import { getPoints, getVehicleMarkerType } from "@/utils/mapUtils";
import NearbyVehicleMarker from "@/components/customer/NearbyVehicleMarker";
import {
  getRiderDropLabel,
  getRiderPickupLabel,
  isFoodDelivery,
  RiderOfferRide,
} from "@/utils/riderRideUtils";
import { parseRideParcelMode } from "@/utils/parcelMode";
import MapDrivingRoute, {
  parseMapCoord,
  riderNearRoute,
} from "@/components/shared/MapDrivingRoute";

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
}> = ({ drop, status, pickup, rider, vehicle, serviceType, parcelMode, restaurantName, storeVertical, foodOrderSummary }) => {
  const rideMeta: RiderOfferRide = { serviceType, parcelMode, storeVertical, restaurantName, foodOrderSummary };
  const food = isFoodDelivery(rideMeta);
  const isParcel = serviceType === "DELIVERY";
  const receiveParcel = isParcel && parseRideParcelMode(rideMeta) === "RECEIVE";
  const pickupLabel = getRiderPickupLabel(rideMeta);
  const dropLabel = getRiderDropLabel(rideMeta);
  const vehicleMarkerType = getVehicleMarkerType(vehicle ?? "motorcycle");
  const mapRef = useRef<MapView>(null);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  const pickupCoord = parseMapCoord(pickup);
  const dropCoord = parseMapCoord(drop);
  const riderCoord = parseMapCoord(rider);
  const showRiderOnMap = riderNearRoute(riderCoord, pickupCoord, dropCoord);

  const fitToMarkers = async () => {
    if (isUserInteracting) return;

    const coordinates: { latitude: number; longitude: number }[] = [];

    if (pickupCoord) coordinates.push(pickupCoord);
    if (dropCoord) coordinates.push(dropCoord);

    if (showRiderOnMap && riderCoord) {
      coordinates.push(riderCoord);
    }

    if (coordinates.length === 0) return;

    try {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    } catch (error) {
      console.error("Error fitting to markers:", error);
    }
  };

  const fitToMarkersWithDelay = () => {
    setTimeout(() => {
      fitToMarkers();
    }, 500);
  };

  const openNavigationApp = () => {
    if (!pickup?.latitude || !drop?.latitude) {
      Alert.alert("Error", "Location information not available");
      return;
    }

    // Determine destination based on status
    let destination;
    if (status === "START") {
      destination = pickup; // Going to pickup
    } else if (status === "ARRIVED" || status === "IN_PROGRESS") {
      destination = drop; // Going to drop
    } else {
      destination = drop;
    }
    const destinationLat = destination.latitude;
    const destinationLon = destination.longitude;

    // Try to open in Google Maps first, fallback to Apple Maps on iOS
    const googleMapsUrl = Platform.select({
      ios: `maps://app?daddr=${destinationLat},${destinationLon}&directionsmode=driving`,
      android: `google.navigation:q=${destinationLat},${destinationLon}`,
    });

    const appleMapsUrl = `maps://app?daddr=${destinationLat},${destinationLon}&directionsmode=driving`;
    const webMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLon}&travelmode=driving`;

    if (Platform.OS === "ios") {
      // Try Apple Maps first on iOS
      Linking.canOpenURL(appleMapsUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(appleMapsUrl);
          } else {
            // Fallback to Google Maps
            return Linking.openURL(googleMapsUrl || webMapsUrl);
          }
        })
        .catch(() => {
          // Final fallback to web
          Linking.openURL(webMapsUrl);
        });
    } else {
      // Android - try Google Maps
      Linking.canOpenURL(googleMapsUrl || webMapsUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(googleMapsUrl || webMapsUrl);
          } else {
            // Fallback to web
            return Linking.openURL(webMapsUrl);
          }
        })
        .catch(() => {
          Linking.openURL(webMapsUrl);
        });
    }
  };

  const calculateInitialRegion = () => {
    if (pickupCoord && dropCoord) {
      const latitude = (pickupCoord.latitude + dropCoord.latitude) / 2;
      const longitude = (pickupCoord.longitude + dropCoord.longitude) / 2;
      return {
        latitude,
        longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return indiaIntialRegion;
  };

  useEffect(() => {
    if (pickupCoord && dropCoord) fitToMarkers();
  }, [dropCoord?.latitude, pickupCoord?.latitude, riderCoord?.latitude, status]);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        followsUserLocation
        style={{ flex: 1 }}
        initialRegion={calculateInitialRegion()}
        provider="google"
        showsMyLocationButton={false}
        showsCompass={false}
        showsIndoors={false}
        customMapStyle={customMapStyle}
        showsUserLocation={true}
        onRegionChange={() => setIsUserInteracting(true)}
        onRegionChangeComplete={() => setIsUserInteracting(false)}
      >
        {status === "START" && showRiderOnMap && riderCoord && pickupCoord ? (
          <MapDrivingRoute
            origin={riderCoord}
            destination={pickupCoord}
            strokeColor="#4CAF50"
            strokeWidth={6}
            onReady={fitToMarkersWithDelay}
          />
        ) : null}

        {pickupCoord && dropCoord && (status === "IN_PROGRESS" || status === "ARRIVED") ? (
          <MapDrivingRoute
            origin={pickupCoord}
            destination={dropCoord}
            strokeColor="#FF9800"
            strokeWidth={6}
            onReady={fitToMarkersWithDelay}
          />
        ) : null}

        {status === "IN_PROGRESS" && showRiderOnMap && riderCoord && dropCoord ? (
          <MapDrivingRoute
            origin={riderCoord}
            destination={dropCoord}
            strokeColor="#2196F3"
            strokeWidth={5}
            lineDashPattern={[5, 5]}
            onReady={fitToMarkersWithDelay}
          />
        ) : null}

        {dropCoord && (
          <Marker
            coordinate={dropCoord}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={1}
            tracksViewChanges={false}
            title={`End · ${dropLabel}`}
            description={drop?.address || "Drop location"}
          >
            <Image
              source={require("@/assets/icons/drop_marker.png")}
              style={{ height: 30, width: 30, resizeMode: "contain" }}
            />
            <Callout tooltip>
              <View style={{ padding: 10, maxWidth: 220, backgroundColor: "white", borderRadius: 8 }}>
                <CustomText fontFamily="SemiBold" fontSize={13} style={{ marginBottom: 6, color: "#333" }}>
                  End point · {dropLabel}
                </CustomText>
                <CustomText fontSize={11} numberOfLines={3} style={{ color: "#666" }}>
                  {drop?.address || "Drop location"}
                </CustomText>
              </View>
            </Callout>
          </Marker>
        )}

        {pickupCoord && (
          <Marker
            coordinate={pickupCoord}
            anchor={{ x: 0.5, y: 1 }}
            zIndex={2}
            tracksViewChanges={false}
            title={`Start · ${pickupLabel}`}
            description={pickup?.address || "Pickup location"}
          >
            <Image
              source={require("@/assets/icons/marker.png")}
              style={{ height: 30, width: 30, resizeMode: "contain" }}
            />
            <Callout tooltip>
              <View style={{ padding: 10, maxWidth: 220, backgroundColor: "white", borderRadius: 8 }}>
                <CustomText fontFamily="SemiBold" fontSize={13} style={{ marginBottom: 6, color: "#333" }}>
                  Start point · {pickupLabel}
                </CustomText>
                <CustomText fontSize={11} numberOfLines={3} style={{ color: "#666" }}>
                  {pickup?.address || "Pickup location"}
                </CustomText>
              </View>
            </Callout>
          </Marker>
        )}

        {showRiderOnMap && riderCoord && (
          <Marker
            coordinate={riderCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={3}
            tracksViewChanges={false}
          >
            <NearbyVehicleMarker type={vehicleMarkerType} rotation={rider?.heading || 0} />
            <Callout>
              <View style={{ padding: 8, maxWidth: 150 }}>
                <CustomText fontFamily="SemiBold" fontSize={12} style={{ marginBottom: 4 }}>
                  Your Location
                </CustomText>
                <CustomText fontSize={10}>
                  {status === "START"
                    ? food
                      ? "Heading to restaurant"
                      : isParcel
                        ? receiveParcel
                          ? "Heading to collect parcel"
                          : "Heading to sender"
                        : "Heading to pickup"
                    : status === "ARRIVED"
                    ? food
                      ? "At restaurant"
                      : isParcel
                        ? receiveParcel
                          ? "Parcel collected"
                          : "Parcel collected from sender"
                        : "At pickup location"
                    : status === "IN_PROGRESS"
                    ? isParcel
                      ? receiveParcel
                        ? "Delivering to customer"
                        : "Delivering to recipient"
                      : "On the way to destination"
                    : "On the way"}
                </CustomText>
              </View>
            </Callout>
          </Marker>
        )}

        {dropCoord && pickupCoord && !showRiderOnMap ? (
          <Polyline
            coordinates={getPoints([dropCoord, pickupCoord])}
            strokeColor={Colors.text}
            strokeWidth={2}
            geodesic
            lineDashPattern={[12, 10]}
          />
        ) : null}
      </MapView>

      {(status === "START" || status === "ARRIVED" || status === "IN_PROGRESS") && (
        <TouchableOpacity style={mapStyles.gpsLiveButton} onPress={openNavigationApp}>
          <CustomText fontFamily="SemiBold" fontSize={10}>
            Open Live GPS
          </CustomText>
          <FontAwesome6 name="location-arrow" size={RFValue(12)} color="#000" />
        </TouchableOpacity>
      )}

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

export default memo(RiderLiveTracking);
