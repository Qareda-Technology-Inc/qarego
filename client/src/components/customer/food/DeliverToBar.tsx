import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import React, { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { useUserStore } from "@/store/userStore";
import { ensureUserDeliveryLocation, hasValidDeliveryCoords } from "@/utils/ensureDeliveryLocation";
import { FOOD_THEME } from "@/styles/foodStyles";

type Props = {
  accentColor?: string;
};

const DeliverToBar = ({ accentColor = FOOD_THEME.orange }: Props) => {
  const { location, setLocation } = useUserStore();
  const [resolving, setResolving] = useState(false);

  const refresh = useCallback(async () => {
    setResolving(true);
    await ensureUserDeliveryLocation(location, setLocation);
    setResolving(false);
  }, [location, setLocation]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const hasCoords = hasValidDeliveryCoords(location);
  const addressLine = hasCoords
    ? location?.address?.trim() || "Current location"
    : "Set delivery address";

  return (
    <TouchableOpacity
      style={styles.wrap}
      activeOpacity={0.75}
      onPress={() =>
        router.push({
          pathname: "/customer/selectlocations",
          params: { serviceType: "FOOD", foodCheckout: "1" },
        })
      }
    >
      <Ionicons name="location-sharp" size={14} color={accentColor} style={styles.pin} />
      {resolving ? (
        <ActivityIndicator size="small" color={accentColor} style={styles.loader} />
      ) : (
        <CustomText fontFamily="Medium" fontSize={12} numberOfLines={1} style={styles.line}>
          <CustomText fontFamily="Medium" fontSize={12} style={styles.prefix}>
            Deliver to ·{" "}
          </CustomText>
          {addressLine}
        </CustomText>
      )}
      <Ionicons name="chevron-forward" size={14} color={FOOD_THEME.textMuted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 10,
    marginBottom: 6,
    borderRadius: 8,
    backgroundColor: FOOD_THEME.searchBg,
  },
  pin: {
    marginRight: 6,
  },
  loader: {
    flex: 1,
    alignSelf: "center",
  },
  line: {
    flex: 1,
    color: FOOD_THEME.text,
    marginRight: 4,
  },
  prefix: {
    color: FOOD_THEME.textMuted,
  },
});

export default DeliverToBar;
