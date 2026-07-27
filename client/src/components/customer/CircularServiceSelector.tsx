import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "../shared/CustomText";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import { router } from "expo-router";
import { openCommerceModule } from "@/utils/commerceNavigation";

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
 */
const CircularServiceSelector = ({ goToHomeOnSelect = false }: Props) => {
  const handleSelect = (type: ServiceType) => {
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
      {services.map((service, index) => (
        <Animated.View
          key={service.type}
          entering={FadeInUp.delay(80 + index * 55).duration(380).springify().damping(18)}
        >
          <Pressable
            onPress={() => handleSelect(service.type)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${service.label}. ${service.description}`}
          >
            <View style={[styles.iconWell, { backgroundColor: service.tint }]}>
              <Ionicons name={service.ioniconName} size={24} color={service.themeColor} />
            </View>
            <View style={styles.copy}>
              <CustomText fontFamily="SemiBold" fontSize={16} style={styles.label}>
                {service.label}
              </CustomText>
              <CustomText fontSize={13} style={styles.description}>
                {service.description}
              </CustomText>
            </View>
            <View style={[styles.chevron, { backgroundColor: service.tint }]}>
              <Ionicons name="arrow-forward" size={16} color={service.themeColor} />
            </View>
          </Pressable>
        </Animated.View>
      ))}
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
  chevron: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default CircularServiceSelector;
