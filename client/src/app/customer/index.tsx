import { View, StyleSheet, ScrollView, Linking } from "react-native";
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

/**
 * First customer screen: module greeting ("What do you need?").
 * Gates the home on active service zones when the admin has defined any.
 */
const CustomerServiceSelect = () => {
  const { user, setServiceCoverage, serviceCoverage } = useUserStore();
  const [checking, setChecking] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);

  const refreshCoverage = useCallback(async () => {
    setChecking(true);
    setLocationDenied(false);
    try {
      if (isReviewPhone(useUserStore.getState().user?.phone)) {
        setServiceCoverage({
          inServiceArea: true,
          openMode: true,
          allowedServices: ["RIDE", "PARCEL", "FOOD", "GROCERY", "PHARMACY"],
          matchedZones: [],
          message: null,
        });
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
        allowedServices: ["RIDE", "PARCEL", "FOOD", "GROCERY", "PHARMACY"],
        matchedZones: [],
        message: null,
      });
    } finally {
      setChecking(false);
    }
  }, [setServiceCoverage]);

  useEffect(() => {
    const t = setTimeout(() => getMyRides(), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    refreshCoverage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const shouldPrompt = !!user && !user.name;
  const userId = user?._id || user?.id;
  const outOfArea = !checking && serviceCoverage && !serviceCoverage.inServiceArea;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.atmosphere}>
        <View style={styles.orbTop} />
        <View style={styles.orbSide} />
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
            onRetry={checking ? undefined : refreshCoverage}
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
            <ServiceSelectScreen />
          </ScrollView>
        )}
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
