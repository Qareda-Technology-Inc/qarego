import { View, Image, TouchableOpacity, Alert, Linking, StyleSheet } from "react-native";
import React, { FC, memo, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import MapView, { Marker, Region } from "react-native-maps";
import { useUserStore } from "@/store/userStore";
import { customMapStyle, indiaIntialRegion } from "@/utils/CustomMap";
import { reverseGeocode } from "@/utils/mapUtils";
import { getCurrentLocationAsync } from "@/utils/locationUtils";
import haversine from "haversine-distance";
import { mapStyles } from "@/styles/mapStyles";
import { FontAwesome6, MaterialCommunityIcons } from "@expo/vector-icons";
import { RFValue } from "react-native-responsive-fontsize";
import NearbyVehicleMarker, {
  type NearbyVehicleType,
} from "@/components/customer/NearbyVehicleMarker";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";

type NearbyMarker = {
  id: string | number;
  latitude: number;
  longitude: number;
  type: NearbyVehicleType;
  rotation: number;
  visible: boolean;
};

const DraggableMap: FC<{ height: number }> = ({ height }) => {
  const isFocused = useIsFocused();
  const [markers, setMarkers] = useState<NearbyMarker[]>([]);
  const mapRef = useRef<MapView>(null);
  const { setLocation, location, outOfRange, setOutOfRange } = useUserStore();
  const MAX_DISTANCE_THRESHOLD = 10000;

  useEffect(() => {
    (async () => {
      if (!isFocused) return;
      const result = await getCurrentLocationAsync();
      if (result.ok) {
        const { latitude, longitude } = result;
        mapRef.current?.fitToCoordinates([{ latitude, longitude }], {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        handleRegionChangeComplete(newRegion);
      }
    })();
  }, [mapRef, isFocused]);

  const generateRandomMarkers = () => {
    if (!location?.latitude || !location?.longitude || outOfRange) return;

    const types: NearbyVehicleType[] = ["bike", "auto", "cab"];
    const newMarkers: NearbyMarker[] = Array.from({ length: 14 }, (_, index) => {
      const randomType = types[Math.floor(Math.random() * types.length)];
      const randomRotation = Math.floor(Math.random() * 360);

      return {
        id: `nearby-${index}`,
        latitude: location.latitude + (Math.random() - 0.5) * 0.008,
        longitude: location.longitude + (Math.random() - 0.5) * 0.008,
        type: randomType,
        rotation: randomRotation,
        visible: true,
      };
    });
    setMarkers(newMarkers);
  };

  useEffect(() => {
    generateRandomMarkers();
  }, [location, outOfRange]);

  const handleRegionChangeComplete = async (newRegion: Region) => {
    try {
      const address = await reverseGeocode(
        newRegion.latitude,
        newRegion.longitude
      );

      const currentLocation = location;
      setLocation({
        latitude: newRegion.latitude,
        longitude: newRegion.longitude,
        address: address,
      });

      if (currentLocation?.latitude && currentLocation?.longitude) {
        const newLocation = {
          latitude: newRegion.latitude,
          longitude: newRegion.longitude,
        };
        const distance = haversine(
          { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
          newLocation
        );
        setOutOfRange(distance > MAX_DISTANCE_THRESHOLD);
      }
    } catch (error) {
      console.error("Error in handleRegionChangeComplete:", error);
    }
  };

  const handleGpsButtonPress = async () => {
    const result = await getCurrentLocationAsync();
    if (!result.ok) {
      Alert.alert(
        "Location unavailable",
        result.message,
        result.canOpenSettings
          ? [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          : [{ text: "OK" }]
      );
      return;
    }
    const { latitude, longitude } = result;
    mapRef.current?.fitToCoordinates([{ latitude, longitude }], {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
    try {
      const address = await reverseGeocode(latitude, longitude);
      setLocation({ latitude, longitude, address });
    } catch {
      setLocation({ latitude, longitude, address: "" });
    }
  };

  return (
    <View style={{ height, width: "100%", backgroundColor: T.surfaceMuted }}>
      <MapView
        ref={mapRef}
        maxZoomLevel={16}
        minZoomLevel={12}
        pitchEnabled={false}
        onRegionChangeComplete={handleRegionChangeComplete}
        style={{ flex: 1, width: "100%", height: "100%" }}
        initialRegion={indiaIntialRegion}
        provider="google"
        showsMyLocationButton={false}
        showsCompass={false}
        showsIndoors={false}
        showsIndoorLevelPicker={false}
        showsTraffic={false}
        showsScale={false}
        showsBuildings={false}
        showsPointsOfInterest={false}
        customMapStyle={customMapStyle}
        showsUserLocation
      >
        {markers
          .filter((marker) => marker.latitude && marker.longitude && marker.visible)
          .map((marker) => (
            <Marker
              key={String(marker.id)}
              zIndex={2}
              flat
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              coordinate={{
                latitude: marker.latitude,
                longitude: marker.longitude,
              }}
            >
              <NearbyVehicleMarker type={marker.type} rotation={marker.rotation} />
            </Marker>
          ))}
      </MapView>

      <View style={mapStyles.centerMarkerContainer} pointerEvents="none">
        <View style={styles.pickupPin}>
          <View style={styles.pickupPinStem} />
          <View style={styles.pickupPinHead}>
            <View style={styles.pickupPinDot} />
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[mapStyles.gpsButton, styles.gpsButton]}
        onPress={handleGpsButtonPress}
        activeOpacity={0.88}
      >
        <MaterialCommunityIcons
          name="crosshairs-gps"
          size={RFValue(18)}
          color={T.ink}
        />
      </TouchableOpacity>

      {outOfRange ? (
        <View style={[mapStyles.outOfRange, styles.outOfRange]}>
          <FontAwesome6 name="road-circle-exclamation" size={22} color={T.danger} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  pickupPin: {
    alignItems: "center",
    marginTop: -28,
    marginLeft: -1,
  },
  pickupPinHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: T.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    ...T.shadow.card,
  },
  pickupPinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.accent,
  },
  pickupPinStem: {
    width: 3,
    height: 10,
    backgroundColor: T.ink,
    borderRadius: 2,
    marginBottom: -2,
  },
  gpsButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    ...T.shadow.float,
  },
  outOfRange: {
    borderWidth: 1,
    borderColor: T.border,
  },
});

export default memo(DraggableMap);
