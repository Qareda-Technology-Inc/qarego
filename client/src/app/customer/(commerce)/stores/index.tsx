import {
  View,
  Text,
  FlatList,
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
} from "@/service/foodService";
import { useFoodCartStore } from "@/store/foodCartStore";
import { useUserStore } from "@/store/userStore";
import RestaurantCard from "@/components/customer/food/RestaurantCard";
import StoreTypeFilterRow, {
  STORE_TYPE_FILTERS,
} from "@/components/customer/food/StoreTypeFilterRow";
import DeliverToBar from "@/components/customer/food/DeliverToBar";
import CuisineCarousel from "@/components/customer/food/CuisineCarousel";
import { COMMERCE_SEARCH_HINT, FOOD_THEME } from "@/styles/foodStyles";
import CommerceModuleLinks from "@/components/customer/food/CommerceModuleLinks";
import CommerceTopBar from "@/components/customer/food/CommerceTopBar";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import { DS } from "@/theme/designSystem";
import {
  STORE_VERTICAL_CONFIG,
  StoreTypeFilter,
  StoreVertical,
  resolveStoreVertical,
  matchesStoreTypeFilter,
  normalizeStoreTypeFilter,
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

const AllStoresBrowse = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const params = useLocalSearchParams<{ type?: string }>();
  const typeFilter = useMemo(() => normalizeStoreTypeFilter(params.type), [params.type]);
  const accent =
    typeFilter === "ALL"
      ? STORE_TYPE_FILTERS[0].accent
      : STORE_VERTICAL_CONFIG[typeFilter as StoreVertical].accent;
  const screenTitle =
    typeFilter === "ALL"
      ? "Stores"
      : STORE_VERTICAL_CONFIG[typeFilter as StoreVertical].title;
  const moduleActive:
    | "FOOD_HOME"
    | StoreVertical
    | "NONE" =
    typeFilter === "FOOD" || typeFilter === "GROCERY" || typeFilter === "PHARMACY"
      ? typeFilter
      : "NONE";

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [activeOrder, setActiveOrder] = useState<FoodOrder | null>(null);
  const [fareRates, setFareRates] = useState<
    Record<string, { baseFare: number; perKmRate: number; minimumFare: number }> | null
  >(null);
  const itemCount = useFoodCartStore((s) => s.itemCount());
  const { location, setLocation } = useUserStore();

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await fetchRestaurants();
      setRestaurants(data);
    } catch (e: unknown) {
      setRestaurants([]);
      const msg =
        (e as { response?: { data?: { msg?: string } } })?.response?.data?.msg ||
        (e instanceof Error ? e.message : "Could not load stores");
      setLoadError(msg);
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
    fetchFoodCheckoutSettings(typeFilter === "ALL" ? "FOOD" : typeFilter)
      .then((cfg) => setFareRates(cfg.fareRates ?? null))
      .catch(() => setFareRates(null));
  }, [typeFilter]);

  useEffect(() => {
    ensureUserDeliveryLocation(location, setLocation).catch(() => {});
  }, [location, setLocation]);

  const typeStores = useMemo(
    () => restaurants.filter((r) => matchesStoreTypeFilter(r, typeFilter)),
    [restaurants, typeFilter]
  );

  const categories = useMemo(() => browseFilterTags(typeFilter), [typeFilter]);

  const filtered = useMemo(() => {
    return typeStores.filter((r) => {
      return categoryFilter === "All" || storeMatchesBrowseTag(r, categoryFilter);
    });
  }, [typeStores, categoryFilter]);

  const setTypeFilter = (type: StoreTypeFilter) => {
    setCategoryFilter("All");
    router.navigate({
      pathname: "/customer/stores",
      params: type === "ALL" ? {} : { type },
    });
  };

  const openStore = (item: Restaurant) => {
    const vertical = resolveStoreVertical(item);
    router.push({
      pathname: "/customer/stores/[id]",
      params: { id: item._id, vertical },
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

  const ListHeader = () => (
    <View>
      {activeOrder ? (
        <TouchableOpacity
          style={[styles.activeOrderBanner, { backgroundColor: accent }]}
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
        onPress={() =>
          router.push({
            pathname: "/customer/search",
            params: typeFilter === "ALL" ? {} : { type: typeFilter },
          })
        }
      >
        <Ionicons name="search" size={18} color={FOOD_THEME.text} />
        <Text style={styles.searchCtaText}>{COMMERCE_SEARCH_HINT}</Text>
        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
      </TouchableOpacity>

      <CuisineCarousel
        cuisines={categories}
        selected={categoryFilter}
        onSelect={setCategoryFilter}
        vertical={
          typeFilter === "ALL" || typeFilter === "FOOD"
            ? "FOOD"
            : typeFilter
        }
      />

      <View style={styles.exploreSection}>
        <View style={styles.allHeader}>
          <View style={{ flex: 1 }}>
            <CustomText fontFamily="Bold" fontSize={19} style={styles.allTitle}>
              {categoryFilter === "All" ? "Explore all stores" : "Filtered stores"}
            </CustomText>
            <CustomText fontSize={13} color={FOOD_THEME.textLight} style={{ marginTop: 2 }}>
              {typeFilter === "ALL"
                ? "Food & restaurants, groceries & supermarket, and pharmacy near you"
                : STORE_VERTICAL_CONFIG[typeFilter as StoreVertical].subtitle}
            </CustomText>
          </View>
          <View style={[styles.countPill, { borderColor: accent }]}>
            <CustomText fontFamily="SemiBold" fontSize={12} style={{ color: accent }}>
              {filtered.length}
            </CustomText>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.headerBlock, { paddingTop: insets.top }]}>
        <CommerceTopBar title={screenTitle} accent={accent} itemCount={itemCount} />
        <DeliverToBar accentColor={accent} />
        <CommerceModuleLinks active={moduleActive} />
        <StoreTypeFilterRow value={typeFilter} onChange={setTypeFilter} style={styles.typeFilterScroll} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={accent} />
          <CustomText fontSize={14} color={FOOD_THEME.textMuted} style={{ marginTop: 12 }}>
            Loading stores…
          </CustomText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <View style={styles.gridItemWrap}>
              <RestaurantCard
                restaurant={item}
                variant="grid"
                onPress={() => openStore(item)}
                deliveryAmount={deliveryAmount(item)}
              />
            </View>
          )}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyStateCard
                icon={loadError ? "⚠️" : "🛒"}
                title={loadError ? "Could not load stores" : "No stores in this category"}
                description={
                  loadError
                    ? loadError
                    : typeFilter === "ALL"
                    ? "No stores are available yet in your area."
                    : STORE_VERTICAL_CONFIG[typeFilter as StoreVertical].emptyDescription
                }
              />
              {categoryFilter !== "All" ? (
                <TouchableOpacity style={styles.resetBtn} onPress={() => setCategoryFilter("All")}>
                  <CustomText fontFamily="Medium" fontSize={14} style={{ color: accent }}>
                    Clear category filter
                  </CustomText>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
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
  typeFilterScroll: {
    marginTop: 4,
  },
  activeOrderBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
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
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: FOOD_THEME.divider,
    backgroundColor: FOOD_THEME.searchBg,
  },
  allHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  allTitle: { color: FOOD_THEME.text },
  countPill: {
    minWidth: 36,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  gridRow: { paddingHorizontal: 16, gap: 12 },
  gridItemWrap: { flex: 1, minWidth: 0 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 32 },
  resetBtn: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 20 },
});

export default AllStoresBrowse;
