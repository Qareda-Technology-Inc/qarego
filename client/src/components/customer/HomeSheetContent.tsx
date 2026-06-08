import { View, StyleSheet, Platform } from "react-native";
import { TouchableOpacity } from "@gorhom/bottom-sheet";
import React from "react";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import CustomText from "../shared/CustomText";
import { useUserStore } from "@/store/userStore";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";

type QuickAction = {
  key: string;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  bg: string;
  onPress: () => void;
};

/**
 * Bolt-style ride home sheet: destination search hero + quick service tiles.
 */
const HomeSheetContent = () => {
  const { location } = useUserStore();
  const pickupLabel =
    location?.address && location.address.length > 42
      ? `${location.address.slice(0, 42)}…`
      : location?.address || "Current location";

  const goToRideLocations = () => {
    router.navigate({
      pathname: "/customer/selectlocations",
      params: { serviceType: "RIDE" },
    });
  };

  const goToParcel = () => {
    router.navigate("/customer/parcel");
  };

  const quickActions: QuickAction[] = [
    {
      key: "ride",
      label: "Ride",
      sub: "Get a driver",
      icon: "car-sport-outline",
      tint: T.ink,
      bg: "#F8FAFC",
      onPress: goToRideLocations,
    },
    {
      key: "parcel",
      label: "Parcel",
      sub: "Send a package",
      icon: "cube-outline",
      tint: "#7C3AED",
      bg: "#F5F3FF",
      onPress: goToParcel,
    },
  ];

  return (
    <View style={styles.wrapper}>
      <CustomText fontFamily="Bold" fontSize={22} style={styles.greeting}>
        Let's go
      </CustomText>
      <CustomText fontSize={14} style={styles.greetingSub}>
        Book a ride or send a parcel in seconds
      </CustomText>

      <TouchableOpacity
        style={styles.pickupRow}
        onPress={() =>
          router.navigate({
            pathname: "/customer/selectlocations",
            params: { serviceType: "RIDE" },
          })
        }
        activeOpacity={0.85}
      >
        <View style={styles.pickupDot} />
        <View style={styles.pickupTextWrap}>
          <CustomText fontSize={11} fontFamily="Medium" style={styles.pickupLabel}>
            Pickup
          </CustomText>
          <CustomText fontSize={13} fontFamily="SemiBold" numberOfLines={1} style={styles.pickupValue}>
            {pickupLabel}
          </CustomText>
        </View>
        <Ionicons name="pencil-outline" size={16} color={T.inkSoft} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.parcelBanner} onPress={goToParcel} activeOpacity={0.9}>
        <View style={styles.parcelBannerIcon}>
          <Ionicons name="cube" size={20} color="#7C3AED" />
        </View>
        <View style={styles.parcelBannerText}>
          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.parcelBannerTitle}>
            Parcel delivery
          </CustomText>
          <CustomText fontSize={12} style={styles.parcelBannerHint}>
            Send to someone · or receive at your address
          </CustomText>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#A78BFA" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.destinationHero} onPress={goToRideLocations} activeOpacity={0.92}>
        <View style={styles.destinationIcon}>
          <Ionicons name="search" size={22} color={T.ink} />
        </View>
        <View style={styles.destinationText}>
          <CustomText fontFamily="SemiBold" fontSize={17} style={styles.destinationTitle}>
            Where to?
          </CustomText>
          <CustomText fontSize={13} style={styles.destinationHint}>
            Search destination or drop a pin
          </CustomText>
        </View>
        <View style={styles.destinationGo}>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </View>
      </TouchableOpacity>

      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={[styles.quickCard, { backgroundColor: action.bg }]}
            onPress={action.onPress}
            activeOpacity={0.88}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: "#fff" }]}>
              <Ionicons name={action.icon} size={22} color={action.tint} />
            </View>
            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.quickLabel}>
              {action.label}
            </CustomText>
            <CustomText fontSize={12} style={styles.quickSub}>
              {action.sub}
            </CustomText>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.switchServices}
        onPress={() => router.replace("/customer")}
        activeOpacity={0.85}
      >
        <MaterialIcons name="apps" size={18} color={T.inkMuted} />
        <CustomText fontFamily="Medium" fontSize={13} style={styles.switchServicesText}>
          Food, groceries, pharmacy & more
        </CustomText>
        <Ionicons name="chevron-forward" size={18} color={T.inkSoft} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 4,
    paddingBottom: Platform.OS === "ios" ? 16 : 20,
  },
  greeting: {
    color: T.ink,
    marginBottom: 4,
  },
  greetingSub: {
    color: T.inkMuted,
    marginBottom: 16,
  },
  pickupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: T.surfaceMuted,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: T.border,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: T.success,
  },
  pickupTextWrap: { flex: 1, minWidth: 0 },
  pickupLabel: { color: T.inkSoft, marginBottom: 2 },
  pickupValue: { color: T.ink },
  parcelBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderRadius: T.radius.card,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  parcelBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  parcelBannerText: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  parcelBannerTitle: {
    color: "#4C1D95",
  },
  parcelBannerHint: {
    color: T.inkMuted,
    marginTop: 2,
  },
  destinationHero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.ink,
    borderRadius: T.radius.card,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 16,
    ...T.shadow.float,
  },
  destinationIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  destinationText: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  destinationTitle: {
    color: "#fff",
  },
  destinationHint: {
    color: "rgba(255,255,255,0.72)",
    marginTop: 2,
  },
  destinationGo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  quickGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  quickCard: {
    flex: 1,
    borderRadius: T.radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: T.border,
    ...T.shadow.card,
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  quickLabel: {
    color: T.ink,
    marginBottom: 2,
  },
  quickSub: {
    color: T.inkMuted,
  },
  switchServices: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  switchServicesText: {
    flex: 1,
    color: T.inkMuted,
  },
});

export default HomeSheetContent;
