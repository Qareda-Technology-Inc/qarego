import React, { FC, useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { customMapStyle } from "@/utils/CustomMap";
import { reverseGeocode } from "@/utils/mapUtils";
import { DS } from "@/theme/designSystem";

const MAP_DELTA = 0.0022;

type Props = {
  latitude: number;
  longitude: number;
  storeLatitude?: number;
  storeLongitude?: number;
  onLocationChange: (coords: { latitude: number; longitude: number; address: string }) => void;
  accent?: string;
};

const FoodCartMiniMap: FC<Props> = ({
  latitude,
  longitude,
  storeLatitude,
  storeLongitude,
  onLocationChange,
  accent = "#f97316",
}) => {
  const mapRef = useRef<MapView>(null);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSync = useRef(false);

  const region: Region = {
    latitude,
    longitude,
    latitudeDelta: MAP_DELTA,
    longitudeDelta: MAP_DELTA,
  };

  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
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

  const handleRegionChangeComplete = useCallback(
    (reg: Region) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setBusy(true);
        try {
          const address =
            (await reverseGeocode(reg.latitude, reg.longitude)) || "Selected location";
          skipNextSync.current = true;
          onLocationChange({
            latitude: reg.latitude,
            longitude: reg.longitude,
            address,
          });
        } finally {
          setBusy(false);
        }
      }, 400);
    },
    [onLocationChange]
  );

  const hasStorePin =
    typeof storeLatitude === "number" &&
    typeof storeLongitude === "number" &&
    !Number.isNaN(storeLatitude) &&
    !Number.isNaN(storeLongitude);

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        customMapStyle={customMapStyle}
        onRegionChangeComplete={handleRegionChangeComplete}
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
      <View style={styles.pinWrap} pointerEvents="none">
        <View style={[styles.pin, { backgroundColor: accent }]} />
        <View style={[styles.pinStem, { backgroundColor: accent }]} />
      </View>
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator size="small" color={accent} />
        </View>
      ) : null}
    </View>
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
  busy: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    padding: 6,
  },
});

export default FoodCartMiniMap;
