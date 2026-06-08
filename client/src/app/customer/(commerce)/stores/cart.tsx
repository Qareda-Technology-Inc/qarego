import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import CustomerLogoutButton from "@/components/customer/CustomerLogoutButton";
import { Colors, formatCurrency } from "@/utils/Constants";
import { useFoodCartStore } from "@/store/foodCartStore";
import { useUserStore } from "@/store/userStore";
import {
  ensureUserDeliveryLocation,
  hasValidDeliveryCoords,
} from "@/utils/ensureDeliveryLocation";
import SurfaceCard from "@/components/shared/SurfaceCard";
import EmptyStateCard from "@/components/shared/EmptyStateCard";
import FoodCartMiniMap from "@/components/customer/FoodCartMiniMap";
import SlideToPlaceOrder from "@/components/customer/SlideToPlaceOrder";
import { DS } from "@/theme/designSystem";
import {
  createFoodOrder,
  fetchFoodCheckoutSettings,
  fetchFoodDeliveryQuote,
  fetchRestaurantMenu,
} from "@/service/foodService";
import { calculateDistance, calculateFoodDeliveryFee } from "@/utils/mapUtils";
import { calculateServiceFee } from "@/utils/feeUtils";
import { STORE_VERTICAL_CONFIG, normalizeStoreVertical } from "@/utils/storeVertical";
import { formatCartModifierSummary, toOrderModifierPayload } from "@/utils/menuModifiers";

type FulfillmentMode = "DELIVERY" | "PICKUP" | "SCHEDULED";

const SCHEDULE_OPTIONS = [
  { label: "In 30 min", minutes: 30 },
  { label: "In 1 hour", minutes: 60 },
  { label: "In 2 hours", minutes: 120 },
];

const FoodCart = () => {
  const insets = useSafeAreaInsets();
  const { vertical: verticalParam } = useLocalSearchParams<{ vertical?: string }>();
  const selectedVertical = useMemo(() => normalizeStoreVertical(verticalParam), [verticalParam]);
  const verticalConfig = STORE_VERTICAL_CONFIG[selectedVertical];
  const accent = verticalConfig.accent;

  const restaurantId = useFoodCartStore((s) => s.restaurantId);
  const restaurantName = useFoodCartStore((s) => s.restaurantName);
  const minOrderAmount = useFoodCartStore((s) => s.minOrderAmount);
  const items = useFoodCartStore((s) => s.items);
  const subtotal = useFoodCartStore((s) => s.subtotal());
  const updateQuantity = useFoodCartStore((s) => s.updateQuantity);
  const removeItem = useFoodCartStore((s) => s.removeItem);
  const clearCart = useFoodCartStore((s) => s.clearCart);

  const { location, setLocation } = useUserStore();
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>("DELIVERY");
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [allowsPickup, setAllowsPickup] = useState(false);
  const [restaurantCoords, setRestaurantCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [storeAddress, setStoreAddress] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [showPromo, setShowPromo] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "MOBILE_MONEY">("CASH");
  const [loading, setLoading] = useState(false);
  const [resolvingLocation, setResolvingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<{ km: number; fee: number } | null>(null);
  const [quotingDelivery, setQuotingDelivery] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [serviceFeeConfig, setServiceFeeConfig] = useState<{
    serviceFeeRate: number;
    serviceFeeMin: number;
    serviceFeeMax: number;
    fareRates: Record<string, { baseFare: number; perKmRate: number; minimumFare: number }> | null;
  }>({
    serviceFeeRate: 0.08,
    serviceFeeMin: 2,
    serviceFeeMax: 12,
    fareRates: null,
  });

  const meetsMin = subtotal >= minOrderAmount;
  const needsDeliveryAddress = fulfillmentMode === "DELIVERY" || fulfillmentMode === "SCHEDULED";

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    fetchRestaurantMenu(restaurantId)
      .then((data) => {
        if (cancelled) return;
        const r = data.restaurant;
        setAllowsPickup(!!r.allowsPickup);
        setStoreAddress(r.address ?? null);
        if (
          typeof r.latitude === "number" &&
          typeof r.longitude === "number" &&
          !Number.isNaN(r.latitude) &&
          !Number.isNaN(r.longitude)
        ) {
          setRestaurantCoords({ lat: r.latitude, lng: r.longitude });
        } else {
          setRestaurantCoords(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAllowsPickup(false);
          setRestaurantCoords(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  useEffect(() => {
    let cancelled = false;
    fetchFoodCheckoutSettings()
      .then((cfg) => {
        if (!cancelled) {
          setServiceFeeConfig({
            serviceFeeRate: cfg.serviceFeeRate,
            serviceFeeMin: cfg.serviceFeeMin,
            serviceFeeMax: cfg.serviceFeeMax,
            fareRates: cfg.fareRates ?? null,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fulfillmentMode === "PICKUP" && !allowsPickup) {
      setFulfillmentMode("DELIVERY");
    }
  }, [allowsPickup, fulfillmentMode]);

  const refreshDeliveryLocation = useCallback(async () => {
    if (!needsDeliveryAddress) {
      setResolvingLocation(false);
      setLocationError(null);
      return;
    }
    setResolvingLocation(true);
    setLocationError(null);
    const result = await ensureUserDeliveryLocation(location, setLocation);
    if (!result.ok) setLocationError(result.message);
    setResolvingLocation(false);
  }, [location, setLocation, needsDeliveryAddress]);

  useFocusEffect(
    useCallback(() => {
      refreshDeliveryLocation();
    }, [refreshDeliveryLocation])
  );

  useEffect(() => {
    if (
      !needsDeliveryAddress ||
      !restaurantId ||
      !restaurantCoords ||
      !hasValidDeliveryCoords(location)
    ) {
      setDeliveryQuote(null);
      setQuoteError(null);
      setQuotingDelivery(false);
      return;
    }

    let cancelled = false;
    setQuotingDelivery(true);
    setQuoteError(null);

    const timer = setTimeout(() => {
      fetchFoodDeliveryQuote(restaurantId, location!.latitude, location!.longitude)
        .then((quote) => {
          if (cancelled) return;
          setDeliveryQuote({ km: quote.distanceKm, fee: quote.deliveryFee });
          setQuoteError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const axiosErr = err as { response?: { status?: number; data?: { msg?: string } } };
          const serverMsg = axiosErr.response?.data?.msg;

          if (axiosErr.response?.status === 400) {
            setDeliveryQuote(null);
            setQuoteError(serverMsg || "Delivery not available for this address");
            return;
          }

          const km = calculateDistance(
            restaurantCoords.lat,
            restaurantCoords.lng,
            location!.latitude,
            location!.longitude
          );
          const fee = calculateFoodDeliveryFee(km, serviceFeeConfig.fareRates);
          setDeliveryQuote({ km, fee });
          setQuoteError(null);
        })
        .finally(() => {
          if (!cancelled) setQuotingDelivery(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    needsDeliveryAddress,
    restaurantId,
    restaurantCoords,
    location,
    serviceFeeConfig.fareRates,
  ]);

  const deliveryFeeLabel = useMemo(() => {
    if (!needsDeliveryAddress) return null;
    if (resolvingLocation || quotingDelivery) return "Calculating…";
    if (locationError || !hasValidDeliveryCoords(location)) return "Set location";
    if (quoteError) return quoteError;
    if (deliveryQuote) {
      return `${deliveryQuote.km.toFixed(1)} km · ${formatCurrency(deliveryQuote.fee)}`;
    }
    return "Calculating…";
  }, [
    needsDeliveryAddress,
    resolvingLocation,
    quotingDelivery,
    locationError,
    location,
    deliveryQuote,
    quoteError,
  ]);

  const serviceFee = useMemo(
    () =>
      calculateServiceFee(
        subtotal,
        serviceFeeConfig.serviceFeeRate,
        serviceFeeConfig.serviceFeeMin,
        serviceFeeConfig.serviceFeeMax
      ),
    [subtotal, serviceFeeConfig]
  );

  const deliveryFee = deliveryQuote?.fee ?? 0;
  const estimatedTotal =
    subtotal + serviceFee + (needsDeliveryAddress && deliveryQuote ? deliveryQuote.fee : 0);
  const totalLabel =
    needsDeliveryAddress && !deliveryQuote
      ? `${formatCurrency(subtotal + serviceFee)}+`
      : formatCurrency(estimatedTotal);

  const readyToOrder =
    meetsMin &&
    !loading &&
    (fulfillmentMode === "PICKUP"
      ? !!restaurantCoords
      : needsDeliveryAddress &&
        hasValidDeliveryCoords(location) &&
        !resolvingLocation &&
        !locationError &&
        !quoteError &&
        deliveryQuote != null) &&
    (fulfillmentMode !== "SCHEDULED" || scheduledFor != null);

  const placeOrder = async () => {
    if (!restaurantId || items.length === 0 || !readyToOrder) return;
    setLoading(true);
    try {
      const deliveryPayload =
        fulfillmentMode === "PICKUP"
          ? {
              address: storeAddress || restaurantName || "Store pickup",
              latitude: restaurantCoords!.lat,
              longitude: restaurantCoords!.lng,
            }
          : {
              address: location!.address || "Your delivery location",
              latitude: location!.latitude,
              longitude: location!.longitude,
            };

      await createFoodOrder({
        restaurantId,
        items: items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          modifiers: toOrderModifierPayload(i.modifiers),
        })),
        delivery: deliveryPayload,
        paymentMethod,
        notes: notes.trim() || undefined,
        fulfillmentType: fulfillmentMode,
        scheduledFor: scheduledFor?.toISOString(),
        promoCode: promoCode.trim() || undefined,
      });
      clearCart();
    } finally {
      setLoading(false);
    }
  };

  const pickSchedule = (minutes: number) => {
    const at = new Date(Date.now() + minutes * 60 * 1000);
    setScheduledFor(at);
    setFulfillmentMode("SCHEDULED");
    setScheduleModal(false);
  };

  const scheduleLabel = scheduledFor
    ? scheduledFor.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  if (items.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back-ios" size={22} color={Colors.text} />
          </TouchableOpacity>
          <CustomText fontFamily="SemiBold" fontSize={18}>
            Cart
          </CustomText>
          <CustomerLogoutButton style={styles.backBtn} />
        </View>
        <View style={styles.empty}>
          <EmptyStateCard
            icon="🛒"
            title="Your cart is empty"
            description={`Browse ${verticalConfig.title.toLowerCase()} stores and add items to start your order.`}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: accent }]}
            onPress={() =>
              router.replace({
                pathname: "/customer/stores",
                params: { vertical: selectedVertical },
              })
            }
          >
            <CustomText fontFamily="SemiBold" fontSize={14} style={{ color: "#fff" }}>
              Browse {verticalConfig.title.toLowerCase()}
            </CustomText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back-ios" size={22} color={Colors.text} />
        </TouchableOpacity>
        <CustomText fontFamily="SemiBold" fontSize={17} numberOfLines={1} style={styles.headerTitle}>
          {restaurantName}
        </CustomText>
        <CustomerLogoutButton style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {items.map((line) => {
          const modifierText = formatCartModifierSummary(line.modifiers);
          return (
            <View key={line.cartLineId} style={styles.line}>
              <View style={{ flex: 1 }}>
                <CustomText fontFamily="Medium" fontSize={15}>
                  {line.name}
                </CustomText>
                {modifierText ? (
                  <CustomText fontSize={12} color="#6b7280" style={{ marginTop: 2 }}>
                    {modifierText}
                  </CustomText>
                ) : null}
                <CustomText fontSize={13} color="#888" style={{ marginTop: 2 }}>
                  {formatCurrency(line.price)} each
                </CustomText>
              </View>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(line.cartLineId, line.quantity - 1)}
                >
                  <Ionicons name="remove" size={18} color={Colors.text} />
                </TouchableOpacity>
                <CustomText fontFamily="SemiBold" fontSize={15} style={styles.qtyText}>
                  {line.quantity}
                </CustomText>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(line.cartLineId, line.quantity + 1)}
                >
                  <Ionicons name="add" size={18} color={Colors.text} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => removeItem(line.cartLineId)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.linkRow, { borderColor: accent }]}
          onPress={() =>
            router.push({
              pathname: `/customer/stores/${restaurantId}`,
              params: { vertical: selectedVertical },
            })
          }
        >
          <Ionicons name="add-circle-outline" size={20} color={accent} />
          <CustomText fontFamily="Medium" fontSize={14} style={{ color: accent, marginLeft: 8 }}>
            Add more
          </CustomText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRowPlain} onPress={() => setShowComment((v) => !v)}>
          <Ionicons name="chatbubble-outline" size={18} color="#666" />
          <CustomText fontSize={14} style={{ marginLeft: 8, flex: 1 }}>
            {notes.trim() ? "Edit comment" : "Add comment"}
          </CustomText>
          <Ionicons name={showComment ? "chevron-up" : "chevron-down"} size={18} color="#999" />
        </TouchableOpacity>
        {showComment ? (
          <TextInput
            style={styles.commentInput}
            placeholder="Special instructions for the store"
            placeholderTextColor="#999"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        ) : null}

        {needsDeliveryAddress ? (
          <>
            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionHeading}>
              Deliver to
            </CustomText>
            {resolvingLocation ? (
              <View style={styles.locLoading}>
                <ActivityIndicator size="small" color={accent} />
                <CustomText fontSize={13} color="#666" style={{ marginLeft: 10 }}>
                  Getting your location…
                </CustomText>
              </View>
            ) : locationError ? (
              <View style={styles.locError}>
                <CustomText fontSize={13} color="#ef4444">
                  {locationError}
                </CustomText>
                <TouchableOpacity onPress={refreshDeliveryLocation}>
                  <CustomText fontSize={13} color={accent} fontFamily="Medium">
                    Try again
                  </CustomText>
                </TouchableOpacity>
              </View>
            ) : hasValidDeliveryCoords(location) ? (
              <>
                <CustomText fontSize={14} numberOfLines={2}>
                  {location?.address || "Your location"}
                </CustomText>
                <CustomText fontSize={12} color="#888" style={{ marginTop: 4, marginBottom: 8 }}>
                  Drag the map to adjust delivery pin — fee updates by distance to store
                </CustomText>
                <FoodCartMiniMap
                  latitude={location!.latitude}
                  longitude={location!.longitude}
                  storeLatitude={restaurantCoords?.lat}
                  storeLongitude={restaurantCoords?.lng}
                  accent={accent}
                  onLocationChange={(coords) => setLocation(coords)}
                />
                {deliveryQuote ? (
                  <CustomText fontSize={12} color={accent} style={{ marginTop: 8 }}>
                    {deliveryQuote.km.toFixed(1)} km from store · delivery{" "}
                    {formatCurrency(deliveryQuote.fee)}
                  </CustomText>
                ) : null}
                <TouchableOpacity
                  style={styles.changeAddr}
                  onPress={() =>
                    router.push({
                      pathname: "/customer/selectlocations",
                      params: { serviceType: "FOOD", foodCheckout: "1" },
                    })
                  }
                >
                  <CustomText fontSize={13} color={accent} fontFamily="Medium">
                    Change address
                  </CustomText>
                </TouchableOpacity>
              </>
            ) : null}
          </>
        ) : (
          <SurfaceCard style={styles.pickupCard}>
            <Ionicons name="storefront" size={20} color={accent} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <CustomText fontFamily="Medium" fontSize={14}>
                Pick up at store
              </CustomText>
              <CustomText fontSize={13} color="#666" numberOfLines={2}>
                {storeAddress || restaurantName}
              </CustomText>
            </View>
          </SurfaceCard>
        )}

        <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionHeading}>
          Delivery or Pickup?
        </CustomText>
        <View style={styles.fulfillmentRow}>
          <TouchableOpacity
            style={[
              styles.fulfillmentOpt,
              fulfillmentMode === "DELIVERY" && { borderColor: accent, backgroundColor: "#fff7ed" },
            ]}
            onPress={() => {
              setFulfillmentMode("DELIVERY");
              setScheduledFor(null);
            }}
          >
            <Ionicons
              name="bicycle-outline"
              size={20}
              color={fulfillmentMode === "DELIVERY" ? accent : "#666"}
            />
            <CustomText fontFamily="Medium" fontSize={13} style={{ marginTop: 4 }}>
              Delivery
            </CustomText>
            <CustomText fontSize={11} color="#888" numberOfLines={2}>
              {deliveryFeeLabel ?? "—"}
            </CustomText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.fulfillmentOpt,
              !allowsPickup && styles.fulfillmentOptDisabled,
              fulfillmentMode === "PICKUP" &&
                allowsPickup && { borderColor: accent, backgroundColor: "#fff7ed" },
            ]}
            disabled={!allowsPickup}
            onPress={() => {
              if (!allowsPickup) return;
              setFulfillmentMode("PICKUP");
              setScheduledFor(null);
            }}
          >
            <Ionicons
              name="storefront-outline"
              size={20}
              color={!allowsPickup ? "#bbb" : fulfillmentMode === "PICKUP" ? accent : "#666"}
            />
            <CustomText fontFamily="Medium" fontSize={13} style={{ marginTop: 4 }}>
              Pickup
            </CustomText>
            <CustomText fontSize={11} color="#888">
              {allowsPickup ? "Free" : "Unavailable"}
            </CustomText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.fulfillmentOpt,
              (fulfillmentMode === "SCHEDULED" || scheduleModal) && {
                borderColor: accent,
                backgroundColor: "#fff7ed",
              },
            ]}
            onPress={() => setScheduleModal(true)}
          >
            <Ionicons
              name="time-outline"
              size={20}
              color={fulfillmentMode === "SCHEDULED" ? accent : "#666"}
            />
            <CustomText fontFamily="Medium" fontSize={13} style={{ marginTop: 4 }}>
              Schedule
            </CustomText>
            <CustomText fontSize={11} color="#888" numberOfLines={1}>
              {scheduleLabel || "Later"}
            </CustomText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.linkRowPlain} onPress={() => setShowPromo((v) => !v)}>
          <Ionicons name="pricetag-outline" size={18} color="#666" />
          <CustomText fontSize={14} style={{ marginLeft: 8, flex: 1 }}>
            {promoCode.trim() ? `Promo: ${promoCode}` : "Add promo"}
          </CustomText>
          <Ionicons name={showPromo ? "chevron-up" : "chevron-down"} size={18} color="#999" />
        </TouchableOpacity>
        {showPromo ? (
          <View style={styles.promoRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="Promo code"
              placeholderTextColor="#999"
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.promoApply, { backgroundColor: accent }]}
              onPress={() =>
                Alert.alert(
                  "Promo",
                  promoCode.trim()
                    ? "Promo codes will be validated soon."
                    : "Enter a promo code first."
                )
              }
            >
              <CustomText fontSize={13} fontFamily="Medium" style={{ color: "#fff" }}>
                Apply
              </CustomText>
            </TouchableOpacity>
          </View>
        ) : null}

        <SurfaceCard style={styles.totalsCard}>
          <View style={styles.summaryRow}>
            <CustomText fontSize={14}>Subtotal</CustomText>
            <CustomText fontFamily="SemiBold" fontSize={14}>
              {formatCurrency(subtotal)}
            </CustomText>
          </View>
          <View style={styles.summaryRow}>
            <CustomText fontSize={14}>Service fee</CustomText>
            <CustomText fontSize={14}>{formatCurrency(serviceFee)}</CustomText>
          </View>
          {needsDeliveryAddress ? (
            <View style={styles.summaryRow}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <CustomText fontSize={14}>Delivery fee</CustomText>
                {deliveryQuote ? (
                  <CustomText fontSize={11} color="#888">
                    {deliveryQuote.km.toFixed(1)} km from store
                  </CustomText>
                ) : null}
              </View>
              <CustomText fontSize={14}>
                {deliveryQuote ? formatCurrency(deliveryQuote.fee) : "—"}
              </CustomText>
            </View>
          ) : null}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <CustomText fontFamily="SemiBold" fontSize={16}>
              Total
            </CustomText>
            <CustomText fontFamily="SemiBold" fontSize={16} style={{ color: accent }}>
              {totalLabel}
            </CustomText>
          </View>
          {!meetsMin ? (
            <CustomText fontSize={12} color="#ef4444">
              Add {formatCurrency(minOrderAmount - subtotal)} more for minimum order
            </CustomText>
          ) : null}
        </SurfaceCard>

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.footerTotal}>
          <CustomText fontSize={13} color="#666">
            Total
          </CustomText>
          <CustomText fontFamily="SemiBold" fontSize={22} style={{ color: accent }}>
            {totalLabel}
          </CustomText>
        </View>

        <View style={styles.payRow}>
          <TouchableOpacity
            style={[styles.payOpt, paymentMethod === "CASH" && { borderColor: accent }]}
            onPress={() => setPaymentMethod("CASH")}
          >
            <Ionicons
              name="cash-outline"
              size={20}
              color={paymentMethod === "CASH" ? accent : "#666"}
            />
            <CustomText fontSize={13}>Cash</CustomText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.payOpt, paymentMethod === "MOBILE_MONEY" && { borderColor: accent }]}
            onPress={() => setPaymentMethod("MOBILE_MONEY")}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={20}
              color={paymentMethod === "MOBILE_MONEY" ? accent : "#666"}
            />
            <CustomText fontSize={13}>MoMo</CustomText>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={accent} style={{ marginVertical: 12 }} />
        ) : (
          <SlideToPlaceOrder
            label={`Slide to place order · ${totalLabel}`}
            disabled={!readyToOrder}
            accent={accent}
            onConfirm={placeOrder}
          />
        )}
      </View>

      <Modal visible={scheduleModal} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setScheduleModal(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <CustomText fontFamily="SemiBold" fontSize={16} style={{ marginBottom: 12 }}>
              Schedule order
            </CustomText>
            {SCHEDULE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.minutes}
                style={styles.scheduleOpt}
                onPress={() => pickSchedule(opt.minutes)}
              >
                <CustomText fontSize={15}>{opt.label}</CustomText>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.scheduleCancel} onPress={() => setScheduleModal(false)}>
              <CustomText fontSize={14} color="#666">
                Cancel
              </CustomText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.color.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: DS.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: DS.color.border,
  },
  headerTitle: { flex: 1, textAlign: "center", marginHorizontal: 4 },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 8 },
  line: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DS.color.border,
  },
  qtyRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 10 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: DS.color.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: DS.color.border,
  },
  qtyText: { minWidth: 24, textAlign: "center" },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  linkRowPlain: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: DS.color.border,
  },
  commentInput: {
    backgroundColor: DS.color.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DS.color.border,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    minHeight: 72,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  sectionHeading: { marginTop: 16, marginBottom: 10 },
  fulfillmentRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  fulfillmentOpt: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: DS.color.border,
    backgroundColor: DS.color.surface,
  },
  fulfillmentOptDisabled: {
    opacity: 0.55,
  },
  promoRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  promoInput: {
    flex: 1,
    backgroundColor: DS.color.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DS.color.border,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.text,
  },
  promoApply: {
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 10,
  },
  totalsCard: { padding: 16, marginTop: 8 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: DS.color.border,
    marginBottom: 0,
  },
  locLoading: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  locError: { marginBottom: 12, gap: 8 },
  changeAddr: { marginTop: 10, marginBottom: 8 },
  pickupCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    marginTop: 8,
  },
  footer: {
    padding: 16,
    backgroundColor: DS.color.surface,
    borderTopWidth: 1,
    borderTopColor: DS.color.border,
  },
  footerTotal: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  payRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  payOpt: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: DS.color.bg,
    borderWidth: 2,
    borderColor: "transparent",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: DS.spacing.md,
  },
  primaryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  scheduleOpt: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: DS.color.border,
  },
  scheduleCancel: { paddingTop: 16, alignItems: "center" },
});

export default FoodCart;
