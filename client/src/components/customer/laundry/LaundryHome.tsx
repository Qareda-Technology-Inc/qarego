import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { DS } from "@/theme/designSystem";
import { STORE_VERTICAL_CONFIG, resolveStoreVertical } from "@/utils/storeVertical";
import { fetchMyFoodOrders, fetchRestaurants, type FoodOrder, type Restaurant } from "@/service/foodService";
import { LAUNDRY_SERVICES, laundryServiceLabel, returnByLabel } from "@/utils/laundryOptions";
import { laundryStage, LAUNDRY_STAGES } from "@/utils/laundryStage";

const ACCENT = STORE_VERTICAL_CONFIG.LAUNDRY.accentDark;
const ACTIVE = ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP"];

const bookPath = (params: Record<string, string>) => ({ pathname: "/customer/stores/laundry-book" as const, params });

/** Laundry is a booking: one button to book a pickup, what's in progress, and book again. */
export default function LaundryHome() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [orders, setOrders] = useState<FoodOrder[] | null>(null);
  const [shops, setShops] = useState<Restaurant[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [mine, all] = await Promise.all([
      fetchMyFoodOrders().catch(() => [] as FoodOrder[]),
      fetchRestaurants().catch(() => [] as Restaurant[]),
    ]);
    setOrders(mine.filter((o) => !!o.laundry));
    setShops(all.filter((r) => resolveStoreVertical(r) === "LAUNDRY"));
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const active = useMemo(() => (orders ?? []).filter((o) => ACTIVE.includes(o.status)), [orders]);
  // Latest finished booking per shop, for "Book again".
  const again = useMemo(() => {
    const seen = new Set<string>();
    const list: FoodOrder[] = [];
    for (const o of orders ?? []) {
      const shopId = typeof o.restaurant === "object" ? o.restaurant?._id : (o.restaurant as unknown as string);
      if (o.status !== "DELIVERED" || !shopId || seen.has(shopId)) continue;
      seen.add(shopId);
      list.push(o);
      if (list.length === 3) break;
    }
    return list;
  }, [orders]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={DS.color.text} />
        </TouchableOpacity>
        <CustomText fontFamily="SemiBold" fontSize={18} style={{ flex: 1, marginLeft: 12 }}>
          Laundry
        </CustomText>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/customer/orders", params: { filter: "LAUNDRY" } })}
          hitSlop={10}
          accessibilityLabel="Laundry orders"
        >
          <Ionicons name="receipt-outline" size={22} color={DS.color.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ACCENT} />}
      >
        <View style={styles.hero}>
          <CustomText fontFamily="SemiBold" fontSize={17} color="#164e63">
            We collect, wash and bring it back
          </CustomText>
          <CustomText fontSize={13} color="#0e7490" style={{ marginTop: 4 }}>
            Pick a time, a rider collects your bag. Pay cash when it comes back.
          </CustomText>
          <TouchableOpacity style={styles.bookBtn} onPress={() => router.push(bookPath({}))} accessibilityRole="button">
            <CustomText fontFamily="SemiBold" fontSize={15} color="#fff">
              Book a pickup
            </CustomText>
          </TouchableOpacity>
        </View>

        <CustomText fontFamily="SemiBold" fontSize={15} style={styles.section}>
          What do you need?
        </CustomText>
        <View style={styles.grid}>
          {LAUNDRY_SERVICES.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.tile}
              onPress={() => router.push(bookPath({ service: s.id }))}
              accessibilityRole="button"
            >
              <Ionicons name={s.icon} size={22} color={ACCENT} />
              <CustomText fontFamily="Medium" fontSize={14} style={{ marginTop: 8 }}>
                {s.label}
              </CustomText>
              <CustomText fontSize={12} color="#64748b">
                {s.hint}
              </CustomText>
            </TouchableOpacity>
          ))}
        </View>

        {orders === null ? <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} /> : null}

        {active.length ? (
          <>
            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.section}>
              In progress
            </CustomText>
            {active.map((o) => {
              const stage = laundryStage(o);
              return (
                <TouchableOpacity
                  key={o._id}
                  style={styles.card}
                  onPress={() => router.push(`/customer/stores/order/${o._id}` as const)}
                >
                  <View style={styles.rowBetween}>
                    <CustomText fontFamily="Medium" fontSize={14} numberOfLines={1} style={{ flex: 1 }}>
                      {o.restaurantName} · {o.laundry?.countedItemCount ?? o.laundry?.estimatedItemCount ?? 0} items
                    </CustomText>
                    <CustomText fontSize={12} color={ACCENT}>
                      Track
                    </CustomText>
                  </View>
                  <View style={styles.bar}>
                    {LAUNDRY_STAGES.slice(0, 4).map((_, i) => (
                      <View key={i} style={[styles.barSeg, i <= stage.index && styles.barOn]} />
                    ))}
                  </View>
                  <CustomText fontSize={12} color="#64748b">
                    {stage.label}
                    {o.laundry?.returnBy && stage.index < 4 ? ` · back by ${returnByLabel(o.laundry.returnBy)}` : ""}
                    {o.laundry?.priceStatus === "awaiting_customer" ? " · approve the price" : ""}
                  </CustomText>
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}

        {again.length ? (
          <>
            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.section}>
              Book again
            </CustomText>
            {again.map((o) => {
              const shopId = typeof o.restaurant === "object" ? o.restaurant!._id : (o.restaurant as unknown as string);
              const service = o.laundry?.services?.[0];
              return (
                <TouchableOpacity
                  key={o._id}
                  style={[styles.card, styles.row]}
                  onPress={() => router.push(bookPath(service ? { restaurantId: shopId, service } : { restaurantId: shopId }))}
                >
                  <Ionicons name="refresh" size={18} color={ACCENT} />
                  <CustomText fontSize={14} style={{ flex: 1, marginLeft: 10 }} numberOfLines={1}>
                    {o.restaurantName}
                    {laundryServiceLabel(service) ? ` · ${laundryServiceLabel(service)!.toLowerCase()}` : ""}
                  </CustomText>
                  <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}

        {shops.length ? (
          <>
            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.section}>
              Laundries
            </CustomText>
            {shops.slice(0, 8).map((r) => (
              <TouchableOpacity
                key={r._id}
                style={[styles.card, styles.row]}
                onPress={() => router.push(bookPath({ restaurantId: r._id }))}
              >
                <Ionicons name="storefront-outline" size={18} color={ACCENT} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <CustomText fontFamily="Medium" fontSize={14} numberOfLines={1}>
                    {r.name}
                  </CustomText>
                  <CustomText fontSize={12} color="#64748b" numberOfLines={1}>
                    {r.isOpen ? "Open" : r.openLabel || "Closed"}
                    {r.laundryOptions?.expressEnabled ? " · Express" : ""}
                  </CustomText>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </>
        ) : null}
      </ScrollView>
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
  hero: { backgroundColor: "#ecfeff", borderColor: "#a5f3fc", borderWidth: 1, borderRadius: 16, padding: 16 },
  bookBtn: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 14 },
  section: { marginTop: 22, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  tile: {
    width: "48.5%",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    marginBottom: 10,
  },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bar: { flexDirection: "row", gap: 4, marginVertical: 10 },
  barSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#e2e8f0" },
  barOn: { backgroundColor: "#06b6d4" },
});
