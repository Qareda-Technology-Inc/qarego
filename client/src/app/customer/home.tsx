import { View, StyleSheet, useWindowDimensions } from "react-native";
import React, { useEffect } from "react";
import { homeStyles } from "@/styles/homeStyles";
import { StatusBar } from "expo-status-bar";
import LocationBar from "@/components/customer/LocationBar";
import DraggableMap from "@/components/customer/DraggableMap";
import HomeSheetContent from "@/components/customer/HomeSheetContent";
import { getMyRides } from "@/service/rideService";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";

/**
 * Main customer home: map + top nav (LocationBar) + bottom sheet.
 * Shown after user selects a module on the "What do you need?" page.
 *
 * Map fills the window behind the sheet. Snap points control only the sheet height —
 * they must not be reused as map height (that made a small snap = tiny map).
 */
const CustomerHome = () => {
  const { height: windowHeight } = useWindowDimensions();
  const cardHeight = Math.max(150, Math.round(windowHeight * 0.2));
  const mapHeight = Math.max(260, windowHeight - cardHeight);

  useEffect(() => {
    const t = setTimeout(() => getMyRides(), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={homeStyles.container}>
      <StatusBar style="dark" backgroundColor="transparent" translucent />
      <View style={styles.mapLayer} pointerEvents="box-none">
        <DraggableMap height={mapHeight} />
      </View>
      <LocationBar />
      <View style={[styles.bottomCard, { height: cardHeight }]}>
        <View style={homeStyles.sheetView}>
          <HomeSheetContent />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mapLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 0,
  },
  bottomCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    borderTopLeftRadius: T.radius.sheet,
    borderTopRightRadius: T.radius.sheet,
    backgroundColor: T.sheetBg,
    ...T.shadow.float,
  },
});

export default CustomerHome;
