import { View, StyleSheet, ScrollView, Linking, Pressable } from "react-native";
import React, { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/utils/Constants";
import ServiceSelectScreen from "@/components/customer/ServiceSelectScreen";
import ServiceUnavailableScreen from "@/components/customer/ServiceUnavailableScreen";
import { getMyRides } from "@/service/rideService";
import { useUserStore } from "@/store/userStore";
import AccountRegistrationModal from "@/components/shared/AccountRegistrationModal";
import { getCurrentLocationAsync } from "@/utils/locationUtils";
import { checkServiceCoverage } from "@/service/serviceZoneService";
import { isReviewPhone } from "@/utils/reviewLogin";
import MapPickerModal from "@/components/customer/MapPickerModal";
import CustomText from "@/components/shared/CustomText";
import { Ionicons } from "@expo/vector-icons";

import { useRefetchOnReconnect } from "@/utils/useRefetchOnReconnect";
/**
 * First customer screen: module greeting ("What do you need?").
 * Gates the home on active service zones when the admin has defined any.
 */
const CustomerServiceSelect = () => {
  const { user, setServiceCoverage, serviceCoverage, coveragePoint, setCoveragePoint, setLocation } = useUserStore();
  const [checking, setChecking] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refreshCoverage = useCallback(async () => {
    setChecking(true);
    setLocationDenied(false);
    try {
      if (isReviewPhone(useUserStore.getState().user?.phone)) {
        setServiceCoverage({
          inServiceArea: true,
          openMode: true,
          allowedServices: ["RIDE", "PARCEL", "FOOD", "GROCERY", "PHARMACY", "GAS"],
          matchedZones: [],
          message: null,
        });
        return;
      }
      // A place the customer chose by hand is checked instead of their GPS position.
      const chosen = useUserStore.getState().coveragePoint;
      if (chosen) {
        const coverage = await checkServiceCoverage(chosen.latitude, chosen.longitude);
        setServiceCoverage(
          coverage.inServiceArea
            ? coverage
            : {
                ...coverage,
                message: `${chosen.address || "That place"} is outside our area too. Try a location closer to town.`,
              }
        );
        return;
      }
      const loc = await getCurrentLocationAsync({ requestPermission: true });
      if (!loc.ok) {
        setLocationDenied(!!loc.canOpenSettings);
        setServiceCoverage({
          inServiceArea: false,
          openMode: false,
          allowedServices: [],
          matchedZones: [],
          message:
            loc.message ||
            "Enable location so we can check if QareGO is available where you are.",
        });
        return;
      }

      const coverage = await checkServiceCoverage(loc.latitude, loc.longitude);
      setServiceCoverage(coverage);
    } catch (err) {
      console.warn("[service-zones] coverage check failed:", err);
      // Fail open so a network blip does not lock customers out.
      setServiceCoverage({
        inServiceArea: true,
        openMode: true,
        allowedServices: ["RIDE", "PARCEL", "FOOD", "GROCERY", "PHARMACY", "GAS"],
        matchedZones: [],
        message: null,
      });
    } finally {
      setChecking(false);
    }
  }, [setServiceCoverage]);
  useRefetchOnReconnect(refreshCoverage);

  useEffect(() => {
    const t = setTimeout(() => getMyRides(), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    refreshCoverage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // Chosen place: check it, and use it as the delivery / starting point when it's covered.
  const applyChosenLocation = useCallback(
    async (picked: { latitude: number; longitude: number; address?: string }) => {
      const point = { latitude: picked.latitude, longitude: picked.longitude, address: picked.address || "Chosen location" };
      setCoveragePoint(point);
      setLocationDenied(false);
      setLocation(point);
      await refreshCoverage();
    },
    [refreshCoverage, setCoveragePoint, setLocation]
  );

  const backToMyLocation = useCallback(async () => {
    setCoveragePoint(null);
    // Forget the chosen address so screens fill in the real one again.
    setLocation(null);
    await refreshCoverage();
  }, [refreshCoverage, setCoveragePoint, setLocation]);

  const shouldPrompt = !!user && !user.name;
  const userId = user?._id || user?.id;
  const outOfArea = !checking && serviceCoverage && !serviceCoverage.inServiceArea;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.atmosphere}>
        <View style={styles.orbTop} />
      </View>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {checking || outOfArea ? (
          <ServiceUnavailableScreen
            loading={checking}
            message={
              locationDenied
                ? "Enable location so we can check if QareGO is available where you are."
                : serviceCoverage?.message
            }
            onRetry={checking ? undefined : coveragePoint ? backToMyLocation : refreshCoverage}
            onChooseLocation={checking ? undefined : () => setPickerOpen(true)}
            onOpenSettings={
              locationDenied
                ? () => {
                    Linking.openSettings().catch(() => undefined);
                  }
                : undefined
            }
          />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {coveragePoint ? (
              <View style={styles.chosenBar}>
                <Ionicons name="location" size={16} color={Colors.primary} />
                <CustomText fontSize={13} numberOfLines={1} style={styles.chosenText}>
                  Showing services for {coveragePoint.address}
                </CustomText>
                <Pressable onPress={() => setPickerOpen(true)} hitSlop={8} accessibilityRole="button">
                  <CustomText fontFamily="SemiBold" fontSize={13} style={styles.chosenAction}>
                    Change
                  </CustomText>
                </Pressable>
                <Pressable onPress={backToMyLocation} hitSlop={8} accessibilityRole="button">
                  <CustomText fontFamily="SemiBold" fontSize={13} style={styles.chosenAction}>
                    Use my location
                  </CustomText>
                </Pressable>
              </View>
            ) : null}
            <ServiceSelectScreen />
          </ScrollView>
        )}
      </SafeAreaView>

      <MapPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="area"
        heading="Choose a location"
        confirmLabel="Use this location"
        selectedLocation={
          coveragePoint ??
          ({ latitude: undefined, longitude: undefined, address: "" } as unknown as { latitude: number; longitude: number; address: string })
        }
        onSelectLocation={(loc: { latitude: number; longitude: number; address?: string }) => {
          void applyChosenLocation(loc);
        }}
      />

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
    opacity: 0.16,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  chosenBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chosenText: { flex: 1, color: "#334155" },
  chosenAction: { color: Colors.primary },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
  },
});

export default CustomerServiceSelect;
