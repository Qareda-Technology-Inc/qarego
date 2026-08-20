import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "../shared/CustomText";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import { router } from "expo-router";
import { openCommerceModule } from "@/utils/commerceNavigation";
import { useUserStore } from "@/store/userStore";

export type ServiceType = "RIDE" | "PARCEL" | "FOOD" | "GROCERY" | "PHARMACY";

const services: {
  type: ServiceType;
  label: string;
  description: string;
  ioniconName: keyof typeof Ionicons.glyphMap;
  themeColor: string;
  tint: string;
}[] = [
  {
    type: "RIDE",
    label: "Ride",
    description: "Book a trip nearby",
    ioniconName: "car",
    themeColor: "#15803d",
    tint: "#dcfce7",
  },
  {
    type: "FOOD",
    label: "Food",
    description: "Restaurants near you",
    ioniconName: "restaurant",
    themeColor: Colors.theme,
    tint: "#ffedd5",
  },
  {
    type: "PARCEL",
    label: "Parcel",
    description: "Send or receive a package",
    ioniconName: "cube",
    themeColor: Colors.tertiary,
    tint: "#dbeafe",
  },
  {
    type: "GROCERY",
    label: "Grocery",
    description: "Supermarkets & essentials",
    ioniconName: "basket",
    themeColor: "#0369a1",
    tint: "#e0f2fe",
  },
  {
    type: "PHARMACY",
    label: "Pharmacy",
    description: "Medicine & health products",
    ioniconName: "medkit",
    themeColor: "#b91c1c",
    tint: "#fee2e2",
  },
];

type Props = {
  /** When true, Ride goes to map home instead of location pick. */
  goToHomeOnSelect?: boolean;
};

/**
 * Service module picker — large tappable rows (replaces the old rotating circle).
 * Services not allowed in the current zone are shown greyed out.
 */
const CircularServiceSelector = ({ goToHomeOnSelect = false }: Props) => {
  const isServiceAllowed = useUserStore((s) => s.isServiceAllowed);

  const handleSelect = (type: ServiceType) => {
    if (!isServiceAllowed(type)) return;

    if (type === "RIDE") {
      if (goToHomeOnSelect) {
        router.replace("/customer/home");
      } else {
        router.navigate({
          pathname: "/customer/selectlocations",
          params: { serviceType: "RIDE" },
        });
      }
      return;
    }
    if (type === "PARCEL") {
      router.navigate("/customer/parcel");
      return;
    }
    if (type === "FOOD") {
      openCommerceModule("FOOD");
      return;
    }
    if (type === "GROCERY") {
      openCommerceModule("GROCERY");
      return;
    }
    openCommerceModule("PHARMACY");
  };

  return (
    <View style={styles.list}>
      {services.map((service, index) => {
        const allowed = isServiceAllowed(service.type);
        return (
          <Animated.View
            key={service.type}
            entering={FadeInUp.delay(80 + index * 55).duration(380).springify().damping(18)}
          >
            <Pressable
              onPress={() => handleSelect(service.type)}
              disabled={!allowed}
              style={({ pressed }) => [
                styles.row,
                !allowed && styles.rowDisabled,
                pressed && allowed && styles.rowPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !allowed }}
              accessibilityLabel={
                allowed
                  ? `${service.label}. ${service.description}`
                  : `${service.label}. Not available in your area`
              }
            >
              <View
                style={[
                  styles.iconWell,
                  { backgroundColor: allowed ? service.tint : "#f1f5f9" },
                ]}
              >
                <Ionicons
                  name={service.ioniconName}
                  size={24}
                  color={allowed ? service.themeColor : "#94a3b8"}
                />
              </View>
              <View style={styles.copy}>
                <CustomText
                  fontFamily="SemiBold"
                  fontSize={16}
                  style={[styles.label, !allowed && styles.textMuted]}
                >
                  {service.label}
                </CustomText>
                <CustomText
                  fontSize={13}
                  style={[styles.description, !allowed && styles.textMuted]}
                >
                  {allowed ? service.description : "Not available in your area"}
                </CustomText>
              </View>
              <View
                style={[
                  styles.chevron,
                  { backgroundColor: allowed ? service.tint : "#f1f5f9" },
                ]}
              >
                <Ionicons
                  name={allowed ? "arrow-forward" : "lock-closed"}
                  size={16}
                  color={allowed ? service.themeColor : "#94a3b8"}
                />
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    width: "100%",
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...DS.shadow.card,
  },
  rowDisabled: {
    opacity: 0.72,
  },
  rowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  iconWell: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  copy: {
    flex: 1,
    paddingRight: 8,
  },
  label: {
    color: Colors.text,
    marginBottom: 2,
  },
  description: {
    color: DS.color.textMuted,
    lineHeight: 18,
  },
  textMuted: {
    color: "#94a3b8",
  },
  chevron: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default CircularServiceSelector;
