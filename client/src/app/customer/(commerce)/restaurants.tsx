import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import {
  fetchRestaurants,
  fetchFoodCheckoutSettings,
  Restaurant,
} from "@/service/foodService";
import { useUserStore } from "@/store/userStore";
import RestaurantCard from "@/components/customer/food/RestaurantCard";
import CuisineCarousel from "@/components/customer/food/CuisineCarousel";
import { FOOD_THEME } from "@/styles/foodStyles";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import { DS } from "@/theme/designSystem";
import { STORE_VERTICAL_CONFIG, isRestaurantStore } from "@/utils/storeVertical";
import {
  browseFilterTags,
  storeMatchesBrowseTag,
} from "@/utils/commerceVerticalTags";
import { calculateDistance, calculateFoodDeliveryFee } from "@/utils/mapUtils";
import {
  ensureUserDeliveryLocation,
  hasValidDeliveryCoords,
} from "@/utils/ensureDeliveryLocation";

const FOOD_CONFIG = STORE_VERTICAL_CONFIG.FOOD;

/** Full restaurant list (food only) — opened from Home, not the Stores tab. */
const RestaurantsBrowse = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [fareRates, setFareRates] = useState<
    Record<string, { baseFare: number; perKmRate: number; minimumFare: number }> | null
  >(null);
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
        (e instanceof Error ? e.message : "Could not load restaurants");
      setLoadError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchFoodCheckoutSettings("FOOD")
      .then((cfg) => setFareRates(cfg.fareRates ?? null))
      .catch(() => setFareRates(null));
  }, [load]);

  useEffect(() => {
    ensureUserDeliveryLocation(location, setLocation).catch(() => {});
  }, [location, setLocation]);

  const foodStores = useMemo(
    () => restaurants.filter(isRestaurantStore),
    [restaurants]
  );

  const categories = useMemo(() => browseFilterTags("FOOD"), []);

  const filtered = useMemo(() => {
    return foodStores.filter((r) => {
      return categoryFilter === "All" || storeMatchesBrowseTag(r, categoryFilter);
    });
  }, [foodStores, categoryFilter]);

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

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={FOOD_THEME.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <CustomText fontFamily="Bold" fontSize={20} style={styles.title}>
            {FOOD_CONFIG.allTitle}
          </CustomText>
          <CustomText fontSize={13} color={FOOD_THEME.textLight} style={{ marginTop: 2 }}>
            Filter by cuisine and browse every restaurant
          </CustomText>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={FOOD_CONFIG.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
          ListHeaderComponent={
            <View>
              <CuisineCarousel
                cuisines={categories}
                selected={categoryFilter}
                onSelect={setCategoryFilter}
                vertical="FOOD"
              />
              <View style={styles.countRow}>
                <CustomText fontSize={13} color={FOOD_THEME.textLight}>
                  {filtered.length} restaurant{filtered.length !== 1 ? "s" : ""}
                </CustomText>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <RestaurantCard
                restaurant={item}
                variant="grid"
                onPress={() =>
                  router.push({
                    pathname: "/customer/stores/[id]",
                    params: { id: item._id, vertical: "FOOD" },
                  })
                }
                deliveryAmount={deliveryAmount(item)}
              />
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={FOOD_CONFIG.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyStateCard
                icon={loadError ? "⚠️" : "🍽️"}
                title={loadError ? "Could not load restaurants" : "No restaurants yet"}
                description={
                  loadError || FOOD_CONFIG.emptyDescription
                }
              />
              {categoryFilter !== "All" ? (
                <TouchableOpacity style={styles.resetBtn} onPress={() => setCategoryFilter("All")}>
                  <CustomText fontFamily="Medium" fontSize={14} style={{ color: FOOD_CONFIG.accent }}>
                    Clear filter
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: FOOD_THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: FOOD_THEME.divider,
    gap: 8,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { color: FOOD_THEME.text },
  gridRow: { paddingHorizontal: 16, gap: 12 },
  gridItem: { flex: 1, minWidth: 0 },
  countRow: { paddingHorizontal: 16, paddingBottom: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { paddingTop: 48, paddingHorizontal: 32, alignItems: "center" },
  resetBtn: { marginTop: 16 },
});

export default RestaurantsBrowse;
