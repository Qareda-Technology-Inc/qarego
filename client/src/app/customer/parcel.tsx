import React, { useCallback, useMemo, useState } from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
// RN's own SafeAreaView overrides style padding on iOS, which dropped the side margins.
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { ParcelTheme as P } from "@/styles/parcelTheme";
import type { ParcelMode } from "@/utils/parcelMode";
import { fetchRideHistory } from "@/service/rideService";
import { calculateDistance } from "@/utils/mapUtils";

type Place = { address?: string; latitude?: number; longitude?: number };
type ParcelRide = {
  _id: string;
  serviceType?: string;
  status?: string;
  parcelMode?: string;
  vehicle?: string;
  recipientName?: string;
  recipientPhone?: string;
  pickup?: Place;
  drop?: Place;
  createdAt?: string;
};

const ACTIVE = ["SEARCHING_FOR_RIDER", "START", "ARRIVED", "IN_PROGRESS"];
const ACTIVE_WORD: Record<string, string> = {
  SEARCHING_FOR_RIDER: "Finding a rider",
  START: "Rider on the way to pickup",
  ARRIVED: "Rider at pickup",
  IN_PROGRESS: "On the way",
};

const shortPlace = (a?: string) => (a ? a.split(/[,·]/)[0].trim() : "");
const ago = (iso?: string) => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  return `${Math.floor(days / 7)} weeks ago`;
};

const ParcelHomeScreen = () => {
  const [rides, setRides] = useState<ParcelRide[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchRideHistory()
        .then((list: ParcelRide[]) => {
          if (!cancelled) setRides((list || []).filter((r) => r.serviceType === "DELIVERY"));
        })
        .catch(() => !cancelled && setRides([]));
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const active = useMemo(() => (rides || []).filter((r) => ACTIVE.includes(r.status || "")), [rides]);
  // One row per receiver (sending) or pickup place (receiving), newest first.
  const again = useMemo(() => {
    const seen = new Set<string>();
    const out: ParcelRide[] = [];
    for (const r of [...(rides || [])]
      .filter((x) => x.status === "COMPLETED")
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))) {
      const key =
        r.parcelMode === "RECEIVE"
          ? `R:${r.pickup?.address}`
          : `S:${r.recipientPhone}:${r.drop?.address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
      if (out.length >= 3) break;
    }
    return out;
  }, [rides]);

  const start = (mode: ParcelMode) =>
    router.navigate({
      pathname: "/customer/selectlocations",
      params: { vehicle: "motorcycle", serviceType: "DELIVERY", parcelMode: mode },
    });

  // Repeat a past parcel: same places and receiver, then the customer checks size and pays.
  const sendAgain = (r: ParcelRide) => {
    const p = r.pickup;
    const d = r.drop;
    if (p?.latitude == null || p?.longitude == null || d?.latitude == null || d?.longitude == null) {
      return start(r.parcelMode === "RECEIVE" ? "RECEIVE" : "SEND");
    }
    const receive = r.parcelMode === "RECEIVE";
    router.navigate({
      pathname: "/customer/ridebooking",
      params: {
        serviceType: "DELIVERY",
        parcelMode: receive ? "RECEIVE" : "SEND",
        vehicle: r.vehicle === "pragya" ? "pragya" : "motorcycle",
        distanceInKm: String(calculateDistance(p.latitude, p.longitude, d.latitude, d.longitude)),
        pickup_latitude: String(p.latitude),
        pickup_longitude: String(p.longitude),
        pickup_address: p.address || "",
        drop_latitude: String(d.latitude),
        drop_longitude: String(d.longitude),
        drop_address: d.address || "",
        ...(receive ? {} : { recipientName: r.recipientName || "", recipientPhone: r.recipientPhone || "" }),
      },
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/customer/home"))}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="arrow-back-ios" size={20} color={T.ink} />
          </TouchableOpacity>
          <CustomText fontFamily="SemiBold" fontSize={18} style={styles.headerTitle}>
            Parcel
          </CustomText>
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/customer/orders", params: { filter: "parcels" } })}
            style={styles.backBtn}
            accessibilityLabel="All parcels"
          >
            <Ionicons name="receipt-outline" size={20} color={T.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.tiles}>
            <TouchableOpacity style={[styles.tile, styles.tileSend]} onPress={() => start("SEND")} activeOpacity={0.88}>
              <Ionicons name="arrow-up-circle-outline" size={30} color="#fff" />
              <CustomText fontFamily="Bold" fontSize={17} style={styles.tileTitleOn}>
                Send
              </CustomText>
              <CustomText fontSize={12} style={styles.tileSubOn}>
                From you to someone
              </CustomText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tile, styles.tileReceive]} onPress={() => start("RECEIVE")} activeOpacity={0.88}>
              <Ionicons name="arrow-down-circle-outline" size={30} color={P.accent} />
              <CustomText fontFamily="Bold" fontSize={17} style={styles.tileTitle}>
                Receive
              </CustomText>
              <CustomText fontSize={12} style={styles.tileSub}>
                Collect and bring to you
              </CustomText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.hint} onPress={() => start("RECEIVE")} activeOpacity={0.85}>
            <View style={styles.rowIcon}>
              <Ionicons name="bus-outline" size={20} color={P.accent} />
            </View>
            <View style={styles.rowText}>
              <CustomText fontFamily="SemiBold" fontSize={14} style={styles.ink}>
                Collect from a bus station?
              </CustomText>
              <CustomText fontSize={12} style={styles.muted}>
                Pick VIP, STC or a mall from the list
              </CustomText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.inkSoft} />
          </TouchableOpacity>

          {rides === null ? (
            <ActivityIndicator color={P.accent} style={{ marginTop: 24 }} />
          ) : (
            <>
              {active.length > 0 ? (
                <>
                  <CustomText fontFamily="SemiBold" fontSize={15} style={styles.section}>
                    Active
                  </CustomText>
                  {active.map((r) => (
                    <TouchableOpacity
                      key={r._id}
                      style={styles.row}
                      onPress={() => router.navigate({ pathname: "/customer/liveride", params: { id: r._id } })}
                      activeOpacity={0.85}
                    >
                      <View style={styles.rowIcon}>
                        <Ionicons name="bicycle-outline" size={20} color={P.accent} />
                      </View>
                      <View style={styles.rowText}>
                        <CustomText fontFamily="SemiBold" fontSize={14} numberOfLines={1} style={styles.ink}>
                          {r.parcelMode === "RECEIVE"
                            ? `From ${shortPlace(r.pickup?.address) || "pickup"}`
                            : `To ${r.recipientName?.split(" ")[0] || "receiver"} · ${shortPlace(r.drop?.address)}`}
                        </CustomText>
                        <CustomText fontSize={12} style={styles.muted}>
                          {ACTIVE_WORD[r.status || ""] || "In progress"}
                        </CustomText>
                      </View>
                      <View style={styles.trackPill}>
                        <CustomText fontFamily="SemiBold" fontSize={12} style={{ color: P.ink }}>
                          Track
                        </CustomText>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              ) : null}

              {again.length > 0 ? (
                <>
                  <View style={styles.sectionRow}>
                    <CustomText fontFamily="SemiBold" fontSize={15} style={styles.ink}>
                      Send again
                    </CustomText>
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: "/customer/orders", params: { filter: "parcels" } })}
                    >
                      <CustomText fontFamily="SemiBold" fontSize={12} style={{ color: P.accent }}>
                        All parcels
                      </CustomText>
                    </TouchableOpacity>
                  </View>
                  {again.map((r) => {
                    const receive = r.parcelMode === "RECEIVE";
                    return (
                      <TouchableOpacity key={r._id} style={styles.row} onPress={() => sendAgain(r)} activeOpacity={0.85}>
                        <View style={styles.rowIcon}>
                          <Ionicons name={receive ? "arrow-down-outline" : "person-outline"} size={20} color={P.accent} />
                        </View>
                        <View style={styles.rowText}>
                          <CustomText fontFamily="SemiBold" fontSize={14} numberOfLines={1} style={styles.ink}>
                            {receive ? `From ${shortPlace(r.pickup?.address)}` : r.recipientName || "Receiver"}
                          </CustomText>
                          <CustomText fontSize={12} numberOfLines={1} style={styles.muted}>
                            {receive ? "To you" : shortPlace(r.drop?.address)} · {ago(r.createdAt)}
                          </CustomText>
                        </View>
                        <Ionicons name="repeat" size={20} color={P.accent} />
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.surfaceMuted },
  safe: { flex: 1, paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", paddingVertical: 12, marginBottom: 4 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.sheetBg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, textAlign: "center", color: T.ink },
  scroll: { paddingBottom: 32 },
  tiles: { flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 12 },
  tile: { flex: 1, borderRadius: 18, padding: 16, minHeight: 128, justifyContent: "flex-end", gap: 2 },
  tileSend: { backgroundColor: P.accent },
  tileReceive: { backgroundColor: P.accentSoft },
  tileTitleOn: { color: "#fff", marginTop: 8 },
  tileSubOn: { color: "#EDE9FE" },
  tileTitle: { color: P.ink, marginTop: 8 },
  tileSub: { color: "#6D28D9" },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF5FF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    marginBottom: 8,
  },
  section: { color: T.ink, marginTop: 16, marginBottom: 8 },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.sheetBg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: T.border,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: P.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowText: { flex: 1, minWidth: 0 },
  ink: { color: T.ink },
  muted: { color: T.inkMuted, marginTop: 2 },
  trackPill: { backgroundColor: P.accentSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});

export default ParcelHomeScreen;
