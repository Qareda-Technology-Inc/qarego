import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import CustomButton from "@/components/shared/CustomButton";
import MapPickerModal from "@/components/customer/MapPickerModal";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { useUserStore } from "@/store/userStore";
import { useMessage } from "@/context/MessageContext";
import { formatCurrency } from "@/utils/Constants";
import {
  createGasOrder,
  fetchGasOptions,
  fetchGasQuote,
  type GasMode,
  type GasOptions,
  type GasQuote,
} from "@/service/gasService";

import { isNoResponseError, lostConnectionMessage, useConnectivity } from "@/service/connectivity";
import { handleUnpaidRideError } from "@/utils/unpaidRide";
import { useRequestId } from "@/utils/useRequestId";
const GAS = { accent: "#c2410c", soft: "#fff7ed", border: "#fed7aa" };

const MODES: { key: GasMode; title: string; detail: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    key: "REFILL",
    title: "Refill my cylinder",
    detail: "We collect your empty, fill it and bring it back",
    icon: "refresh",
  },
  {
    key: "EXCHANGE",
    title: "Swap for a full one",
    detail: "We bring a full cylinder and take your empty",
    icon: "swap-horizontal",
  },
];

type Point = { latitude: number; longitude: number; address: string };

export default function GasRequestScreen() {
  const { location } = useUserStore();
  const insets = useSafeAreaInsets();
  const { showToast } = useMessage();
  const [options, setOptions] = useState<GasOptions | null>(null);
  const [mode, setMode] = useState<GasMode>("REFILL");
  const [sizeKg, setSizeKg] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [point, setPoint] = useState<Point | null>(location ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<GasQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    fetchGasOptions()
      .then((o) => {
        setOptions(o);
        // Default to the common household size when it exists.
        const preferred = o.cylinders.find((c) => c.sizeKg === 12.5) ?? o.cylinders[0];
        if (preferred) setSizeKg(preferred.sizeKg);
      })
      .catch(() => setQuoteError("Couldn't load gas prices. Pull down to try again."));
  }, []);

  useEffect(() => {
    if (!point || sizeKg == null) return;
    let cancelled = false;
    setQuoting(true);
    setQuoteError(null);
    fetchGasQuote(point, mode, sizeKg, quantity)
      .then((q) => !cancelled && setQuote(q))
      .catch((err) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(err?.response?.data?.msg || "Couldn't get a price right now");
      })
      .finally(() => !cancelled && setQuoting(false));
    return () => {
      cancelled = true;
    };
  }, [point, mode, sizeKg, quantity]);

  const unitPriceFor = useCallback(
    (c: { refillPrice: number; exchangePrice: number }) =>
      mode === "REFILL" ? c.refillPrice : c.exchangePrice,
    [mode]
  );

  const canPlace = !!(quote && point && sizeKg != null && !quoting && !placing);
  const ctaTitle = useMemo(
    () => (quote ? `Request gas · ${formatCurrency(quote.total)}` : "Request gas"),
    [quote]
  );

  const online = useConnectivity((st) => st.online);
  // Same request retried → same id (no duplicate order); any change → a new id.
  const clientRequestId = useRequestId(
    JSON.stringify([mode, sizeKg, quantity, point?.latitude, point?.longitude, notes.trim()])
  );

  const place = async () => {
    if (!canPlace || !point || sizeKg == null || !online) return;
    setPlacing(true);
    try {
      const order = await createGasOrder({
        mode,
        sizeKg,
        quantity,
        delivery: point,
        paymentMethod: "CASH",
        notes: notes.trim() || undefined,
        clientRequestId,
      });
      router.replace({ pathname: "/customer/stores/order/[id]", params: { id: order._id } } as any);
    } catch (err: any) {
      if (handleUnpaidRideError(err)) return;
      showToast(
        isNoResponseError(err)
          ? { title: "Connection lost", message: lostConnectionMessage("gas request"), type: "warning" }
          : {
              title: "Couldn't place request",
              message: err?.response?.data?.msg || "Please try again.",
              type: "error",
            }
      );
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/customer/home"))}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="arrow-back-ios" size={20} color={T.ink} />
          </TouchableOpacity>
          <CustomText fontFamily="SemiBold" fontSize={18} style={styles.headerTitle}>
            Cooking gas
          </CustomText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionTitle}>
            What do you need?
          </CustomText>
          {MODES.map((m) => {
            const on = m.key === mode;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeCard, on && styles.modeCardOn]}
                onPress={() => setMode(m.key)}
                activeOpacity={0.85}
                accessibilityState={{ selected: on }}
              >
                <View style={[styles.modeIcon, on && styles.modeIconOn]}>
                  <Ionicons name={m.icon} size={20} color={on ? "#fff" : GAS.accent} />
                </View>
                <View style={styles.flex}>
                  <CustomText fontFamily="SemiBold" fontSize={15}>
                    {m.title}
                  </CustomText>
                  <CustomText fontSize={12} color={T.inkMuted}>
                    {m.detail}
                  </CustomText>
                </View>
                <Ionicons
                  name={on ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={on ? GAS.accent : T.inkSoft}
                />
              </TouchableOpacity>
            );
          })}

          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionTitle}>
            Cylinder size
          </CustomText>
          {!options ? (
            <ActivityIndicator color={GAS.accent} style={{ marginVertical: 12 }} />
          ) : (
            <View style={styles.sizeGrid}>
              {options.cylinders.map((c) => {
                const on = c.sizeKg === sizeKg;
                return (
                  <TouchableOpacity
                    key={c.sizeKg}
                    style={[styles.sizeChip, on && styles.sizeChipOn]}
                    onPress={() => setSizeKg(c.sizeKg)}
                    activeOpacity={0.85}
                    accessibilityState={{ selected: on }}
                  >
                    <CustomText fontFamily="Bold" fontSize={16} color={on ? GAS.accent : T.ink}>
                      {c.label}
                    </CustomText>
                    <CustomText fontSize={12} color={T.inkMuted}>
                      {formatCurrency(unitPriceFor(c))}
                    </CustomText>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.qtyRow}>
            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.flex}>
              Number of cylinders
            </CustomText>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              accessibilityLabel="Fewer cylinders"
            >
              <Ionicons name="remove" size={18} color={T.ink} />
            </TouchableOpacity>
            <CustomText fontFamily="Bold" fontSize={16} style={styles.qtyValue}>
              {quantity}
            </CustomText>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQuantity((q) => Math.min(3, q + 1))}
              accessibilityLabel="More cylinders"
            >
              <Ionicons name="add" size={18} color={T.ink} />
            </TouchableOpacity>
          </View>

          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionTitle}>
            {mode === "REFILL" ? "Collect from" : "Deliver to"}
          </CustomText>
          <TouchableOpacity style={styles.addressCard} onPress={() => setPickerOpen(true)} activeOpacity={0.85}>
            <Ionicons name="location" size={20} color={GAS.accent} />
            <CustomText fontSize={14} numberOfLines={2} style={styles.flex}>
              {point?.address || "Choose your location"}
            </CustomText>
            <CustomText fontFamily="SemiBold" fontSize={13} color={GAS.accent}>
              Change
            </CustomText>
          </TouchableOpacity>
          <TextInput
            style={styles.notes}
            placeholder="Note for courier, e.g. blue gate by the school"
            placeholderTextColor={T.inkSoft}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <View style={styles.summary}>
            {quoting ? (
              <ActivityIndicator color={GAS.accent} />
            ) : quote ? (
              <>
                <CustomText fontSize={12} color={T.inkMuted} style={{ marginBottom: 8 }}>
                  {mode === "REFILL" ? "Filled by" : "Full cylinder from"} {quote.station.name}
                </CustomText>
                <Line label={`Gas (${quote.quantity}×)`} value={quote.subtotal} />
                <Line label="Delivery (both ways)" value={quote.deliveryFee} />
                <Line label="Service fee" value={quote.serviceFee} />
                <View style={styles.divider} />
                <Line label="Total" value={quote.total} bold />
                <View style={styles.cashRow}>
                  <Ionicons name="cash-outline" size={16} color={T.inkMuted} />
                  <CustomText fontSize={12} color={T.inkMuted} style={styles.flex}>
                    Pay cash to the courier {mode === "REFILL" ? "when your gas is returned" : "on delivery"}
                  </CustomText>
                </View>
              </>
            ) : (
              <CustomText fontSize={13} color={T.inkMuted} style={{ textAlign: "center" }}>
                {quoteError || "Choose your location to see the price"}
              </CustomText>
            )}
          </View>
        </ScrollView>

        {/* Android draws under the navigation bar (edge-to-edge), so pad by the real inset. */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <CustomButton
            title={online ? ctaTitle : "Waiting for connection…"}
            onPress={place}
            disabled={!canPlace || !online}
            loading={placing}
          />
        </View>
      </SafeAreaView>

      <MapPickerModal
        visible={pickerOpen}
        title="pickup"
        selectedLocation={point ?? { latitude: 0, longitude: 0, address: "" }}
        onClose={() => setPickerOpen(false)}
        onSelectLocation={(loc) =>
          setPoint({ latitude: loc.latitude, longitude: loc.longitude, address: loc.address })
        }
      />
    </View>
  );
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.line}>
      <CustomText fontSize={14} fontFamily={bold ? "Bold" : "Regular"} style={styles.flex}>
        {label}
      </CustomText>
      <CustomText fontSize={14} fontFamily={bold ? "Bold" : "Medium"}>
        {formatCurrency(value)}
      </CustomText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.surfaceMuted },
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.sheetBg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: { width: 40, height: 40 },
  headerTitle: { flex: 1, textAlign: "center", color: T.ink },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionTitle: { color: T.ink, marginTop: 18, marginBottom: 10 },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: T.sheetBg,
    borderRadius: T.radius.card,
    borderWidth: 1.5,
    borderColor: T.border,
    padding: 14,
    marginBottom: 10,
  },
  modeCardOn: { borderColor: GAS.accent, backgroundColor: GAS.soft },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: GAS.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  modeIconOn: { backgroundColor: GAS.accent },
  sizeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sizeChip: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: T.sheetBg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  sizeChipOn: { borderColor: GAS.accent, backgroundColor: GAS.soft },
  qtyRow: { flexDirection: "row", alignItems: "center", marginTop: 18 },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.sheetBg,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValue: { minWidth: 32, textAlign: "center" },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: T.sheetBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    padding: 14,
  },
  notes: {
    marginTop: 10,
    minHeight: 56,
    backgroundColor: T.sheetBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Regular",
    color: T.ink,
    textAlignVertical: "top",
  },
  summary: {
    marginTop: 18,
    backgroundColor: T.sheetBg,
    borderRadius: T.radius.card,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
  },
  line: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  divider: { height: 1, backgroundColor: T.border, marginVertical: 8 },
  cashRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: T.sheetBg,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
});
