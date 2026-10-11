import React, { FC, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "../shared/CustomText";
import { customMapStyle } from "@/utils/CustomMap";
import { DS } from "@/theme/designSystem";

const MAP_DELTA = 0.0022;

type Props = {
  latitude: number;
  longitude: number;
  storeLatitude?: number;
  storeLongitude?: number;
  /** Opens the full-screen location picker. */
  onPress: () => void;
  accent?: string;
};

/**
 * Read-only preview of the delivery pin in the cart. Gestures are disabled so
 * scrolling the cart can never move the pin; tapping opens the full picker.
 */
const FoodCartMiniMap: FC<Props> = ({
  latitude,
  longitude,
  storeLatitude,
  storeLongitude,
  onPress,
  accent = "#f97316",
}) => {
  const mapRef = useRef<MapView>(null);

  const region: Region = {
    latitude,
    longitude,
    latitudeDelta: MAP_DELTA,
    longitudeDelta: MAP_DELTA,
  };

  useEffect(() => {
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: MAP_DELTA,
        longitudeDelta: MAP_DELTA,
      },
      280
    );
  }, [latitude, longitude]);

  const hasStorePin =
    typeof storeLatitude === "number" &&
    typeof storeLongitude === "number" &&
    !Number.isNaN(storeLatitude) &&
    !Number.isNaN(storeLongitude);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Change delivery location"
    >
      <View style={styles.map} pointerEvents="none">
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          customMapStyle={customMapStyle}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {hasStorePin ? (
            <Marker
              coordinate={{ latitude: storeLatitude!, longitude: storeLongitude! }}
              title="Store"
              pinColor="#6366f1"
            />
          ) : null}
        </MapView>
      </View>
      <View style={styles.pinWrap} pointerEvents="none">
        <View style={[styles.pin, { backgroundColor: accent }]} />
        <View style={[styles.pinStem, { backgroundColor: accent }]} />
      </View>
      <View style={styles.chip} pointerEvents="none">
        <Ionicons name="create-outline" size={14} color={accent} />
        <CustomText fontFamily="SemiBold" fontSize={12} style={{ color: accent }}>
          Adjust pin
        </CustomText>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: {
    height: 140,
    borderRadius: DS.radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: DS.color.border,
  },
  pressed: {
    opacity: 0.9,
  },
  map: { ...StyleSheet.absoluteFillObject },
  pinWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  pin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#fff",
  },
  pinStem: {
    width: 2,
    height: 10,
    marginTop: -1,
    opacity: 0.85,
  },
  chip: {
    position: "absolute",
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: DS.radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
});

export default FoodCartMiniMap;
