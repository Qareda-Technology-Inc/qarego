import { View, TouchableOpacity, StyleSheet } from "react-native";
import React, { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import SideDrawer from "../shared/SideDrawer";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";

/** Floating Bolt-style top controls over the ride map. */
const LocationBar = () => {
  const insets = useSafeAreaInsets();
  const [drawerVisible, setDrawerVisible] = useState(false);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setDrawerVisible(true)}
          activeOpacity={0.85}
        >
          <MaterialIcons name="menu" size={22} color={T.ink} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/customer/profile")}
          activeOpacity={0.85}
        >
          <MaterialIcons name="person-outline" size={22} color={T.ink} />
        </TouchableOpacity>
      </View>

      <SideDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        role="customer"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: T.border,
    ...T.shadow.card,
  },
});

export default LocationBar;
