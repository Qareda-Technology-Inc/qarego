import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import {
  fetchRestaurants,
  fetchActiveFoodOrder,
  fetchFoodCheckoutSettings,
  Restaurant,
  FoodOrder,
  FoodPromoBanner,
} from "@/service/foodService";
import { useFoodCartStore } from "@/store/foodCartStore";
import { useUserStore } from "@/store/userStore";
import DeliverToBar from "@/components/customer/food/DeliverToBar";
import CuisineCarousel from "@/components/customer/food/CuisineCarousel";
import RestaurantCarouselSection from "@/components/customer/food/RestaurantCarouselSection";
import RestaurantCard from "@/components/customer/food/RestaurantCard";
import FoodPromoCarousel from "@/components/customer/food/FoodPromoCarousel";
import CommerceModuleLinks from "@/components/customer/food/CommerceModuleLinks";
import CommerceTopBar from "@/components/customer/food/CommerceTopBar";
import { COMMERCE_SEARCH_HINT, FOOD_THEME, GRID_H_PAD } from "@/styles/foodStyles";
import { DS } from "@/theme/designSystem";
import {
  STORE_VERTICAL_CONFIG,
  isRestaurantStore,
  resolveStoreVertical,
} from "@/utils/storeVertical";
import {
  browseFilterTags,
  storeMatchesBrowseTag,
} from "@/utils/commerceVerticalTags";
import { calculateDistance, calculateFoodDeliveryFee } from "@/utils/mapUtils";
import {
  ensureUserDeliveryLocation,
  hasValidDeliveryCoords,
} from "@/utils/ensureDeliveryLocation";

const CommerceHome = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const params = useLocalSearchParams<{ storeType?: string }>();
  const verticalConfig = STORE_VERTICAL_CONFIG.FOOD;
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [activeOrder, setActiveOrder] = useState<FoodOrder | null>(null);
  const [fareRates, setFareRates] = useState<
    Record<string, { baseFare: number; perKmRate: number; minimumFare: number }> | null
  >(null);
  const [promoBanners, setPromoBanners] = useState<FoodPromoBanner[]>([]);
  const itemCount = useFoodCartStore((s) => s.itemCount());
  const { location, setLocation } = useUserStore();

  const load = useCallback(async () => {
    try {
      const data = await fetchRestaurants();
      setRestaurants(data);
    } catch {
      setRestaurants([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchActiveFoodOrder().then(setActiveOrder).catch(() => setActiveOrder(null));
  }, [load]);

  useEffect(() => {
    const raw = Array.isArray(params.storeType) ? params.storeType[0] : params.storeType;
    const type = String(raw ?? "").toUpperCase();
    if (type === "GROCERY" || type === "PHARMACY") {
      router.replace({ pathname: "/customer/stores", params: { type } });
    }
  }, [params.storeType]);

  useEffect(() => {
    fetchFoodCheckoutSettings("FOOD")
      .then((cfg) => {
        setFareRates(cfg.fareRates ?? null);
        setPromoBanners(cfg.promoBanners ?? []);
      })
      .catch(() => {
        setFareRates(null);
        setPromoBanners([]);
      });
  }, []);

  useEffect(() => {
    ensureUserDeliveryLocation(location, setLocation).catch(() => {});
  }, [location, setLocation]);

  const verticalRestaurants = useMemo(
    () => restaurants.filter(isRestaurantStore),
    [restaurants]
  );

  const categories = useMemo(() => browseFilterTags("FOOD"), []);

  const filtered = useMemo(() => {
    return verticalRestaurants.filter((r) => {
      return categoryFilter === "All" || storeMatchesBrowseTag(r, categoryFilter);
    });
  }, [verticalRestaurants, categoryFilter]);

  const topPicks = useMemo(
    () => [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 6),
    [filtered]
  );

  const quickDelivery = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => (a.estimatedPrepMinutes ?? 99) - (b.estimatedPrepMinutes ?? 99))
        .slice(0, 6),
    [filtered]
  );

  const newOnQarego = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 6),
    [filtered]
  );

  const exploreAllStores = useMemo(
    () => [...restaurants].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)),
    [restaurants]
  );

  const openStore = (item: Restaurant) => {
    const vertical = resolveStoreVertical(item);
    router.push({
      pathname: "/customer/stores/[id]",
      params: { id: item._id, vertical },
    });
  };

  const openRestaurant = (id: string) => {
    router.push({
      pathname: "/customer/stores/[id]",
      params: { id, vertical: "FOOD" },
    });
  };

  const deliveryAmount = useCallback(
    (r: Restaurant) => {
      if (
        !hasValidDeliveryCoords(location) ||
        typeof r.latitude !== "number" ||
        typeof r.longitude !== "number"
      ) {
        return undefined;
      }
      const km = calculateDistance(r.latitude, r.longitude, location!.latitude, location!.longitude);
      return calculateFoodDeliveryFee(km, fareRates);
    },
    [location, fareRates]
  );

  const offerBadge = (r: Restaurant) => ((r.rating ?? 0) >= 4.6 ? "Top rated" : "Popular");

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.headerBlock, { paddingTop: insets.top }]}>
        <CommerceTopBar
          title={verticalConfig.title}
          accent={verticalConfig.accent}
          itemCount={itemCount}
        />
        <DeliverToBar accentColor={verticalConfig.accent} />
        <CommerceModuleLinks active="FOOD_HOME" />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={verticalConfig.accent} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: tabBarHeight + 16,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={verticalConfig.accent}
            />
          }
        >
          {activeOrder ? (
            <TouchableOpacity
              style={[styles.activeOrderBanner, { backgroundColor: verticalConfig.accent }]}
              activeOpacity={0.9}
              onPress={() => router.push(`/customer/stores/order/${activeOrder._id}` as const)}
            >
              <View style={{ flex: 1 }}>
                <CustomText fontFamily="SemiBold" fontSize={14} style={{ color: "#fff" }}>
                  Order in progress
                </CustomText>
                <CustomText fontSize={12} style={{ color: "rgba(255,255,255,0.9)", marginTop: 2 }}>
                  {activeOrder.restaurantName} · Tap to track
                </CustomText>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.searchCta}
            activeOpacity={0.85}
            onPress={() => router.push("/customer/search")}
          >
            <Ionicons name="search" size={18} color={FOOD_THEME.text} />
            <Text style={styles.searchCtaText}>{COMMERCE_SEARCH_HINT}</Text>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>

          {promoBanners.length > 0 ? (
            <FoodPromoCarousel banners={promoBanners} accent={verticalConfig.accent} />
          ) : null}

          <CuisineCarousel
            cuisines={categories}
            selected={categoryFilter}
            onSelect={setCategoryFilter}
            vertical="FOOD"
          />

          <RestaurantCarouselSection
            title={verticalConfig.discoverTitle}
            data={topPicks}
            onPressRestaurant={openRestaurant}
            badge={offerBadge}
            deliveryAmount={deliveryAmount}
          />
          <RestaurantCarouselSection
            title={verticalConfig.quickTitle}
            data={quickDelivery}
            onPressRestaurant={openRestaurant}
            badge={() => "Fast prep"}
            deliveryAmount={deliveryAmount}
          />
          <RestaurantCarouselSection
            title={verticalConfig.newTitle}
            data={newOnQarego}
            onPressRestaurant={openRestaurant}
            badge={() => "New"}
            deliveryAmount={deliveryAmount}
          />

          <View style={styles.exploreSection}>
            <CustomText fontFamily="Bold" fontSize={15} style={styles.exploreTitle}>
              Explore All
            </CustomText>
            {exploreAllStores.map((store) => (
              <View key={store._id} style={styles.exploreCardWrap}>
                <RestaurantCard
                  restaurant={store}
                  variant="fullWidth"
                  onPress={() => openStore(store)}
                  deliveryAmount={deliveryAmount(store)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.color.bg },
  headerBlock: {
    backgroundColor: FOOD_THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: FOOD_THEME.divider,
    paddingBottom: 8,
  },
  activeOrderBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
  },
  searchCta: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    backgroundColor: FOOD_THEME.searchBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
    borderColor: FOOD_THEME.border,
  },
  searchCtaText: {
    flex: 1,
    fontSize: 13,
    color: FOOD_THEME.searchHint,
    fontWeight: "400",
  },
  exploreSection: {
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: GRID_H_PAD,
  },
  exploreTitle: {
    color: FOOD_THEME.text,
    marginBottom: 12,
  },
  exploreCardWrap: {
    marginBottom: 16,
  },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
});

export default CommerceHome;
