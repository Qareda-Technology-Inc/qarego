import React, { useEffect } from "react";
import { View, Image, StyleSheet, Dimensions, Pressable } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "../shared/CustomText";
import { Colors } from "@/utils/Constants";
import { router } from "expo-router";
import { openCommerceModule } from "@/utils/commerceNavigation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CIRCLE_SIZE = Math.min(SCREEN_WIDTH - 28, 340);
const CENTER = CIRCLE_SIZE / 2;
const RADIUS = (CIRCLE_SIZE - 100) / 2; // space for option nodes

export type ServiceType = "RIDE" | "PARCEL" | "FOOD" | "GROCERY" | "PHARMACY";

/** Theme colors by vertical */
const SERVICE_COLORS = {
  RIDE: "#22c55e",
  FOOD: "#f97316",
  PARCEL: "#a855f7",
  GROCERY: "#0ea5e9",
  PHARMACY: "#ef4444",
} as const;

const services: {
  type: ServiceType;
  label: string;
  icon: any;
  iconType: "image" | "ionicon";
  ioniconName?: keyof typeof Ionicons.glyphMap;
  themeColor: string;
}[] = [
  { type: "RIDE", label: "Book a ride", icon: null, iconType: "ionicon", ioniconName: "car", themeColor: SERVICE_COLORS.RIDE },
  { type: "PARCEL", label: "Parcel", icon: null, iconType: "ionicon", ioniconName: "cube", themeColor: SERVICE_COLORS.PARCEL },
  { type: "FOOD", label: "Food & Restaurants", icon: null, iconType: "ionicon", ioniconName: "restaurant", themeColor: SERVICE_COLORS.FOOD },
  { type: "GROCERY", label: "Groceries & Supermarket", icon: null, iconType: "ionicon", ioniconName: "basket", themeColor: SERVICE_COLORS.GROCERY },
  { type: "PHARMACY", label: "Pharmacy", icon: null, iconType: "ionicon", ioniconName: "medkit", themeColor: SERVICE_COLORS.PHARMACY },
];

const CircularServiceSelector = ({ goToHomeOnSelect = false }: { goToHomeOnSelect?: boolean }) => {
  const isFocused = useIsFocused();
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!isFocused) {
      cancelAnimation(rotation);
      cancelAnimation(pulse);
      rotation.value = 0;
      pulse.value = 1;
      return;
    }

    rotation.value = withRepeat(
      withTiming(360, { duration: 24000, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    return () => {
      cancelAnimation(rotation);
      cancelAnimation(pulse);
    };
  }, [isFocused, rotation, pulse]);

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

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
    } else if (type === "PARCEL") {
      router.navigate("/customer/parcel");
    } else if (type === "FOOD") {
      openCommerceModule("FOOD");
    } else if (type === "GROCERY") {
      openCommerceModule("GROCERY");
    } else {
      openCommerceModule("PHARMACY");
    }
  };

  return (
    <View style={styles.wrapper}>
      <View
        style={[styles.circleContainer, { width: CIRCLE_SIZE, height: CIRCLE_SIZE }]}
        collapsable={false}
      >
        {/* Rotating ring with orbiting dots - allow touches to pass through to option nodes */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              borderRadius: CIRCLE_SIZE / 2,
            },
            animatedRingStyle,
          ]}
        >
          <View style={styles.ringInner} />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angleRad = (i * 60 * Math.PI) / 180;
            const r = RADIUS + 14;
            const x = CENTER + r * Math.cos(angleRad) - 4;
            const y = CENTER + r * Math.sin(angleRad) - 4;
            return (
              <View
                key={i}
                style={[
                  styles.orbitDot,
                  { position: "absolute" as const, left: x, top: y },
                ]}
              />
            );
          })}
        </Animated.View>

        {/* Center label - allow touches to pass through to option nodes */}
        <Animated.View pointerEvents="none" style={[styles.centerLabel, animatedPulseStyle]}>
          <CustomText fontFamily="SemiBold" fontSize={12} style={styles.centerText}>
            Choose
          </CustomText>
          <CustomText fontFamily="Regular" fontSize={10} style={styles.centerSubtext}>
            one
          </CustomText>
        </Animated.View>

        {/* Service nodes around the ring */}
        {services.map((service, index) => {
          const angleStep = 360 / services.length;
          const angleDeg = -90 + index * angleStep;
          const angleRad = (angleDeg * Math.PI) / 180;
          const nodeSize = 48;
          const x = CENTER + RADIUS * Math.cos(angleRad) - nodeSize;
          const y = CENTER + RADIUS * Math.sin(angleRad) - nodeSize;

          const themeColor = service.themeColor || Colors.primary;
          return (
            <Pressable
              key={service.type}
              style={({ pressed }) => [
                styles.optionNode,
                { left: x, top: y },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => handleSelect(service.type)}
              hitSlop={12}
            >
              <View style={[styles.optionIconWrap, { borderColor: themeColor }]}>
                {service.iconType === "image" && service.icon ? (
                  <Image source={service.icon} style={styles.optionIcon} resizeMode="contain" />
                ) : (
                  <Ionicons
                    name={service.ioniconName || "restaurant"}
                    size={36}
                    color={themeColor}
                  />
                )}
              </View>
              <CustomText fontFamily="SemiBold" fontSize={11} style={styles.optionLabel} numberOfLines={2}>
                {service.label}
              </CustomText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    overflow: "visible",
  },
  circleContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(237, 210, 40, 0.4)",
    borderStyle: "dashed",
  },
  ringInner: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(237, 210, 40, 0.15)",
    margin: 6,
  },
  orbitDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    opacity: 0.7,
  },
  centerLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  centerText: {
    color: Colors.text,
  },
  centerSubtext: {
    color: "#888",
    marginTop: 0,
  },
  optionNode: {
    position: "absolute",
    width: 88,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  optionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  optionIcon: {
    width: 42,
    height: 42,
  },
  optionLabel: {
    color: Colors.text,
    marginTop: 7,
    textAlign: "center",
  },
});

export default CircularServiceSelector;
