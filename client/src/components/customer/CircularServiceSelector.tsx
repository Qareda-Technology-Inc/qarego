import React from "react";
import { View, StyleSheet, Pressable, StyleProp, ViewStyle } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { RFValue } from "react-native-responsive-fontsize";
import CustomText from "../shared/CustomText";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import { router } from "expo-router";
import { openCommerceModule } from "@/utils/commerceNavigation";
import { useUserStore } from "@/store/userStore";

export type ServiceType = "RIDE" | "PARCEL" | "FOOD" | "GROCERY" | "PHARMACY" | "GAS" | "LAUNDRY";

type Service = {
  type: ServiceType;
  label: string;
  description: string;
  ioniconName: keyof typeof Ionicons.glyphMap;
  themeColor: string;
  /** Darker shade of themeColor for text on the tint. */
  ink: string;
  tint: string;
};

const SERVICES: Record<ServiceType, Service> = {
  FOOD: {
    type: "FOOD",
    label: "Food",
    description: "Restaurants nearby",
    ioniconName: "restaurant",
    themeColor: Colors.theme,
    ink: "#9a3412",
    tint: "#ffedd5",
  },
  RIDE: {
    type: "RIDE",
    label: "Ride",
    description: "Book a trip",
    ioniconName: "car",
    themeColor: "#15803d",
    ink: "#166534",
    tint: "#dcfce7",
  },
  PARCEL: {
    type: "PARCEL",
    label: "Parcel",
    description: "Send a package",
    ioniconName: "cube",
    themeColor: Colors.tertiary,
    ink: "#1e3a8a",
    tint: "#dbeafe",
  },
  GROCERY: {
    type: "GROCERY",
    label: "Grocery",
    description: "Essentials",
    ioniconName: "basket",
    themeColor: "#0369a1",
    ink: "#0c4a6e",
    tint: "#e0f2fe",
  },
  PHARMACY: {
    type: "PHARMACY",
    label: "Pharmacy",
    description: "Health",
    ioniconName: "medkit",
    themeColor: "#b91c1c",
    ink: "#7f1d1d",
    tint: "#fee2e2",
  },
  GAS: {
    type: "GAS",
    label: "Cooking gas",
    description: "Refill or swap",
    ioniconName: "flame",
    themeColor: "#c2410c",
    ink: "#7c2d12",
    tint: "#ffedd5",
  },
  LAUNDRY: {
    type: "LAUNDRY",
    label: "Laundry",
    description: "Wash & return",
    ioniconName: "shirt",
    themeColor: "#0e7490",
    ink: "#164e63",
    tint: "#cffafe",
  },
};

const LOCKED = { tint: "#f1f5f9", icon: "#94a3b8", text: "#94a3b8" };
// CustomText scales fonts with screen height (RFValue); scale tile heights the same way
// so labels never overflow on large phones or float in empty space on small ones.
const MEDIUM_H = RFValue(74);
const GAP = 10;

type Props = {
  /** When true, Ride goes to map home instead of location pick. */
  goToHomeOnSelect?: boolean;
};

/**
 * Service module picker — bento grid. Food leads as the large tile, Ride and Parcel
 * stack beside it, then Grocery and Pharmacy, then Cooking gas and Laundry as compact tiles.
 * Services not allowed in the current zone are greyed out with a lock.
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
    if (type === "GAS") {
      router.navigate("/customer/gas");
      return;
    }
    openCommerceModule(type);
  };

  const tileProps = (type: ServiceType) => {
    const service = SERVICES[type];
    const allowed = isServiceAllowed(type);
    return {
      service,
      allowed,
      onPress: () => handleSelect(type),
      accessibilityLabel: allowed
        ? `${service.label}. ${service.description}`
        : `${service.label}. Not available in your area`,
    };
  };

  return (
    <View style={styles.grid}>
      <View style={styles.topRow}>
        <Animated.View
          style={styles.flex}
          entering={FadeInUp.delay(80).duration(380).springify().damping(18)}
        >
          <LargeTile {...tileProps("FOOD")} />
        </Animated.View>
        <View style={[styles.flex, styles.stack]}>
          <Animated.View entering={FadeInUp.delay(135).duration(380).springify().damping(18)}>
            <MediumTile {...tileProps("RIDE")} />
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(190).duration(380).springify().damping(18)}>
            <MediumTile {...tileProps("PARCEL")} />
          </Animated.View>
        </View>
      </View>
      <View style={styles.bottomRow}>
        <Animated.View
          style={styles.flex}
          entering={FadeInUp.delay(245).duration(380).springify().damping(18)}
        >
          <CompactTile {...tileProps("GROCERY")} />
        </Animated.View>
        <Animated.View
          style={styles.flex}
          entering={FadeInUp.delay(300).duration(380).springify().damping(18)}
        >
          <CompactTile {...tileProps("PHARMACY")} />
        </Animated.View>
      </View>
      <View style={styles.bottomRow}>
        <Animated.View
          style={styles.flex}
          entering={FadeInUp.delay(355).duration(380).springify().damping(18)}
        >
          <CompactTile {...tileProps("GAS")} />
        </Animated.View>
        <Animated.View
          style={styles.flex}
          entering={FadeInUp.delay(410).duration(380).springify().damping(18)}
        >
          <CompactTile {...tileProps("LAUNDRY")} />
        </Animated.View>
      </View>
    </View>
  );
};

type TileProps = {
  service: Service;
  allowed: boolean;
  onPress: () => void;
  accessibilityLabel: string;
};

const TilePressable = ({
  allowed,
  onPress,
  accessibilityLabel,
  style,
  children,
}: Omit<TileProps, "service"> & { style: StyleProp<ViewStyle>; children: React.ReactNode }) => (
  <Pressable
    onPress={onPress}
    disabled={!allowed}
    style={({ pressed }) => [style, !allowed && styles.tileLocked, pressed && allowed && styles.pressed]}
    accessibilityRole="button"
    accessibilityState={{ disabled: !allowed }}
    accessibilityLabel={accessibilityLabel}
  >
    {children}
  </Pressable>
);

const LargeTile = ({ service, allowed, ...rest }: TileProps) => (
  <TilePressable
    allowed={allowed}
    {...rest}
    style={[styles.large, { backgroundColor: allowed ? service.tint : LOCKED.tint }]}
  >
    <View style={styles.largeIcon}>
      <Ionicons
        name={service.ioniconName}
        size={30}
        color={allowed ? service.themeColor : LOCKED.icon}
      />
    </View>
    <View>
      <CustomText
        fontFamily="Bold"
        fontSize={22}
        style={{ color: allowed ? service.ink : LOCKED.text, letterSpacing: -0.3 }}
      >
        {service.label}
      </CustomText>
      <CustomText
        fontSize={12}
        style={[styles.largeDescription, { color: allowed ? service.ink : LOCKED.text }]}
      >
        {allowed ? service.description : "Not available in your area"}
      </CustomText>
      <View
        style={[styles.cta, { backgroundColor: allowed ? service.themeColor : LOCKED.icon }]}
      >
        <CustomText fontFamily="SemiBold" fontSize={12} style={styles.ctaText}>
          {allowed ? "Order now" : "Locked"}
        </CustomText>
        <Ionicons name={allowed ? "arrow-forward" : "lock-closed"} size={13} color="#fff" />
      </View>
    </View>
  </TilePressable>
);

const MediumTile = ({ service, allowed, ...rest }: TileProps) => (
  <TilePressable
    allowed={allowed}
    {...rest}
    style={[styles.medium, { backgroundColor: allowed ? service.tint : LOCKED.tint }]}
  >
    <View style={styles.mediumTop}>
      <Ionicons
        name={service.ioniconName}
        size={24}
        color={allowed ? service.themeColor : LOCKED.icon}
      />
      {!allowed ? <Ionicons name="lock-closed" size={14} color={LOCKED.icon} /> : null}
    </View>
    <View>
      <CustomText
        fontFamily="SemiBold"
        fontSize={16}
        style={{ color: allowed ? service.ink : LOCKED.text }}
      >
        {service.label}
      </CustomText>
      <CustomText
        fontSize={11}
        numberOfLines={1}
        style={{ color: allowed ? service.ink : LOCKED.text, opacity: 0.8 }}
      >
        {allowed ? service.description : "Not in your area"}
      </CustomText>
    </View>
  </TilePressable>
);

const CompactTile = ({ service, allowed, ...rest }: TileProps) => (
  <TilePressable allowed={allowed} {...rest} style={styles.compact}>
    <View
      style={[styles.compactIcon, { backgroundColor: allowed ? service.tint : LOCKED.tint }]}
    >
      <Ionicons
        name={service.ioniconName}
        size={18}
        color={allowed ? service.themeColor : LOCKED.icon}
      />
    </View>
    <View style={styles.flex}>
      <CustomText
        fontFamily="SemiBold"
        fontSize={14}
        style={{ color: allowed ? Colors.text : LOCKED.text }}
      >
        {service.label}
      </CustomText>
      <CustomText
        fontSize={11}
        numberOfLines={1}
        style={{ color: allowed ? DS.color.textMuted : LOCKED.text }}
      >
        {allowed ? service.description : "Not in your area"}
      </CustomText>
    </View>
    {!allowed ? <Ionicons name="lock-closed" size={14} color={LOCKED.icon} /> : null}
  </TilePressable>
);

const styles = StyleSheet.create({
  grid: {
    width: "100%",
    gap: GAP,
  },
  topRow: {
    flexDirection: "row",
    gap: GAP,
  },
  bottomRow: {
    flexDirection: "row",
    gap: GAP,
  },
  flex: {
    flex: 1,
  },
  stack: {
    gap: GAP,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  tileLocked: {
    opacity: 0.8,
  },
  large: {
    minHeight: MEDIUM_H * 2 + GAP,
    flex: 1,
    borderRadius: 22,
    padding: 16,
    justifyContent: "space-between",
  },
  largeIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  largeDescription: {
    opacity: 0.8,
    marginTop: 2,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: DS.radius.pill,
  },
  ctaText: {
    color: "#fff",
  },
  medium: {
    minHeight: MEDIUM_H,
    borderRadius: 18,
    padding: 12,
    justifyContent: "space-between",
  },
  mediumTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  compact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...DS.shadow.card,
  },
  compactIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default CircularServiceSelector;
