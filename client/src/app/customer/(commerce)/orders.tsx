import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  ScrollView,
  TextInput,
} from "react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import RideCard from "@/components/shared/RideCard";
import { fetchRideHistory, createRide } from "@/service/rideService";
import { fetchMyFoodOrders, FoodOrder } from "@/service/foodService";
import { Colors, formatCurrency } from "@/utils/Constants";
import { getVehicleForApi } from "@/utils/mapUtils";
import { FOOD_THEME } from "@/styles/foodStyles";
import { DS } from "@/theme/designSystem";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import { isFoodCourierRide } from "@/utils/riderRideUtils";
import { getCommerceOrderCopy, resolveOrderVertical } from "@/utils/commerceOrderCopy";
import type { StoreVertical } from "@/utils/storeVertical";

import { useRefetchOnReconnect } from "@/utils/useRefetchOnReconnect";
import { useConnectivity } from "@/service/connectivity";
/** One chip per service, so each has its own history. */
type FilterKey = "all" | "rides" | "parcels" | StoreVertical;

const FILTERS: { key: FilterKey; label: string; empty: string }[] = [
  { key: "all", label: "All", empty: "Your rides, parcels and store orders will show up here." },
  { key: "rides", label: "Rides", empty: "Your rides will show up here." },
  { key: "parcels", label: "Parcels", empty: "Parcels you send or receive will show up here." },
  { key: "FOOD", label: "Food", empty: "Your food orders will show up here." },
  { key: "GROCERY", label: "Grocery", empty: "Your grocery orders will show up here." },
  { key: "PHARMACY", label: "Pharmacy", empty: "Your pharmacy orders will show up here." },
  { key: "GAS", label: "Gas", empty: "Your gas refills and exchanges will show up here." },
  { key: "LAUNDRY", label: "Laundry", empty: "Your laundry orders will show up here." },
];

const ACTIVE_FOOD_STATUSES = ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP"];
const ACTIVE_RIDE_STATUSES = ["SEARCHING_FOR_RIDER", "START", "ARRIVED", "IN_PROGRESS"];

type Entry =
  | { kind: "store"; id: string; key: FilterKey; time: number; active: boolean; text: string; order: FoodOrder }
  | { kind: "ride"; id: string; key: FilterKey; time: number; active: boolean; text: string; ride: any };

function foodStatusLabel(status: string): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

const timeOf = (iso?: string) => (iso ? new Date(iso).getTime() || 0 : 0);
const searchText = (parts: unknown[]) =>
  parts.filter((p) => typeof p === "string" && p).join(" ").toLowerCase();

const CustomerOrders = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  // Other screens can open this list on one service, e.g. ?filter=parcels from Parcel home.
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<FilterKey>(() =>
    FILTERS.some((f) => f.key === filterParam) ? (filterParam as FilterKey) : "all"
  );
  const [query, setQuery] = useState("");
  const [rides, setRides] = useState<any[]>([]);
  const [foodOrders, setFoodOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rideData, foodData] = await Promise.all([
        fetchRideHistory().catch(() => []),
        fetchMyFoodOrders().catch(() => []),
      ]);
      setRides(rideData ?? []);
      setFoodOrders(foodData ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useRefetchOnReconnect(load);
  const online = useConnectivity((s) => s.online);

  useEffect(() => {
    load();
  }, [load]);

  // Rides, parcels and store orders in one list, newest first, each tagged with its service.
  const entries = useMemo<Entry[]>(() => {
    const store: Entry[] = foodOrders.map((order) => {
      const vertical = resolveOrderVertical(order);
      return {
        kind: "store",
        id: order._id,
        key: vertical,
        time: timeOf(order.createdAt),
        active: ACTIVE_FOOD_STATUSES.includes(order.status),
        text: searchText([
          order.restaurantName,
          ...(order.items || []).map((i) => i.name),
          order.delivery?.address,
          foodStatusLabel(order.status),
          getCommerceOrderCopy(vertical).storeNameFallback,
          FILTERS.find((f) => f.key === vertical)?.label,
          String(order._id).slice(-8),
        ]),
        order,
      };
    });
    const trips: Entry[] = rides
      .filter((ride) => !isFoodCourierRide(ride))
      .map((ride) => {
        const parcel = ride.serviceType === "DELIVERY";
        return {
          kind: "ride",
          id: ride._id,
          key: parcel ? "parcels" : "rides",
          time: timeOf(ride.createdAt),
          active: ACTIVE_RIDE_STATUSES.includes(ride.status),
          text: searchText([
            ride.pickup?.address,
            ride.drop?.address,
            ride.recipientName,
            ride.recipientPhone,
            ride.parcelDescription,
            ride.rider?.name,
            ride.vehicle,
            parcel ? "parcel delivery" : "ride",
            String(ride.status || "").replace(/_/g, " "),
            String(ride._id).slice(-8),
          ]),
          ride,
        };
      });
    return [...store, ...trips].sort((a, b) => Number(b.active) - Number(a.active) || b.time - a.time);
  }, [foodOrders, rides]);

  const counts = useMemo(() => {
    const c: Partial<Record<FilterKey, number>> = { all: entries.length };
    for (const e of entries) c[e.key] = (c[e.key] ?? 0) + 1;
    return c;
  }, [entries]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      entries.filter(
        (e) => (filter === "all" || e.key === filter) && (!q || q.split(/\s+/).every((w) => e.text.includes(w)))
      ),
    [entries, filter, q]
  );

  const handleReBook = useCallback(async (ride: any) => {
    if (!ride.pickup?.latitude || !ride.drop?.latitude) return;
    try {
      await createRide({
        serviceType: ride.serviceType || "RIDE",
        vehicle: getVehicleForApi(ride.vehicle),
        pickup: {
          address: ride.pickup.address,
          latitude: Number(ride.pickup.latitude),
          longitude: Number(ride.pickup.longitude),
        },
        drop: {
          address: ride.drop.address,
          latitude: Number(ride.drop.latitude),
          longitude: Number(ride.drop.longitude),
        },
        ...(ride.serviceType === "DELIVERY" && ride.recipientName && ride.recipientPhone
          ? {
              parcelMode: ride.parcelMode === "RECEIVE" ? "RECEIVE" : "SEND",
              recipientName: ride.recipientName,
              recipientPhone: ride.recipientPhone,
              parcelDescription: ride.parcelDescription,
            }
          : {}),
      });
    } catch {
      // createRide shows alert
    }
  }, []);

  const renderFoodOrder = (order: FoodOrder) => {
    const active = ACTIVE_FOOD_STATUSES.includes(order.status);
    const vertical = resolveOrderVertical(order);
    const copy = getCommerceOrderCopy(vertical);
    const rx = order.pharmacyQuote?.priceStatus;
    const summary =
      rx === "awaiting_pharmacy"
        ? "Prescription · waiting for the price"
        : rx === "awaiting_customer" && order.status === "PLACED"
        ? "Prescription · price ready to approve"
        : (order.items || []).map((i) => `${i.quantity}× ${i.name}`).join(", ") || (rx ? "Prescription" : "");
    return (
      <TouchableOpacity
        style={styles.foodCard}
        activeOpacity={0.9}
        onPress={() => router.push(`/customer/stores/order/${order._id}` as const)}
      >
        <View style={styles.foodCardTop}>
          <View style={styles.foodIconWrap}>
            <CustomText fontSize={20}>{copy.storeEmoji}</CustomText>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <CustomText fontFamily="SemiBold" fontSize={15} numberOfLines={1}>
              {order.restaurantName}
            </CustomText>
            {summary ? (
              <CustomText fontSize={12} color={FOOD_THEME.textLight} numberOfLines={1} style={{ marginTop: 2 }}>
                {summary}
              </CustomText>
            ) : null}
            <CustomText fontSize={12} color={FOOD_THEME.textLight} style={{ marginTop: 2 }}>
              {foodStatusLabel(order.status)}
              {order.createdAt
                ? ` · ${new Date(order.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}`
                : ""}
            </CustomText>
          </View>
          <CustomText fontFamily="SemiBold" fontSize={14}>
            {formatCurrency(order.total)}
          </CustomText>
        </View>
        {active ? (
          <View style={styles.activePill}>
            <CustomText fontFamily="Medium" fontSize={11} style={{ color: FOOD_THEME.orange }}>
              In progress · Tap to track
            </CustomText>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const filterInfo = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <CustomText fontFamily="Bold" fontSize={22}>
          Orders
        </CustomText>
        <CustomText fontSize={13} color="#888" style={{ marginTop: 4 }}>
          Rides, parcels and store orders
        </CustomText>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by store, item, address or name"
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {FILTERS.map((t) => {
            const selected = filter === t.key;
            const n = counts[t.key] ?? 0;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabChip, selected && styles.tabChipActive]}
                onPress={() => setFilter(t.key)}
              >
                <CustomText fontSize={13} fontFamily="Medium" style={{ color: selected ? "#fff" : Colors.text }}>
                  {t.label}
                  {n > 0 ? ` · ${n}` : ""}
                </CustomText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={FOOD_THEME.orange} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(e) => `${e.kind}-${e.id}`}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={FOOD_THEME.orange}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: tabBarHeight + 16,
            flexGrow: 1,
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <EmptyStateCard
                icon={!online ? "📶" : q ? "🔍" : "📋"}
                title={!online ? "Can't load your orders" : q ? "Nothing matches your search" : "No orders yet"}
                description={
                  !online
                    ? "You're offline. Your orders will appear here once you're back online."
                    : q
                      ? `Nothing in ${filter === "all" ? "your history" : filterInfo.label} matches "${query.trim()}".`
                      : filterInfo.empty
                }
              />
            </View>
          }
          renderItem={({ item }) =>
            item.kind === "store" ? (
              renderFoodOrder(item.order)
            ) : (
              <RideCard item={item.ride} onReBook={() => handleReBook(item.ride)} role="customer" />
            )
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.color.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  tabBar: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tabRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  tabChipActive: {
    backgroundColor: FOOD_THEME.orange,
  },
  foodCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: FOOD_THEME.border,
  },
  foodCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  foodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: FOOD_THEME.orangeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  activePill: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#fff7ed",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
});

export default CustomerOrders;
