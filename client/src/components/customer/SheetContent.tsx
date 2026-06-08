import { View, TouchableOpacity, StyleSheet } from "react-native";
import React, { useState } from "react";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { RFValue } from "react-native-responsive-fontsize";
import CustomText from "../shared/CustomText";
import { Colors } from "@/utils/Constants";
import CircularServiceSelector from "./CircularServiceSelector";
import SideDrawer from "../shared/SideDrawer";

const SheetContent = () => {
  const [drawerVisible, setDrawerVisible] = useState(false);

  const goToSelectLocations = (vehicle: string, serviceType: string) => {
    router.navigate({
      pathname: "/customer/selectlocations",
      params: { vehicle, serviceType },
    });
  };

  const goToRideLocations = () => {
    router.navigate({
      pathname: "/customer/selectlocations",
      params: { serviceType: "RIDE" },
    });
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setDrawerVisible(true)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="menu" size={24} color={Colors.text} />
        </TouchableOpacity>
        <CustomText fontFamily="SemiBold" fontSize={18} style={styles.logo}>
          QareGO
        </CustomText>
        <View style={styles.menuBtn} />
      </View>

      <CustomText fontFamily="SemiBold" fontSize={20} style={styles.heading}>
        What do you need?
      </CustomText>
      <CustomText fontFamily="Regular" fontSize={14} style={styles.subheading}>
        Tap one to get started
      </CustomText>

      <CircularServiceSelector />

      <TouchableOpacity
        style={styles.cta}
        onPress={goToRideLocations}
        activeOpacity={0.85}
      >
        <Ionicons name="navigate-outline" size={22} color="#fff" />
        <CustomText fontFamily="SemiBold" fontSize={16} style={styles.ctaText}>
          Where are you going?
        </CustomText>
      </TouchableOpacity>

      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        role="customer"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 28,
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  logo: {
    color: Colors.text,
  },
  heading: {
    textAlign: "center",
    color: Colors.text,
    marginBottom: 4,
  },
  subheading: {
    textAlign: "center",
    color: "#888",
    marginBottom: 24,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 28,
    width: "100%",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaText: {
    color: "#fff",
  },
});

export default SheetContent;
