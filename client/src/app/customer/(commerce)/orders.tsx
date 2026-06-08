import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
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

type TabKey = "all" | "stores" | "rides";

const ACTIVE_FOOD_STATUSES = ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP"];

function foodStatusLabel(status: string): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

const CustomerOrders = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [tab, setTab] = useState<TabKey>("all");
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

  useEffect(() => {
    load();
  }, [load]);

  const showFood = tab === "all" || tab === "stores";
  const showRides = tab === "all" || tab === "rides";

  const foodList = useMemo(() => (showFood ? foodOrders : []), [foodOrders, showFood]);
  const rideList = useMemo(
    () => (showRides ? rides.filter((ride) => !isFoodCourierRide(ride)) : []),
    [rides, showRides]
  );

  const isEmpty = !loading && foodList.length === 0 && rideList.length === 0;

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

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "stores", label: "Stores" },
    { key: "rides", label: "Rides" },
  ];

  const renderFoodOrder = (order: FoodOrder) => {
    const active = ACTIVE_FOOD_STATUSES.includes(order.status);
    const vertical = resolveOrderVertical(order);
    const copy = getCommerceOrderCopy(vertical);
    return (
      <TouchableOpacity
        key={order._id}
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
            <CustomText fontSize={12} color={FOOD_THEME.textLight} style={{ marginTop: 2 }}>
              {foodStatusLabel(order.status)}
              {order.createdAt
                ? ` · ${new Date(order.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <CustomText fontFamily="Bold" fontSize={22}>
          Orders
        </CustomText>
        <CustomText fontSize={13} color="#888" style={{ marginTop: 4 }}>
          Store orders and ride history
        </CustomText>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabChip, tab === t.key && styles.tabChipActive]}
            onPress={() => setTab(t.key)}
          >
            <CustomText
              fontSize={13}
              fontFamily="Medium"
              style={{ color: tab === t.key ? "#fff" : Colors.text }}
            >
              {t.label}
            </CustomText>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={FOOD_THEME.orange} />
        </View>
      ) : isEmpty ? (
        <View style={styles.center}>
          <EmptyStateCard
            icon="📋"
            title="No orders yet"
            description={
              tab === "stores"
                ? "Your food, grocery and pharmacy orders will show up here."
                : tab === "rides"
                ? "Your rides and parcel deliveries will appear here."
                : "Place a store order or book a ride to see activity here."
            }
          />
        </View>
      ) : (
        <FlatList
          data={[{ type: "content" }]}
          keyExtractor={() => "orders-content"}
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
            paddingBottom: tabBarHeight + 16,
          }}
          renderItem={() => (
            <View>
              {showFood && foodList.length > 0 ? (
                <View style={styles.section}>
                  {tab === "all" ? (
                    <View style={styles.sectionHead}>
                      <MaterialIcons name="storefront" size={18} color={FOOD_THEME.orange} />
                      <CustomText fontFamily="SemiBold" fontSize={15} style={{ marginLeft: 6 }}>
                        Store orders
                      </CustomText>
                    </View>
                  ) : null}
                  {foodList.map(renderFoodOrder)}
                </View>
              ) : null}

              {showRides && rideList.length > 0 ? (
                <View style={[styles.section, showFood && foodList.length > 0 && { marginTop: 8 }]}>
                  {tab === "all" ? (
                    <View style={styles.sectionHead}>
                      <Ionicons name="car-outline" size={18} color={Colors.primary} />
                      <CustomText fontFamily="SemiBold" fontSize={15} style={{ marginLeft: 6 }}>
                        Rides & parcels
                      </CustomText>
                    </View>
                  ) : null}
                  {rideList.map((ride) => (
                    <RideCard
                      key={ride._id}
                      item={ride}
                      onReBook={() => handleReBook(ride)}
                      role="customer"
                    />
                  ))}
                </View>
              ) : null}
            </View>
          )}
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
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
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
  section: {
    marginTop: 4,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
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
