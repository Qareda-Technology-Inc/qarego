import { View, ScrollView, StyleSheet } from "react-native";
import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/utils/Constants";
import ServiceSelectScreen from "@/components/customer/ServiceSelectScreen";
import { getMyRides } from "@/service/rideService";
import { useUserStore } from "@/store/userStore";
import AccountRegistrationModal from "@/components/shared/AccountRegistrationModal";

/**
 * First customer screen: module greeting ("What do you need?").
 * Ride/parcel → map/home flows. Food/grocery/pharmacy → commerce hub.
 */
const CustomerServiceSelect = () => {
  const { user } = useUserStore();

  useEffect(() => {
    const t = setTimeout(() => getMyRides(), 100);
    return () => clearTimeout(t);
  }, []);

  const shouldPrompt = !!user && !user.name;
  const userId = user?._id || user?.id;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.atmosphere}>
        <View style={styles.orbTop} />
        <View style={styles.orbSide} />
      </View>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ServiceSelectScreen />
        </ScrollView>
      </SafeAreaView>

      {shouldPrompt && userId ? (
        <AccountRegistrationModal
          visible={shouldPrompt}
          userId={userId}
          initialName={user?.name}
          initialEmail={user?.email}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  orbTop: {
    position: "absolute",
    top: -90,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.primary,
    opacity: 0.22,
  },
  orbSide: {
    position: "absolute",
    top: 180,
    left: -110,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.tertiary,
    opacity: 0.1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
  },
});

export default CustomerServiceSelect;
