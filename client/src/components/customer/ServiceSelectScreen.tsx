import { View, StyleSheet, Image, Pressable } from "react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import CustomText from "../shared/CustomText";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import CircularServiceSelector from "./CircularServiceSelector";
import FoodPromoCarousel from "./food/FoodPromoCarousel";
import OrderAgainRow from "./OrderAgainRow";
import { useUserStore } from "@/store/userStore";
import {
  fetchActiveFoodOrder,
  fetchFoodCheckoutSettings,
  fetchMyFoodOrders,
  FoodOrder,
  FoodPromoBanner,
} from "@/service/foodService";
import { resolveOrderVertical } from "@/utils/commerceOrderCopy";
import { STORE_VERTICAL_CONFIG } from "@/utils/storeVertical";
import WelcomeSlides from "./onboarding/WelcomeSlides";
import SpotlightTour, { type TourStep } from "./onboarding/SpotlightTour";
import { onboardingUserId, useOnboardingStore } from "@/store/onboardingStore";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Parent ScrollView pads 20px each side; full-width rows undo it with negative margins. */
const PAGE_PAD = 20;

/**
 * Customer module page — greeting header, live order card, ride shortcut,
 * service grid (Food leads), recent stores and admin promo banners.
 */
const ServiceSelectScreen = () => {
  const { user } = useUserStore();
  const isServiceAllowed = useUserStore((s) => s.isServiceAllowed);
  const firstName = user?.name?.trim().split(/\s+/)[0] || "";
  const initial = (firstName[0] || "Q").toUpperCase();
  const greeting = getGreeting();

  const [activeOrder, setActiveOrder] = useState<FoodOrder | null>(null);
  const [promoBanners, setPromoBanners] = useState<FoodPromoBanner[]>([]);
  const [pastOrders, setPastOrders] = useState<FoodOrder[]>([]);

  useEffect(() => {
    // All optional extras: on failure the section simply stays hidden.
    fetchActiveFoodOrder()
      .then(setActiveOrder)
      .catch(() => setActiveOrder(null));
    fetchFoodCheckoutSettings("FOOD")
      .then((cfg) => setPromoBanners(cfg.promoBanners ?? []))
      .catch(() => setPromoBanners([]));
    fetchMyFoodOrders()
      .then(setPastOrders)
      .catch(() => setPastOrders([]));
  }, []);

  const activeAccent = activeOrder
    ? STORE_VERTICAL_CONFIG[resolveOrderVertical(activeOrder)].accent
    : Colors.theme;
  const rideAllowed = isServiceAllowed("RIDE");

  // First-time guidance: intro slides, then a tour of the real controls on this screen.
  // Waits until the customer has a name, so it never sits on top of the sign-up form.
  const userId = onboardingUserId(user);
  const ready = !!userId && !!user?.name;
  const welcomeSeen = useOnboardingStore((s) => s.hasSeen(userId, "welcome"));
  const tourSeen = useOnboardingStore((s) => s.hasSeen(userId, "tour:home"));
  const markSeen = useOnboardingStore((s) => s.markSeen);
  const whereToRef = useRef<View>(null);
  const servicesRef = useRef<View>(null);
  const ordersRef = useRef<View>(null);
  const profileRef = useRef<View>(null);
  const tourSteps = useMemo<TourStep[]>(
    () => [
      {
        key: "whereTo",
        target: whereToRef,
        title: "Book a ride",
        body: "Tap here, choose where you're going, and you'll see the fare before you confirm.",
      },
      {
        key: "services",
        target: servicesRef,
        title: "Everything else",
        body: "Order food, groceries or medicine, send a parcel, or get your gas cylinder refilled.",
      },
      {
        key: "orders",
        target: ordersRef,
        title: "Your orders",
        body: "Follow an order that's on its way and see your past trips and orders.",
      },
      {
        key: "profile",
        target: profileRef,
        title: "Your profile",
        body: "Update your name and photo. Open Account any time and tap \"Show me around\" to see this again.",
      },
    ],
    []
  );

  return (
    <View style={styles.wrapper}>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
        <Image
          source={require("@/assets/images/logo_t.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.headerCopy}>
          <CustomText fontSize={13} style={styles.greeting}>
            {greeting}
          </CustomText>
          <CustomText fontFamily="Bold" fontSize={20} numberOfLines={1} style={styles.name}>
            {firstName ? `Hi, ${firstName}` : "Welcome to QareGO"}
          </CustomText>
        </View>
        <Pressable
          ref={ordersRef}
          onPress={() => router.push("/customer/orders")}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Your orders"
          hitSlop={6}
        >
          <Ionicons name="receipt-outline" size={20} color={Colors.text} />
        </Pressable>
        <Pressable
          ref={profileRef}
          onPress={() => router.push("/customer/profile")}
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Your profile"
          hitSlop={6}
        >
          <CustomText fontFamily="Bold" fontSize={15} style={styles.avatarText}>
            {initial}
          </CustomText>
        </Pressable>
      </Animated.View>

      {activeOrder ? (
        <Animated.View entering={FadeInDown.delay(40).duration(420)}>
          <Pressable
            onPress={() => router.push(`/customer/stores/order/${activeOrder._id}` as const)}
            style={({ pressed }) => [
              styles.activeOrder,
              { backgroundColor: activeAccent },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Order in progress from ${activeOrder.restaurantName}. Track order`}
          >
            <View style={styles.activeIcon}>
              <Ionicons name="bicycle" size={20} color="#fff" />
            </View>
            <View style={styles.flex}>
              <CustomText fontFamily="SemiBold" fontSize={14} style={styles.onAccent}>
                Order in progress
              </CustomText>
              <CustomText fontSize={12} numberOfLines={1} style={styles.onAccentSoft}>
                {activeOrder.restaurantName}
              </CustomText>
            </View>
            <CustomText fontFamily="SemiBold" fontSize={13} style={styles.onAccent}>
              Track
            </CustomText>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </Pressable>
        </Animated.View>
      ) : null}

      {rideAllowed ? (
        <Animated.View entering={FadeInDown.delay(60).duration(420)}>
          <Pressable
            ref={whereToRef}
            onPress={() =>
              router.navigate({
                pathname: "/customer/selectlocations",
                params: { serviceType: "RIDE" },
              })
            }
            style={({ pressed }) => [styles.whereTo, pressed && styles.pressed]}
            accessibilityRole="search"
            accessibilityLabel="Where to? Book a ride"
          >
            <Ionicons name="search" size={18} color={DS.color.textSoft} />
            <CustomText fontFamily="Medium" fontSize={15} style={styles.whereToText}>
              Where to?
            </CustomText>
            <View style={styles.whereToBadge}>
              <Ionicons name="car" size={14} color="#15803d" />
              <CustomText fontFamily="SemiBold" fontSize={12} style={styles.whereToBadgeText}>
                Ride
              </CustomText>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}

      <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionTitle}>
        What do you need today?
      </CustomText>
      <View ref={servicesRef} collapsable={false}>
        <CircularServiceSelector goToHomeOnSelect />
      </View>

      <OrderAgainRow orders={pastOrders} bleed={PAGE_PAD} />

      {promoBanners.length > 0 ? (
        <View style={styles.promos}>
          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionTitle}>
            Offers for you
          </CustomText>
          <View style={styles.bleed}>
            <FoodPromoCarousel banners={promoBanners} accent={Colors.theme} />
          </View>
        </View>
      ) : null}

      <WelcomeSlides visible={ready && !welcomeSeen} onDone={() => markSeen(userId, "welcome")} />
      <SpotlightTour
        visible={ready && welcomeSeen && !tourSeen}
        steps={tourSteps}
        onDone={() => markSeen(userId, "tour:home")}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    paddingTop: 4,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  logo: {
    width: 38,
    height: 38,
  },
  headerCopy: {
    flex: 1,
  },
  greeting: {
    color: DS.color.textMuted,
  },
  name: {
    color: Colors.text,
    letterSpacing: -0.3,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...DS.shadow.card,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.tertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
  },
  activeOrder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  activeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  onAccent: {
    color: "#fff",
  },
  onAccentSoft: {
    color: "rgba(255,255,255,0.9)",
    marginTop: 1,
  },
  whereTo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    marginBottom: 20,
    ...DS.shadow.card,
  },
  whereToText: {
    flex: 1,
    color: DS.color.textMuted,
  },
  whereToBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dcfce7",
    borderRadius: DS.radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  whereToBadgeText: {
    color: "#166534",
  },
  sectionTitle: {
    color: Colors.text,
    marginBottom: 10,
  },
  promos: {
    marginTop: 22,
  },
  bleed: {
    marginHorizontal: -PAGE_PAD,
  },
});

export default ServiceSelectScreen;
