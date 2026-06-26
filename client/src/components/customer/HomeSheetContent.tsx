import { View, StyleSheet, Platform } from "react-native";
import { TouchableOpacity } from "react-native";
import React from "react";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import CustomText from "../shared/CustomText";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";

/**
 * Bolt-style ride home sheet: destination search hero + quick service tiles.
 */
const HomeSheetContent = () => {
  const goToRideLocations = () => {
    router.navigate({
      pathname: "/customer/selectlocations",
      params: { serviceType: "RIDE" },
    });
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.destinationHero} onPress={goToRideLocations} activeOpacity={0.92}>
        <View style={styles.destinationIcon}>
          <Ionicons name="search" size={22} color={T.ink} />
        </View>
        <View style={styles.destinationText}>
          <CustomText fontFamily="SemiBold" fontSize={17} style={styles.destinationTitle}>
            Where to?
          </CustomText>
        </View>
        <View style={styles.destinationGo}>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.switchServices}
        onPress={() => router.replace("/customer")}
        activeOpacity={0.85}
      >
        <MaterialIcons name="apps" size={18} color={T.inkMuted} />
        <CustomText fontFamily="Medium" fontSize={13} style={styles.switchServicesText}>
          Food, groceries, pharmacy & more
        </CustomText>
        <Ionicons name="chevron-forward" size={18} color={T.inkSoft} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: "flex-end",
    paddingTop: 0,
    paddingBottom: Platform.OS === "ios" ? 8 : 10,
  },
  destinationHero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radius.card,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 6,
    ...T.shadow.float,
  },
  destinationIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: T.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  destinationText: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  destinationTitle: {
    color: T.ink,
  },
  destinationGo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  switchServices: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 0,
  },
  switchServicesText: {
    flex: 1,
    color: T.ink,
  },
});

export default HomeSheetContent;
