import React, { FC, useCallback, useEffect, useRef } from "react";
import { View, Image, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { customMapStyle, indiaIntialRegion } from "@/utils/CustomMap";
import MapDrivingRoute from "@/components/shared/MapDrivingRoute";
import LiveTrackingMap from "@/components/customer/LiveTrackingMap";
import type { FoodOrderMapPoint } from "@/utils/foodOrderTracking";
import { coordKey } from "@/utils/mapDirections";
import { useStableMapCoord } from "@/hooks/useStableMapCoord";

type LiveRideProps = {
  mode: "live";
  height: number;
  pickup: FoodOrderMapPoint;
  drop: FoodOrderMapPoint;
  rideStatus: string;
  rider: { latitude: number; longitude: number; heading?: number } | null;
  storeVertical?: string;
  courierRevision?: number;
  vehicle?: string;
  overlayBottom?: number;
};

type EdgePadding = { top: number; right: number; bottom: number; left: number };

type StaticProps = {
  mode: "static";
  height: number;
  pickup: FoodOrderMapPoint;
  drop: FoodOrderMapPoint;
  /** Space covered by overlays (status bar, cards) so both pins stay visible. */
  edgePadding?: EdgePadding;
};

const DEFAULT_EDGE_PADDING: EdgePadding = { top: 80, right: 48, bottom: 160, left: 48 };

type Props = LiveRideProps | StaticProps;

const FoodOrderStaticMap: FC<StaticProps> = ({
  height,
  pickup,
  drop,
  edgePadding = DEFAULT_EDGE_PADDING,
}) => {
  const mapRef = useRef<MapView>(null);
  const pickupCoord = useStableMapCoord(pickup);
  const dropCoord = useStableMapCoord(drop);
  const pickupKey = coordKey(pickup);
  const dropKey = coordKey(drop);

  const fitToMarkers = useCallback(() => {
    const coords = [pickupCoord, dropCoord].filter(Boolean) as {
      latitude: number;
      longitude: number;
    }[];
    if (coords.length === 0) return;
    mapRef.current?.fitToCoordinates(coords, { edgePadding, animated: true });
    // Refit only when a padding value changes, not on every new object from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropCoord, pickupCoord, edgePadding.top, edgePadding.right, edgePadding.bottom, edgePadding.left]);

  useEffect(() => {
    if (!pickupKey || !dropKey) return;
    const t = setTimeout(fitToMarkers, 400);
    return () => clearTimeout(t);
  }, [pickupKey, dropKey, fitToMarkers]);

  const initialRegion = () => {
    if (pickupCoord && dropCoord) {
      return {
        latitude: (pickupCoord.latitude + dropCoord.latitude) / 2,
        longitude: (pickupCoord.longitude + dropCoord.longitude) / 2,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }
    return indiaIntialRegion;
  };

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion()}
        provider="google"
        showsMyLocationButton={false}
        showsCompass={false}
        showsIndoors={false}
        customMapStyle={customMapStyle}
        showsUserLocation
        rotateEnabled={false}
        onMapReady={fitToMarkers}
      >
        {pickupCoord && dropCoord ? (
          <MapDrivingRoute
            origin={pickupCoord}
            destination={dropCoord}
            strokeColor="#00ccbc"
            strokeWidth={4}
            onReady={fitToMarkers}
          />
        ) : null}

        {dropCoord ? (
          <Marker coordinate={dropCoord} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <Image
              source={require("@/assets/icons/drop_marker.png")}
              style={styles.marker}
            />
          </Marker>
        ) : null}

        {pickupCoord ? (
          <Marker coordinate={pickupCoord} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <Image
              source={require("@/assets/icons/marker.png")}
              style={styles.marker}
            />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
};

const FoodOrderTrackingMap: FC<Props> = (props) => {
  if (props.mode === "live") {
    return (
      <LiveTrackingMap
        height={props.height}
        status={props.rideStatus}
        serviceType="FOOD"
        storeVertical={props.storeVertical}
        pickup={props.pickup}
        drop={props.drop}
        rider={props.rider}
        courierRevision={props.courierRevision}
        vehicle={props.vehicle}
        overlayBottom={props.overlayBottom}
      />
    );
  }

  return <FoodOrderStaticMap {...props} />;
};

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#e8ebeb",
  },
  map: {
    flex: 1,
    width: "100%",
  },
  marker: { height: 30, width: 30, resizeMode: "contain" },
});

export default FoodOrderTrackingMap;
