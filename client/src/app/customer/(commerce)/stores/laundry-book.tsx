import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import DeliverToBar from "@/components/customer/food/DeliverToBar";
import LaundryPickupPicker from "@/components/customer/food/LaundryPickupPicker";
import { formatCurrency } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import { STORE_VERTICAL_CONFIG, resolveStoreVertical } from "@/utils/storeVertical";
import {
  createFoodOrder,
  fetchFoodCheckoutSettings,
  fetchFoodDeliveryQuote,
  fetchRestaurantMenu,
  fetchRestaurants,
  type MenuItem,
  type Restaurant,
} from "@/service/foodService";
import { useUserStore } from "@/store/userStore";
import { ensureUserDeliveryLocation, hasValidDeliveryCoords } from "@/utils/ensureDeliveryLocation";
import { calculateDistance } from "@/utils/mapUtils";
import { calculateServiceFee } from "@/utils/feeUtils";
import {
  LAUNDRY_SERVICES,
  itemInService,
  laundryOptionsFor,
  turnaroundLabel,
  type LaundryServiceId,
} from "@/utils/laundryOptions";
import { useRequestId } from "@/utils/useRequestId";
import { isNoResponseError, lostConnectionMessage, useConnectivity } from "@/service/connectivity";

const ACCENT = STORE_VERTICAL_CONFIG.LAUNDRY.accentDark;
const isService = (v?: string): v is LaundryServiceId => LAUNDRY_SERVICES.some((s) => s.id === v);

/**
 * Book a laundry pickup on one screen: shop, what's roughly in the bag, when to collect, how fast.
 * The shop counts it on arrival; if it costs more, the customer approves before washing.
 */
export default function LaundryBookScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ restaurantId?: string; service?: string }>();
  const { location, setLocation } = useUserStore();
  const online = useConnectivity((st) => st.online);

  const [shops, setShops] = useState<Restaurant[] | null>(null);
  const [shopId, setShopId] = useState<string | null>(params.restaurantId ?? null);
  const [pickingShop, setPickingShop] = useState(false);
  const [menu, setMenu] = useState<{ id: string; items: MenuItem[] } | null>(null);
  const [service, setService] = useState<LaundryServiceId | null>(isService(params.service) ? params.service : null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pickupAt, setPickupAt] = useState<string | null>(null);
  const [pickupReady, setPickupReady] = useState(false);
  const [express, setExpress] = useState(false);
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<{ id: string; fee: number; km: number } | null>(null);
  const [feeCfg, setFeeCfg] = useState({ rate: 0.08, min: 2, max: 12 });
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    ensureUserDeliveryLocation(location, setLocation).catch(() => {});
  }, [location, setLocation]);

  useEffect(() => {
    fetchRestaurants()
      .then((all) => setShops(all.filter((r) => resolveStoreVertical(r) === "LAUNDRY")))
      .catch(() => setShops([]));
    fetchFoodCheckoutSettings("LAUNDRY")
      .then((c) => setFeeCfg({ rate: c.serviceFeeRate, min: c.serviceFeeMin, max: c.serviceFeeMax }))
      .catch(() => {});
  }, []);

  const hasCoords = hasValidDeliveryCoords(location);
  const sorted = useMemo(() => {
    const km = (r: Restaurant) =>
      hasCoords && typeof r.latitude === "number" && typeof r.longitude === "number"
        ? calculateDistance(r.latitude, r.longitude, location!.latitude, location!.longitude)
        : 9999;
    // Laundry can be booked while a shop is closed (it collects when it opens), so only rank.
    return [...(shops ?? [])].sort((a, b) => (a.isOpen === b.isOpen ? km(a) - km(b) : a.isOpen ? -1 : 1));
  }, [shops, hasCoords, location]);

  const shop = sorted.find((r) => r._id === shopId) ?? sorted[0] ?? null;
  const options = laundryOptionsFor(shop);
  const bookable = !!shop && (shop.isOpen || shop.openStatus === "closed");

  useEffect(() => {
    if (!shop) return;
    let alive = true;
    fetchRestaurantMenu(shop._id)
      .then((d) => alive && setMenu({ id: shop._id, items: d.menuItems ?? [] }))
      .catch(() => alive && setMenu({ id: shop._id, items: [] }));
    return () => {
      alive = false;
    };
  }, [shop?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shop || !hasCoords) return;
    let alive = true;
    fetchFoodDeliveryQuote(shop._id, location!.latitude, location!.longitude)
      .then((q) => alive && setQuote({ id: shop._id, fee: q.deliveryFee, km: q.distanceKm }))
      .catch(() => alive && setQuote(null));
    return () => {
      alive = false;
    };
  }, [shop?._id, hasCoords, location?.latitude, location?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = menu && shop && menu.id === shop._id ? menu.items : null;
  // Services this shop prices. A shop that hasn't tagged its list shows everything at once.
  const offered = useMemo(
    () => LAUNDRY_SERVICES.filter((s) => (items ?? []).some((i) => i.laundryService === s.id)),
    [items]
  );
  const activeService = offered.length ? (service && offered.some((s) => s.id === service) ? service : offered[0].id) : null;
  const shown = (items ?? []).filter((i) => !activeService || itemInService(i, activeService));

  const lines = (items ?? []).filter((i) => (counts[i._id] || 0) > 0);
  const itemCount = lines.reduce((n, i) => n + counts[i._id], 0);
  const washing = lines.reduce((s, i) => s + i.price * counts[i._id], 0);
  const expressOn = express && options.expressEnabled;
  const subtotal = Math.round((washing + (expressOn ? options.expressFee : 0)) * 100) / 100;
  const serviceFee = subtotal > 0 ? calculateServiceFee(subtotal, feeCfg.rate, feeCfg.min, feeCfg.max) : 0;
  const delivery = quote && shop && quote.id === shop._id ? quote.fee : null;
  const total = subtotal + serviceFee + (delivery ?? 0);
  const minOrder = shop?.minOrderAmount ?? 0;

  const ready = !!shop && bookable && itemCount > 0 && hasCoords && pickupReady && delivery != null && online && washing >= minOrder;

  const clientRequestId = useRequestId(
    JSON.stringify([shop?._id, lines.map((i) => [i._id, counts[i._id]]), pickupAt, expressOn, notes.trim(), location?.latitude])
  );

  const setCount = (id: string, q: number) => setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(99, q)) }));

  const book = async () => {
    if (!ready || !shop) return;
    setBooking(true);
    try {
      const res = await createFoodOrder({
        restaurantId: shop._id,
        items: lines.map((i) => ({ menuItemId: i._id, quantity: counts[i._id] })),
        delivery: {
          address: location!.address || "Your location",
          latitude: location!.latitude,
          longitude: location!.longitude,
        },
        paymentMethod: "CASH",
        fulfillmentType: "DELIVERY",
        laundryPickupAt: pickupAt ?? undefined,
        laundryExpress: expressOn || undefined,
        notes: notes.trim() || undefined,
        clientRequestId,
      });
      const id = res?.order?._id as string | undefined;
      if (id) router.replace(`/customer/stores/order/${id}` as const);
    } catch (err) {
      if (isNoResponseError(err)) Alert.alert("Connection lost", lostConnectionMessage("order"));
    } finally {
      setBooking(false);
    }
  };

  const footerHint = !shop
    ? "No laundries near you yet"
    : !bookable
    ? `${shop.name} isn't taking bookings right now`
    : itemCount === 0
    ? "Add a rough count of what's in the bag"
    : washing < minOrder
    ? `Minimum ${formatCurrency(minOrder)} at ${shop.name}`
    : "The shop counts it. If it costs more, you approve first.";

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={DS.color.text} />
        </TouchableOpacity>
        <CustomText fontFamily="SemiBold" fontSize={17} style={{ marginLeft: 12 }}>
          Book a pickup
        </CustomText>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {shops === null ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
        ) : !shop ? (
          <CustomText fontSize={14} color="#64748b">
            No laundries are available near you yet.
          </CustomText>
        ) : (
          <>
            <TouchableOpacity style={[styles.card, styles.row]} onPress={() => setPickingShop((v) => !v)}>
              <Ionicons name="storefront-outline" size={20} color={ACCENT} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <CustomText fontFamily="Medium" fontSize={14}>
                  {shop.name}
                </CustomText>
                <CustomText fontSize={12} color="#64748b">
                  {[quote?.id === shop._id ? `${quote.km.toFixed(1)} km` : null, shop.isOpen ? "Open" : shop.openLabel || "Closed", turnaroundLabel(options.standardHours)]
                    .filter(Boolean)
                    .join(" · ")}
                </CustomText>
              </View>
              {sorted.length > 1 ? (
                <CustomText fontSize={13} color={ACCENT}>
                  {pickingShop ? "Done" : "Change"}
                </CustomText>
              ) : null}
            </TouchableOpacity>
            {pickingShop
              ? sorted.map((r) => (
                  <TouchableOpacity
                    key={r._id}
                    style={[styles.shopRow, r._id === shop._id && styles.shopOn]}
                    onPress={() => {
                      setShopId(r._id);
                      setCounts({});
                      setExpress(false);
                      setPickingShop(false);
                    }}
                  >
                    <Ionicons
                      name={r._id === shop._id ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={r._id === shop._id ? ACCENT : "#94a3b8"}
                    />
                    <CustomText fontSize={14} style={{ flex: 1, marginLeft: 10 }} numberOfLines={1}>
                      {r.name}
                    </CustomText>
                    <CustomText fontSize={12} color="#64748b">
                      {r.isOpen ? "Open" : "Closed"}
                      {r.laundryOptions?.expressEnabled ? " · Express" : ""}
                    </CustomText>
                  </TouchableOpacity>
                ))
              : null}

            {offered.length ? (
              <>
                <CustomText fontFamily="SemiBold" fontSize={15} style={styles.section}>
                  Service
                </CustomText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {offered.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.chip, activeService === s.id && styles.chipOn]}
                      onPress={() => setService(s.id)}
                    >
                      <Ionicons name={s.icon} size={15} color={activeService === s.id ? "#fff" : ACCENT} />
                      <CustomText fontSize={13} color={activeService === s.id ? "#fff" : "#0f172a"} style={{ marginLeft: 6 }}>
                        {s.label}
                      </CustomText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.section}>
              What&apos;s in the bag?{" "}
              <CustomText fontSize={12} color="#64748b">
                (a guess is fine)
              </CustomText>
            </CustomText>
            {items === null ? (
              <ActivityIndicator color={ACCENT} />
            ) : shown.length === 0 ? (
              <CustomText fontSize={13} color="#64748b">
                {shop.name} hasn&apos;t added prices yet.
              </CustomText>
            ) : (
              <View style={styles.list}>
                {shown.map((i) => {
                  const q = counts[i._id] || 0;
                  return (
                    <View key={i._id} style={styles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <CustomText fontSize={14}>{i.name}</CustomText>
                        <CustomText fontSize={12} color="#64748b">
                          {formatCurrency(i.price)} each
                        </CustomText>
                      </View>
                      <TouchableOpacity
                        style={[styles.step, !q && { opacity: 0.35 }]}
                        disabled={!q}
                        onPress={() => setCount(i._id, q - 1)}
                        accessibilityLabel={`One less ${i.name}`}
                      >
                        <Ionicons name="remove" size={18} color={ACCENT} />
                      </TouchableOpacity>
                      <CustomText fontFamily="SemiBold" fontSize={15} style={styles.qty}>
                        {q}
                      </CustomText>
                      <TouchableOpacity
                        style={styles.step}
                        onPress={() => setCount(i._id, q + 1)}
                        accessibilityLabel={`One more ${i.name}`}
                      >
                        <Ionicons name="add" size={18} color={ACCENT} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.section}>
              When should we collect?
            </CustomText>
            <LaundryPickupPicker
              key={shop._id}
              restaurantId={shop._id}
              accent={ACCENT}
              value={pickupAt}
              onChange={setPickupAt}
              onReadyChange={setPickupReady}
            />

            {options.expressEnabled ? (
              <>
                <CustomText fontFamily="SemiBold" fontSize={15} style={styles.section}>
                  How fast?
                </CustomText>
                <View style={styles.speedRow}>
                  <TouchableOpacity style={[styles.speed, !expressOn && styles.speedOn]} onPress={() => setExpress(false)}>
                    <CustomText fontFamily="Medium" fontSize={14}>
                      Standard
                    </CustomText>
                    <CustomText fontSize={12} color="#64748b">
                      {turnaroundLabel(options.standardHours)}
                    </CustomText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.speed, expressOn && styles.speedOn]} onPress={() => setExpress(true)}>
                    <CustomText fontFamily="Medium" fontSize={14}>
                      Express
                    </CustomText>
                    <CustomText fontSize={12} color="#64748b">
                      {turnaroundLabel(options.expressHours)} · +{formatCurrency(options.expressFee)}
                    </CustomText>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.section}>
              Collect from
            </CustomText>
            <View style={styles.deliverBox}>
              <DeliverToBar accentColor={ACCENT} />
            </View>
            <TextInput
              value={notes}
              onChangeText={(t) => setNotes(t.slice(0, 300))}
              placeholder="Notes for the shop, e.g. no starch, hang the dress"
              placeholderTextColor="#94a3b8"
              multiline
              style={styles.notes}
            />
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {itemCount > 0 ? (
          <View style={{ marginBottom: 8 }}>
            <View style={styles.sumRow}>
              <CustomText fontSize={12} color="#64748b">
                Washing, {itemCount} item{itemCount === 1 ? "" : "s"} (estimate)
              </CustomText>
              <CustomText fontSize={12} color="#64748b">{formatCurrency(washing)}</CustomText>
            </View>
            {expressOn ? (
              <View style={styles.sumRow}>
                <CustomText fontSize={12} color="#64748b">Express</CustomText>
                <CustomText fontSize={12} color="#64748b">{formatCurrency(options.expressFee)}</CustomText>
              </View>
            ) : null}
            <View style={styles.sumRow}>
              <CustomText fontSize={12} color="#64748b">Service fee</CustomText>
              <CustomText fontSize={12} color="#64748b">{formatCurrency(serviceFee)}</CustomText>
            </View>
            <View style={styles.sumRow}>
              <CustomText fontSize={12} color="#64748b">Collect and return</CustomText>
              <CustomText fontSize={12} color="#64748b">{delivery != null ? formatCurrency(delivery) : "…"}</CustomText>
            </View>
          </View>
        ) : null}
        <CustomText fontSize={12} color="#64748b" style={{ textAlign: "center", marginBottom: 8 }}>
          {footerHint}
        </CustomText>
        <TouchableOpacity
          style={[styles.bookBtn, !ready && { opacity: 0.45 }]}
          disabled={!ready || booking}
          onPress={book}
          accessibilityRole="button"
        >
          {booking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <CustomText fontFamily="SemiBold" fontSize={15} color="#fff">
              {online ? (itemCount ? `Book pickup · about ${formatCurrency(total)}` : "Book pickup") : "Waiting for connection…"}
            </CustomText>
          )}
        </TouchableOpacity>
        <CustomText fontSize={11} color="#64748b" style={{ textAlign: "center", marginTop: 6 }}>
          Pay cash when it comes back
        </CustomText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.color.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  content: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", padding: 14 },
  row: { flexDirection: "row", alignItems: "center" },
  shopRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  shopOn: { backgroundColor: "#ecfeff" },
  section: { marginTop: 20, marginBottom: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  chipOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  list: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 14 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  step: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#a5f3fc",
    alignItems: "center",
    justifyContent: "center",
  },
  qty: { width: 30, textAlign: "center" },
  speedRow: { flexDirection: "row", gap: 10 },
  speed: { flex: 1, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5, borderColor: "#e2e8f0", padding: 12 },
  speedOn: { borderColor: ACCENT, backgroundColor: "#ecfeff" },
  deliverBox: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden" },
  notes: {
    marginTop: 10,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    textAlignVertical: "top",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1 },
  bookBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
});
