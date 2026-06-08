import React, { FC, memo } from "react";
import { View, Image, StyleSheet, ImageSourcePropType } from "react-native";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";

export type NearbyVehicleType = "bike" | "auto" | "cab";

const VEHICLE_ICONS: Record<NearbyVehicleType, ImageSourcePropType> = {
  bike: require("@/assets/icons/bike_marker.png"),
  auto: require("@/assets/icons/auto_marker.png"),
  cab: require("@/assets/icons/cab_marker.png"),
};

const VEHICLE_ACCENT: Record<NearbyVehicleType, string> = {
  bike: T.success,
  auto: T.ink,
  cab: T.accent,
};

type Props = {
  type: NearbyVehicleType;
  rotation?: number;
};

/** Bolt-style top-down vehicle puck for nearby availability on the home map. */
const NearbyVehicleMarker: FC<Props> = ({ type, rotation = 0 }) => {
  const accent = VEHICLE_ACCENT[type] ?? T.ink;

  return (
    <View style={styles.wrap}>
      <View style={[styles.halo, { borderColor: `${accent}33` }]} />
      <View style={styles.puck}>
        <View style={[styles.accentDot, { backgroundColor: accent }]} />
        <View style={[styles.iconWrap, { transform: [{ rotate: `${rotation}deg` }] }]}>
          <Image source={VEHICLE_ICONS[type]} style={styles.icon} />
        </View>
      </View>
    </View>
  );
};

const PUCK = 38;
const ICON = 26;

const styles = StyleSheet.create({
  wrap: {
    width: PUCK + 10,
    height: PUCK + 10,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: PUCK + 8,
    height: PUCK + 8,
    borderRadius: (PUCK + 8) / 2,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  puck: {
    width: PUCK,
    height: PUCK,
    borderRadius: PUCK / 2,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    ...T.shadow.card,
  },
  accentDot: {
    position: "absolute",
    bottom: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#fff",
    zIndex: 2,
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
