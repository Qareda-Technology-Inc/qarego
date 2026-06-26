import React, { FC, memo } from "react";
import { View, Image, StyleSheet, ImageSourcePropType } from "react-native";

export type NearbyVehicleType = "bike" | "auto" | "cab";

const VEHICLE_ICONS: Record<NearbyVehicleType, ImageSourcePropType> = {
  bike: require("@/assets/icons/bike_marker.png"),
  auto: require("@/assets/icons/auto_marker.png"),
  cab: require("@/assets/icons/cab_marker.png"),
};

type Props = {
  type: NearbyVehicleType;
  rotation?: number;
};

/** Top-down vehicle icon marker (no surrounding puck). */
const NearbyVehicleMarker: FC<Props> = ({ type, rotation = 0 }) => {
  return (
    <View style={[styles.wrap, { transform: [{ rotate: `${rotation}deg` }] }]}>
      <View style={styles.iconWrap}>
        <Image source={VEHICLE_ICONS[type]} style={styles.icon} />
      </View>
    </View>
  );
};

const ICON = 30;

const styles = StyleSheet.create({
  wrap: {
    width: ICON + 8,
    height: ICON + 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: ICON,
    height: ICON,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: ICON,
    height: ICON,
    resizeMode: "contain",
  },
});

export default memo(NearbyVehicleMarker);
