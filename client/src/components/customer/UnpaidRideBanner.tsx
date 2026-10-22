import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { formatCurrency } from "@/utils/Constants";
import { fetchUnpaidRide, type UnpaidRide } from "@/service/rideService";

/**
 * A mobile money trip the customer hasn't paid for. New bookings are refused until it's paid,
 * so say so up front with a way to pay. Checked each time the screen comes into view.
 */
export default function UnpaidRideBanner() {
  const [unpaid, setUnpaid] = useState<UnpaidRide | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchUnpaidRide()
        .then((ride) => {
          if (alive) setUnpaid(ride);
        })
        .catch(() => {
          /* offline: keep what we showed last */
        });
      return () => {
        alive = false;
      };
    }, [])
  );

  if (!unpaid) return null;
  const what = unpaid.serviceType === "DELIVERY" ? "delivery" : "trip";

  return (
    <Pressable
      onPress={() => router.navigate({ pathname: "/customer/liveride", params: { id: unpaid.rideId } })}
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Your last ${what} isn't paid. Pay ${formatCurrency(unpaid.fare)} now`}
    >
      <View style={styles.icon}>
        <Ionicons name="alert-circle" size={20} color="#fff" />
      </View>
      <View style={styles.flex}>
        <CustomText fontFamily="SemiBold" fontSize={14} style={styles.title}>
          Your last {what} isn&apos;t paid
        </CustomText>
        <CustomText fontSize={12} style={styles.body}>
          Pay {formatCurrency(unpaid.fare)} with mobile money to book again.
        </CustomText>
      </View>
      <CustomText fontFamily="SemiBold" fontSize={13} style={styles.title}>
        Pay now
      </CustomText>
      <Ionicons name="chevron-forward" size={18} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: "#DC2626",
  },
  pressed: { opacity: 0.9 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  title: { color: "#fff" },
  body: { color: "rgba(255,255,255,0.92)", marginTop: 1 },
});
