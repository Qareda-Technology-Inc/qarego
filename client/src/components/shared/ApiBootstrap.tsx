import { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { ensureApiBaseUrl, isProductionApi } from "@/service/config";
import { isPhysicalDevice } from "@/utils/deviceInfo";
import CustomText from "@/components/shared/CustomText";

type Props = { children: React.ReactNode };

/**
 * On physical devices in dev, resolve API URL (USB vs Wi‑Fi) before the rest of the app calls the API.
 */
export function ApiBootstrap({ children }: Props) {
  const needsDiscovery = __DEV__ && !isProductionApi() && isPhysicalDevice();
  const [ready, setReady] = useState(!needsDiscovery);

  useEffect(() => {
    if (!needsDiscovery) return;
    let cancelled = false;
    ensureApiBaseUrl().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator size="large" color="#111827" />
        <CustomText fontSize={14} color="#6b7280" style={{ marginTop: 12 }}>
          {isProductionApi() ? "Connecting to cloud API…" : "Connecting to dev server…"}
        </CustomText>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
});
