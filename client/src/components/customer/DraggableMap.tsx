import { View } from "react-native";
import React, { FC, memo, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import MapView, { Marker } from "react-native-maps";
import { useUserStore } from "@/store/userStore";
import { indiaIntialRegion } from "@/utils/CustomMap";
import { reverseGeocode } from "@/utils/mapUtils";
import { getCurrentLocationAsync } from "@/utils/locationUtils";
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
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);
  const pendingFocusRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const { setLocation, location } = useUserStore();

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

  const generateRandomMarkers = () => {
    if (!location?.latitude || !location?.longitude) return;

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
  }, [location]);

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
        showsPointsOfInterest
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
    </View>
  );
};

export default memo(DraggableMap);
