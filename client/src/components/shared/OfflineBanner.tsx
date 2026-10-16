import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomText from "@/components/shared/CustomText";
import { retryConnectivityNow, useConnectivity } from "@/service/connectivity";

const BACK_ONLINE_MS = 2500;

/** App-wide strip under the status bar: offline notice, then a short "Back online". */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const online = useConnectivity((s) => s.online);
  const noInternet = useConnectivity((s) => s.noInternet);
  const reconnectedAt = useConnectivity((s) => s.reconnectedAt);
  const [showBack, setShowBack] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!reconnectedAt) return;
    setShowBack(true);
    const t = setTimeout(() => setShowBack(false), BACK_ONLINE_MS);
    return () => clearTimeout(t);
  }, [reconnectedAt]);

  if (online && !showBack) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 4 }]}>
      {online ? (
        <Animated.View
          key="back"
          entering={FadeInUp.duration(200)}
          exiting={FadeOutUp.duration(200)}
          style={[styles.bar, styles.barOnline]}
          accessibilityRole="alert"
        >
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <CustomText fontFamily="SemiBold" fontSize={12} style={styles.text}>
            Back online
          </CustomText>
        </Animated.View>
      ) : (
        <Animated.View
          key="offline"
          entering={FadeInUp.duration(200)}
          exiting={FadeOutUp.duration(200)}
          style={[styles.bar, styles.barOffline]}
          accessibilityRole="alert"
          accessibilityLabel={`${noInternet ? "No internet connection" : "Can't reach QareGO"}. Retrying.`}
        >
          <Ionicons name={noInternet ? "cloud-offline-outline" : "alert-circle-outline"} size={14} color="#fff" />
          <CustomText fontFamily="SemiBold" fontSize={11.5} style={styles.text} numberOfLines={1}>
            {noInternet ? "No internet" : "Can't reach QareGO"}
          </CustomText>
          <TouchableOpacity onPress={retryConnectivityNow} hitSlop={10} style={styles.retry}>
            <CustomText fontFamily="SemiBold" fontSize={11} style={styles.retryText}>
              Retry
            </CustomText>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // A centred pill: screens keep back/cart buttons in the top corners, so leave those free.
  wrap: {
    position: "absolute",
    left: 72,
    right: 72,
    zIndex: 1000,
    elevation: 1000,
    alignItems: "center",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 999,
    maxWidth: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  barOffline: { backgroundColor: "#1f2937" },
  barOnline: { backgroundColor: "#16a34a" },
  text: { color: "#fff", flexShrink: 1 },
  retry: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  retryText: { color: "#fff" },
});
