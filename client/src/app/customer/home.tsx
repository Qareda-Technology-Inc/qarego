import { View, StyleSheet, useWindowDimensions } from "react-native";
import React, { useEffect, useMemo, useRef } from "react";
import { homeStyles } from "@/styles/homeStyles";
import { StatusBar } from "expo-status-bar";
import LocationBar from "@/components/customer/LocationBar";
import DraggableMap from "@/components/customer/DraggableMap";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import HomeSheetContent from "@/components/customer/HomeSheetContent";
import { getMyRides } from "@/service/rideService";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { buildHomeSnapPoints } from "@/utils/bottomSheetSnapPoints";

/**
 * Main customer home: map + top nav (LocationBar) + bottom sheet.
 * Shown after user selects a module on the "What do you need?" page.
 *
 * Map fills the window behind the sheet. Snap points control only the sheet height —
 * they must not be reused as map height (that made a small snap = tiny map).
 */
const CustomerHome = () => {
  const { height: windowHeight } = useWindowDimensions();
  const bottomSheetRef = useRef(null);

  const snapPoints = useMemo(() => buildHomeSnapPoints(windowHeight), [windowHeight]);
  const sheetReady = windowHeight >= 100 && snapPoints.length >= 2;

  useEffect(() => {
    const t = setTimeout(() => getMyRides(), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={homeStyles.container}>
      <StatusBar style="dark" backgroundColor="transparent" translucent />
      <View style={styles.mapLayer} pointerEvents="box-none">
        <DraggableMap height={windowHeight} />
      </View>
      <LocationBar />
      {sheetReady ? (
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          animateOnMount
          handleIndicatorStyle={styles.sheetHandle}
          backgroundStyle={styles.sheetBackground}
          enableOverDrag={false}
          enableDynamicSizing={false}
          style={styles.sheet}
          snapPoints={snapPoints}
        >
          <BottomSheetView style={homeStyles.sheetView}>
            <HomeSheetContent />
          </BottomSheetView>
        </BottomSheet>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sheet: {
    zIndex: 4,
    borderTopLeftRadius: T.radius.sheet,
    borderTopRightRadius: T.radius.sheet,
    ...T.shadow.float,
  },
  sheetBackground: {
    backgroundColor: T.sheetBg,
    borderTopLeftRadius: T.radius.sheet,
    borderTopRightRadius: T.radius.sheet,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    marginTop: 8,
  },
});

export default CustomerHome;
