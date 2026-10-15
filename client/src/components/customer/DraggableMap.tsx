import { View } from "react-native";
import React, { FC, memo, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import MapView from "react-native-maps";
import { useUserStore } from "@/store/userStore";
import { indiaIntialRegion } from "@/utils/CustomMap";
import { reverseGeocode } from "@/utils/mapUtils";
import { getCurrentLocationAsync } from "@/utils/locationUtils";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";

const DraggableMap: FC<{ height: number }> = ({ height }) => {
  const isFocused = useIsFocused();
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);
  const pendingFocusRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const { setLocation } = useUserStore();

  const focusUserRegion = (latitude: number, longitude: number) => {
    if (!mapReady || !mapRef.current) {
      pendingFocusRef.current = { latitude, longitude };
      return;
    }
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      550
    );
  };

  useEffect(() => {
    (async () => {
      if (!isFocused) return;
      const result = await getCurrentLocationAsync();
      if (result.ok) {
        const { latitude, longitude } = result;
        focusUserRegion(latitude, longitude);
        try {
          const address = await reverseGeocode(latitude, longitude);
          setLocation({ latitude, longitude, address });
        } catch {
          setLocation({ latitude, longitude, address: "" });
        }
      }
    })();
  }, [mapRef, isFocused, setLocation, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    mapRef.current?.animateToRegion(
      {
        latitude: pending.latitude,
        longitude: pending.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      550
    );
  }, [mapReady]);


  return (
    <View style={{ height, width: "100%", backgroundColor: T.surfaceMuted }}>
      <MapView
        ref={mapRef}
        pitchEnabled={false}
        style={{ flex: 1, width: "100%", height: "100%" }}
        initialRegion={indiaIntialRegion}
        provider="google"
        followsUserLocation={false}
        onMapReady={() => setMapReady(true)}
        showsMyLocationButton={false}
        showsCompass={false}
        showsIndoors={false}
        showsIndoorLevelPicker={false}
        showsTraffic={false}
        showsScale={false}
        showsBuildings
        showsPointsOfInterests
        showsUserLocation
      />
    </View>
  );
};

export default memo(DraggableMap);
