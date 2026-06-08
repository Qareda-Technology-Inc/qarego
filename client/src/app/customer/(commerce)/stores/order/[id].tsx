import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import CustomButton from "@/components/shared/CustomButton";
import { formatCurrency } from "@/utils/Constants";
import { fetchFoodOrder, FoodOrder } from "@/service/foodService";
import { useWS } from "@/service/WSProvider";
import OrderStatusTimeline from "@/components/customer/food/OrderStatusTimeline";
import {
  buildFoodTrackingSteps,
  getHeroStatusLabel,
  getFoodDeliveryCode,
  shouldShowFoodDeliveryCode,
  FoodOrderStatus,
} from "@/utils/foodOrderTracking";
import DeliveryCodeCard from "@/components/customer/food/DeliveryCodeCard";
import CustomerLogoutButton from "@/components/customer/CustomerLogoutButton";
import { FOOD_THEME } from "@/styles/foodStyles";
import RestaurantRatingModal from "@/components/customer/food/RestaurantRatingModal";
import { isFoodOrderRateable } from "@/utils/ratingFlow";
import {
  commerceHomePath,
  getCommerceOrderCopy,
  resolveOrderVertical,
} from "@/utils/commerceOrderCopy";
import { STORE_VERTICAL_CONFIG } from "@/utils/storeVertical";

const POLL_MS = 4000;

const FoodOrderTracking = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { emit, on, off } = useWS();
  const [order, setOrder] = useState<FoodOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const [ratingPrompted, setRatingPrompted] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchFoodOrder(id);
      setOrder(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    emit("subscribeFoodOrder", id);
    const handler = (updated: FoodOrder) => {
      if (updated?._id === id) setOrder(updated);
    };
    on("foodOrderUpdated", handler);
    return () => off("foodOrderUpdated");
  }, [id, emit, on, off]);

  useEffect(() => {
    if (!order || order.status === "DELIVERED" || order.status === "CANCELLED") return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [order?.status, load]);

  const vertical = useMemo(
    () => resolveOrderVertical(order ?? undefined),
    [order]
  );
  const copy = getCommerceOrderCopy(vertical);
  const verticalTheme = STORE_VERTICAL_CONFIG[vertical];
  const shopHome = commerceHomePath(vertical);

  const steps = useMemo(
    () => (order ? buildFoodTrackingSteps(order.status, order.ride, vertical) : []),
    [order, vertical]
  );

  const hero = useMemo(
    () => (order ? getHeroStatusLabel(order.status, order.ride, order) : null),
    [order]
  );

  const showLiveMap =
    order?.ride?._id &&
    order.status !== "CANCELLED" &&
    order.status !== "DELIVERED" &&
    ["SEARCHING_FOR_RIDER", "START", "ARRIVED", "IN_PROGRESS"].includes(
      order.ride?.status ?? ""
    );

  const isTerminal = order?.status === "DELIVERED" || order?.status === "CANCELLED";
  const canRateRestaurant = isFoodOrderRateable(order);

  useEffect(() => {
    if (canRateRestaurant && !ratingPrompted) {
      setRatingPrompted(true);
      setShowRating(true);
    }
  }, [canRateRestaurant, ratingPrompted]);
  const deliveryCode = order ? getFoodDeliveryCode(order) : null;
  const showDeliveryCode =
    order && deliveryCode && shouldShowFoodDeliveryCode(order.status, order.ride);
  const codeIsActive = order?.ride?.status === "IN_PROGRESS";

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={verticalTheme.accent} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <CustomText>Order not found</CustomText>
        <TouchableOpacity onPress={() => router.replace(shopHome as any)} style={{ marginTop: 16 }}>
          <CustomText color={verticalTheme.accent}>{copy.customerBackToShop}</CustomText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace(shopHome as any)} style={styles.headerBtn}>
          <MaterialIcons name="close" size={24} color={FOOD_THEME.text} />
        </TouchableOpacity>
        <CustomText fontFamily="SemiBold" fontSize={16}>
          Order tracking
        </CustomText>
        <CustomerLogoutButton iconColor={FOOD_THEME.text} style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <CustomText fontSize={40}>{order.restaurant?.imageEmoji || copy.storeEmoji}</CustomText>
          <CustomText fontFamily="SemiBold" fontSize={18} style={{ marginTop: 12 }}>
            {hero?.title}
          </CustomText>
          <CustomText fontSize={14} color={FOOD_THEME.textMuted} style={{ marginTop: 6, textAlign: "center" }}>
            {hero?.subtitle}
          </CustomText>
          <CustomText fontSize={12} color={FOOD_THEME.textLight} style={{ marginTop: 10 }}>
            {order.restaurantName}
          </CustomText>
          {order.restaurantRating ? (
            <View style={styles.ratedPill}>
              <Ionicons name="star" size={14} color={FOOD_THEME.orange} />
              <CustomText fontSize={12} color={FOOD_THEME.orangeDark} style={{ marginLeft: 6 }}>
                You rated this {order.restaurantRating}/5
              </CustomText>
            </View>
          ) : null}
          {order.status === "PLACED" ? (
            <View style={styles.waitingPill}>
              <ActivityIndicator size="small" color={FOOD_THEME.orange} />
              <CustomText fontSize={12} color={FOOD_THEME.orangeDark} style={{ marginLeft: 8 }}>
                {copy.customerWaitingAccept}
              </CustomText>
            </View>
          ) : null}

          {showDeliveryCode ? (
            <View style={styles.heroCodeWrap}>
              <DeliveryCodeCard
                code={deliveryCode!}
                compact
                hint={
                  codeIsActive
                    ? "Share this code with your courier when they arrive — only then should they hand over your order."
                    : "Your code is ready. Share it with the courier when they reach you."
                }
              />
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <CustomText fontFamily="SemiBold" fontSize={15} style={{ marginBottom: 12 }}>
            Order progress
          </CustomText>
          <OrderStatusTimeline steps={steps} />
        </View>

        <View style={styles.card}>
          <CustomText fontFamily="SemiBold" fontSize={15} style={{ marginBottom: 10 }}>
            Your order
          </CustomText>
          {order.items.map((line, idx) => (
            <View key={`${line.name}-${idx}`} style={styles.lineRow}>
              <CustomText fontSize={13}>
                {line.quantity}× {line.name}
              </CustomText>
              <CustomText fontSize={13}>{formatCurrency(line.price * line.quantity)}</CustomText>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.lineRow}>
            <CustomText fontSize={13} color={FOOD_THEME.textMuted}>
              Subtotal
            </CustomText>
            <CustomText fontSize={13}>{formatCurrency(order.subtotal)}</CustomText>
          </View>
          <View style={styles.lineRow}>
            <CustomText fontSize={13} color={FOOD_THEME.textMuted}>
              Service fee
            </CustomText>
            <CustomText fontSize={13}>{formatCurrency(order.serviceFee ?? 0)}</CustomText>
          </View>
          <View style={styles.lineRow}>
            <CustomText fontSize={13} color={FOOD_THEME.textMuted}>
              Delivery fee
            </CustomText>
            <CustomText fontSize={13}>{formatCurrency(order.deliveryFee)}</CustomText>
          </View>
          <View style={[styles.lineRow, styles.totalRow]}>
            <CustomText fontSize={13} color={FOOD_THEME.textMuted}>
              Total
            </CustomText>
            <CustomText fontFamily="SemiBold" fontSize={15}>
              {formatCurrency(order.total)}
            </CustomText>
          </View>
          <CustomText fontSize={12} color={FOOD_THEME.textLight} style={{ marginTop: 8 }}>
            Deliver to: {order.delivery.address}
          </CustomText>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {showLiveMap ? (
          <CustomButton
            title="Track courier on map"
            onPress={() =>
              router.push({
                pathname: "/customer/liveride",
                params: { id: order.ride!._id },
              })
            }
          />
        ) : null}
        {canRateRestaurant ? (
          <CustomButton
            title={`Rate ${order.restaurantName}`}
            onPress={() => setShowRating(true)}
          />
        ) : null}
        {isTerminal ? (
          <CustomButton
            title={copy.customerOrderMore}
            onPress={() => router.replace(shopHome as any)}
          />
        ) : !canRateRestaurant ? (
          <CustomText fontSize={12} color={FOOD_THEME.textMuted} style={{ textAlign: "center" }}>
            We'll notify you as your order progresses
          </CustomText>
        ) : null}
      </View>

      <RestaurantRatingModal
        visible={showRating}
        orderId={order._id}
        restaurantName={order.restaurantName}
        onClose={() => setShowRating(false)}
        onSuccess={() => {
          setShowRating(false);
          load();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: FOOD_THEME.surface },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: FOOD_THEME.divider,
    backgroundColor: FOOD_THEME.card,
  },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 24 },
  heroCard: {
    backgroundColor: FOOD_THEME.orangeLight,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.2)",
  },
  ratedPill: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 20,
  },
  waitingPill: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 20,
  },
  heroCodeWrap: {
    width: "100%",
    marginTop: 16,
  },
  card: {
    backgroundColor: FOOD_THEME.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: FOOD_THEME.divider,
  },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  totalRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: FOOD_THEME.divider,
  },
  divider: {
    height: 1,
    backgroundColor: FOOD_THEME.divider,
    marginVertical: 10,
  },
  footer: {
    padding: 16,
    backgroundColor: FOOD_THEME.card,
    borderTopWidth: 1,
    borderTopColor: FOOD_THEME.divider,
    gap: 10,
  },
});

export default FoodOrderTracking;
