import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useIsFocused } from "@react-navigation/native";
import CustomText from "@/components/shared/CustomText";
import CustomButton from "@/components/shared/CustomButton";
import { formatCurrency } from "@/utils/Constants";
import { fetchFoodOrder, FoodOrder } from "@/service/foodService";
import { fetchCourierLocation, getRideById } from "@/service/rideService";
import { useWS } from "@/service/WSProvider";
import OrderStatusTimeline from "@/components/customer/food/OrderStatusTimeline";
import FoodOrderTrackingMap from "@/components/customer/food/FoodOrderTrackingMap";
import {
  buildFoodTrackingSteps,
  getHeroStatusLabel,
  getFoodDeliveryCode,
  shouldShowFoodDeliveryCode,
  resolveFoodOrderMapPoints,
  shouldShowFoodOrderMap,
  getFoodOrderEtaWindow,
  isLiveFoodCourierTracking,
  getOrderDeliveryDistanceKm,
  resolveCourierVehicle,
  getCourierDisplayName,
  getCourierRating,
} from "@/utils/foodOrderTracking";
import DeliveryCodeCard from "@/components/customer/food/DeliveryCodeCard";
import FoodOrderCourierCard from "@/components/customer/food/FoodOrderCourierCard";
import RestaurantRatingModal from "@/components/customer/food/RestaurantRatingModal";
import { isFoodOrderRateable, withDeliveredFoodOrderStatus } from "@/utils/ratingFlow";
import {
  commerceHomePath,
  getCommerceOrderCopy,
  resolveOrderVertical,
} from "@/utils/commerceOrderCopy";
import { STORE_VERTICAL_CONFIG } from "@/utils/storeVertical";
import { FOOD_THEME } from "@/styles/foodStyles";
import { buildFoodOrderSnapPoints } from "@/utils/bottomSheetSnapPoints";
import {
  coordsFromRideRider,
  courierCoordsChanged,
  normalizeRiderId,
  parseCourierLocationPayload,
  type RiderLiveCoords,
} from "@/utils/riderLiveLocation";

const POLL_MS = 4000;
const COURIER_POLL_MS = 2500;
const LIVE_RIDE_STATUSES = new Set(["START", "ARRIVED", "IN_PROGRESS"]);

function mergeOrderRide(order: FoodOrder, ride: NonNullable<FoodOrder["ride"]>): FoodOrder {
  return {
    ...order,
    ride: {
      ...(order.ride ?? {}),
      ...ride,
      _id: ride._id || order.ride?._id || "",
    },
  };
}

const FoodOrderTracking = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isFocused = useIsFocused();
  const { emit, on, off, connectNonce } = useWS();
  const [order, setOrder] = useState<FoodOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const ratingOpenedRef = useRef(false);
  const [riderCoords, setRiderCoords] = useState<RiderLiveCoords | null>(null);
  const [courierRevision, setCourierRevision] = useState(0);
  const riderCoordsRef = useRef<RiderLiveCoords | null>(null);
  const riderIdRef = useRef<string | null>(null);

  const snapPoints = useMemo(
    () => buildFoodOrderSnapPoints(windowHeight),
    [windowHeight]
  );
  const sheetReady = windowHeight >= 100 && snapPoints.length >= 2;
  const [sheetIndex, setSheetIndex] = useState(1);
  const mapHeight = useMemo(() => {
    const h = windowHeight >= 100 ? windowHeight : 700;
    const sheetH = snapPoints[sheetIndex] ?? snapPoints[1] ?? Math.round(h * 0.52);
    return Math.max(120, Math.round(h - sheetH));
  }, [windowHeight, sheetIndex, snapPoints]);

  const handleSheetChanges = useCallback((index: number) => {
    if (index < 0) return;
    setSheetIndex(index);
  }, []);

  const tryOpenRestaurantRating = useCallback((nextOrder: FoodOrder | null) => {
    if (!nextOrder || !isFoodOrderRateable(nextOrder)) return;
    if (ratingOpenedRef.current) return;
    ratingOpenedRef.current = true;
    setTimeout(() => setShowRating(true), 400);
  }, []);

  useEffect(() => {
    ratingOpenedRef.current = false;
    setShowRating(false);
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchFoodOrder(id);
      if (!data) {
        setOrder(null);
        return;
      }
      if (data.ride?._id) {
        const liveRide = await getRideById(data.ride._id);
        if (liveRide) {
          setOrder(withDeliveredFoodOrderStatus(mergeOrderRide(data, liveRide)));
          return;
        }
      }
      if (data.status === "DELIVERED" && data.ride) {
        setOrder(
          withDeliveredFoodOrderStatus(
            mergeOrderRide(data, {
              ...data.ride,
              status: data.ride.status ?? "COMPLETED",
            })
          )
        );
        return;
      }
      setOrder(withDeliveredFoodOrderStatus(data));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id || !isFocused) return;
    emit("subscribeFoodOrder", id);
    const handler = (updated: FoodOrder) => {
      if (String(updated?._id) !== String(id)) return;
      setOrder((prev) => {
        const mergedRide =
          prev?.ride || updated.ride
            ? {
                ...(prev?.ride ?? {}),
                ...(updated.ride ?? {}),
                status:
                  updated.ride?.status ??
                  (updated.status === "DELIVERED" ? "COMPLETED" : prev?.ride?.status),
              }
            : updated.ride ?? prev?.ride;
        const next = withDeliveredFoodOrderStatus({
          ...(prev ?? updated),
          ...updated,
          restaurant: { ...prev?.restaurant, ...updated.restaurant },
          ride: mergedRide,
        });
        return next;
      });
    };
    on("foodOrderUpdated", handler);
    return () => off("foodOrderUpdated", handler);
  }, [id, connectNonce, isFocused, emit, on, off]);

  useEffect(() => {
    tryOpenRestaurantRating(order);
  }, [order?.status, order?.ride?.status, order?.restaurantRating, order, tryOpenRestaurantRating]);

  useEffect(() => {
    if (!order || order.status === "DELIVERED" || order.status === "CANCELLED") return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [order?.status, load]);

  const applyCourierLocation = useCallback((payload: unknown) => {
    const next = parseCourierLocationPayload(payload);
    if (!next) return;
    const expectedRiderId = riderIdRef.current ?? normalizeRiderId(order?.ride?.rider);
    const incomingRiderId =
      payload && typeof payload === "object" && "riderId" in payload
        ? String((payload as { riderId?: unknown }).riderId ?? "")
        : "";
    if (incomingRiderId && expectedRiderId && incomingRiderId !== expectedRiderId) return;
    if (!courierCoordsChanged(riderCoordsRef.current, next)) return;
    riderCoordsRef.current = next;
    setRiderCoords(next);
    setCourierRevision((n) => n + 1);
  }, [order?.ride?.rider]);

  const rideId = order?.ride?._id;

  useEffect(() => {
    if (!rideId) return;

    emit("subscribeRide", rideId);

    getRideById(rideId)
      .then((ride) => {
        if (!ride) return;
        setOrder((prev) =>
          prev ? withDeliveredFoodOrderStatus(mergeOrderRide(prev, ride)) : prev
        );
        const rid = normalizeRiderId(ride?.rider);
        if (rid) riderIdRef.current = rid;
        const seeded = coordsFromRideRider(ride);
        if (seeded) applyCourierLocation({ coords: seeded });
      })
      .catch(() => {});

    const onRideData = (data: FoodOrder["ride"] & { _id?: string; rider?: unknown }) => {
      if (String(data?._id) !== String(rideId)) return;
      setOrder((prev) =>
        prev
          ? withDeliveredFoodOrderStatus(
              mergeOrderRide(prev, data as NonNullable<FoodOrder["ride"]>)
            )
          : prev
      );
      const rid = normalizeRiderId(data?.rider);
      if (rid) riderIdRef.current = rid;
      const seeded = coordsFromRideRider(data);
      if (seeded) applyCourierLocation({ coords: seeded });
    };

    const onRideUpdate = onRideData;
    const onRiderLocation = (data: unknown) => applyCourierLocation(data);

    on("rideData", onRideData);
    on("rideUpdate", onRideUpdate);
    on("riderLocationUpdate", onRiderLocation);

    return () => {
      off("rideData", onRideData);
      off("rideUpdate", onRideUpdate);
      off("riderLocationUpdate", onRiderLocation);
    };
  }, [rideId, emit, on, off, applyCourierLocation]);

  const riderId = normalizeRiderId(order?.ride?.rider);

  useEffect(() => {
    if (!rideId || !isFocused) return;
    emit("subscribeRide", rideId);
    if (riderId) emit("subscribeToriderLocation", riderId);
  }, [rideId, riderId, connectNonce, isFocused, emit]);

  useEffect(() => {
    if (
      !rideId ||
      !riderId ||
      !LIVE_RIDE_STATUSES.has(order?.ride?.status || "") ||
      !isFocused
    ) {
      return;
    }

    const pollCourier = async () => {
      const coords = await fetchCourierLocation(rideId);
      if (coords) applyCourierLocation({ coords, riderId });
    };

    void pollCourier();
    const interval = setInterval(pollCourier, COURIER_POLL_MS);
    return () => clearInterval(interval);
  }, [rideId, riderId, order?.ride?.status, isFocused, applyCourierLocation]);

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

  const etaWindow = useMemo(() => (order ? getFoodOrderEtaWindow(order) : null), [order]);

  const mapPoints = useMemo(
    () => (order ? resolveFoodOrderMapPoints(order) : { pickup: null, drop: null }),
    [order]
  );

  const showMap = order ? shouldShowFoodOrderMap(order) : false;
  const liveCourier = order
    ? isLiveFoodCourierTracking(order.status, order.ride)
    : false;

  const rider = useMemo(
    () =>
      riderCoords
        ? {
            latitude: riderCoords.latitude,
            longitude: riderCoords.longitude,
            heading: riderCoords.heading,
          }
        : null,
    [riderCoords?.latitude, riderCoords?.longitude, riderCoords?.heading]
  );

  const isTerminal = order?.status === "DELIVERED" || order?.status === "CANCELLED";
  const canRateRestaurant = isFoodOrderRateable(order);

  const deliveryCode = order ? getFoodDeliveryCode(order) : null;
  const showDeliveryCode =
    order && deliveryCode && shouldShowFoodDeliveryCode(order.status, order.ride);
  const codeIsActive = order?.ride?.status === "IN_PROGRESS";

  const paymentLabel =
    order?.paymentMethod === "MOBILE_MONEY" ? "Mobile money" : "Cash on delivery";

  const deliveryDistanceKm = order ? getOrderDeliveryDistanceKm(order) : null;
  const deliveryFeeLabel = order
    ? deliveryDistanceKm != null
      ? `${formatCurrency(order.deliveryFee)} · ${deliveryDistanceKm.toFixed(1)} km`
      : formatCurrency(order.deliveryFee)
    : "";

  const courierVehicle = order ? resolveCourierVehicle(order) : "motorcycle";
  const courierName = order ? getCourierDisplayName(order) : null;
  const courierRating = order ? getCourierRating(order) : null;
  const showCourierCard =
    !!courierName &&
    !!order?.ride?._id &&
    order.status !== "DELIVERED" &&
    order.status !== "CANCELLED";

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={verticalTheme.accent} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <CustomText>Order not found</CustomText>
        <TouchableOpacity onPress={() => router.replace(shopHome as any)} style={{ marginTop: 16 }}>
          <CustomText color={verticalTheme.accent}>{copy.customerBackToShop}</CustomText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {showMap && mapPoints.pickup && mapPoints.drop && mapHeight > 120 ? (
        <View style={[styles.mapWrap, { height: mapHeight }]}>
          {liveCourier ? (
            <FoodOrderTrackingMap
              mode="live"
              height={mapHeight}
              pickup={mapPoints.pickup}
              drop={mapPoints.drop}
              rideStatus={order.ride?.status ?? "SEARCHING_FOR_RIDER"}
              rider={rider}
              storeVertical={vertical}
              courierRevision={courierRevision}
              vehicle={courierVehicle}
            />
          ) : (
            <FoodOrderTrackingMap
              mode="static"
              height={mapHeight}
              pickup={mapPoints.pickup}
              drop={mapPoints.drop}
            />
          )}

          <TouchableOpacity
            onPress={() => router.replace(shopHome as any)}
            style={[styles.closeBtn, { top: insets.top + 8 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="close" size={22} color={FOOD_THEME.text} />
          </TouchableOpacity>

          <View style={styles.statusCard}>
            <View style={styles.statusCardTop}>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, liveCourier && styles.statusDotLive]} />
                <CustomText fontSize={11} fontFamily="SemiBold" color={FOOD_THEME.accentTeal}>
                  {liveCourier ? "LIVE" : order.status === "PLACED" ? "WAITING" : "TRACKING"}
                </CustomText>
              </View>
              {etaWindow ? (
                <View style={styles.etaPill}>
                  <Ionicons name="time-outline" size={14} color={FOOD_THEME.accentTeal} />
                  <CustomText fontFamily="SemiBold" fontSize={12} style={styles.etaText}>
                    {etaWindow}
                  </CustomText>
                </View>
              ) : null}
            </View>
            <CustomText fontFamily="Bold" fontSize={20} style={{ marginTop: 10 }}>
              {hero?.title}
            </CustomText>
            <CustomText fontSize={14} color={FOOD_THEME.textMuted} style={{ marginTop: 6, lineHeight: 20 }}>
              {hero?.subtitle}
            </CustomText>
            <View style={styles.storeRow}>
              <CustomText fontSize={20}>{order.restaurant?.imageEmoji || copy.storeEmoji}</CustomText>
              <CustomText fontSize={13} color={FOOD_THEME.text} fontFamily="Medium" style={{ marginLeft: 8, flex: 1 }}>
                {order.restaurantName}
              </CustomText>
            </View>
            {order.status === "PLACED" ? (
              <View style={styles.waitingRow}>
                <ActivityIndicator size="small" color={FOOD_THEME.orange} />
                <CustomText fontSize={12} color={FOOD_THEME.orangeDark} style={{ marginLeft: 8 }}>
                  {copy.customerWaitingAccept}
                </CustomText>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={[styles.fallbackHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.replace(shopHome as any)} style={styles.closeBtnPlain}>
            <MaterialIcons name="close" size={22} color={FOOD_THEME.text} />
          </TouchableOpacity>
          <View style={styles.fallbackHero}>
            <CustomText fontSize={36}>{order.restaurant?.imageEmoji || copy.storeEmoji}</CustomText>
            <CustomText fontFamily="SemiBold" fontSize={18} style={{ marginTop: 10 }}>
              {hero?.title}
            </CustomText>
            <CustomText fontSize={13} color={FOOD_THEME.textMuted} style={{ marginTop: 6, textAlign: "center" }}>
              {hero?.subtitle}
            </CustomText>
          </View>
        </View>
      )}

      {sheetReady ? (
        <BottomSheet
          index={1}
          animateOnMount
          enableOverDrag={false}
          enableDynamicSizing={false}
          handleIndicatorStyle={styles.sheetHandle}
          snapPoints={snapPoints}
          onChange={handleSheetChanges}
          style={styles.sheet}
        >
          <BottomSheetScrollView
            contentContainerStyle={[
              styles.sheetContent,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.paymentBanner}>
              <Ionicons name="wallet-outline" size={18} color={FOOD_THEME.text} />
              <CustomText fontSize={13} style={{ marginLeft: 8, flex: 1 }}>
                Paying with <CustomText fontFamily="SemiBold">{paymentLabel}</CustomText>
              </CustomText>
            </View>

            {showCourierCard ? (
              <FoodOrderCourierCard
                name={courierName!}
                vehicle={courierVehicle}
                rating={courierRating}
                statusLabel={hero?.subtitle}
              />
            ) : null}

            {showDeliveryCode ? (
              <DeliveryCodeCard
                code={deliveryCode!}
                compact
                hint={
                  codeIsActive
                    ? "Share this code with your courier when they arrive."
                    : "Your code is ready — share it when the courier reaches you."
                }
              />
            ) : null}

            {order.restaurantRating ? (
              <View style={styles.ratedPill}>
                <Ionicons name="star" size={14} color={FOOD_THEME.orange} />
                <CustomText fontSize={12} color={FOOD_THEME.orangeDark} style={{ marginLeft: 6 }}>
                  You rated this {order.restaurantRating}/5
                </CustomText>
              </View>
            ) : null}

            <View style={styles.orderSummary}>
              <View style={styles.orderSummaryTop}>
                <CustomText fontFamily="SemiBold" fontSize={15}>
                  Your order
                </CustomText>
                <CustomText fontFamily="Bold" fontSize={16} color={FOOD_THEME.text}>
                  {formatCurrency(order.total)}
                </CustomText>
              </View>
              <CustomText fontSize={12} color={FOOD_THEME.textMuted} numberOfLines={2} style={{ lineHeight: 18 }}>
                {order.items.map((l) => `${l.quantity}× ${l.name}`).join(" · ")}
              </CustomText>
            </View>

            <View style={styles.card}>
              <CustomText fontFamily="SemiBold" fontSize={15} style={{ marginBottom: 12 }}>
                Order progress
              </CustomText>
              <OrderStatusTimeline steps={steps} />
            </View>

            <View style={styles.card}>
              <CustomText fontFamily="SemiBold" fontSize={15} style={{ marginBottom: 12 }}>
                Receipt
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
              {order.fulfillmentType !== "PICKUP" ? (
                <View style={styles.lineRow}>
                  <CustomText fontSize={13} color={FOOD_THEME.textMuted}>
                    Delivery fee
                  </CustomText>
                  <CustomText fontSize={13}>{deliveryFeeLabel}</CustomText>
                </View>
              ) : null}
              <View style={[styles.lineRow, styles.totalRow]}>
                <CustomText fontSize={13} color={FOOD_THEME.textMuted}>
                  Total
                </CustomText>
                <CustomText fontFamily="SemiBold" fontSize={15}>
                  {formatCurrency(order.total)}
                </CustomText>
              </View>
              <CustomText fontSize={12} color={FOOD_THEME.textLight} style={{ marginTop: 10 }}>
                Deliver to: {order.delivery.address}
              </CustomText>
            </View>

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
              <CustomText fontSize={12} color={FOOD_THEME.textMuted} style={styles.notifyHint}>
                We'll notify you as your order progresses
              </CustomText>
            ) : null}
          </BottomSheetScrollView>
        </BottomSheet>
      ) : null}

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
  mapWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: "100%",
    backgroundColor: "#e8ebeb",
    zIndex: 1,
  },
  closeBtn: {
    position: "absolute",
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 5,
  },
  closeBtnPlain: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: FOOD_THEME.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FOOD_THEME.divider,
  },
  statusCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 12,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  statusCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: FOOD_THEME.accentTeal,
  },
  statusDotLive: {
    backgroundColor: "#22c55e",
  },
  etaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: FOOD_THEME.searchBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: FOOD_THEME.divider,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  etaText: {
    marginLeft: 6,
    color: FOOD_THEME.accentTeal,
  },
  waitingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: FOOD_THEME.divider,
  },
  fallbackHeader: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: FOOD_THEME.orangeLight,
    borderBottomWidth: 1,
    borderBottomColor: FOOD_THEME.divider,
  },
  fallbackHero: {
    alignItems: "center",
    paddingVertical: 20,
  },
  sheet: {
    zIndex: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  sheetHandle: {
    backgroundColor: "#d1d5db",
    width: 40,
  },
  sheetContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 14,
  },
  paymentBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: FOOD_THEME.searchBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  orderSummary: {
    backgroundColor: FOOD_THEME.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: FOOD_THEME.divider,
  },
  orderSummaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  card: {
    backgroundColor: FOOD_THEME.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: FOOD_THEME.divider,
  },
  ratedPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: FOOD_THEME.orangeLight,
    borderRadius: 20,
    alignSelf: "flex-start",
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
  notifyHint: {
    textAlign: "center",
    paddingVertical: 8,
  },
});

export default FoodOrderTracking;
