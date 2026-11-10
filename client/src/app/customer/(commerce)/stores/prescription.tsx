import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import SoonTag from "@/components/shared/SoonTag";
import DeliverToBar from "@/components/customer/food/DeliverToBar";
import { formatCurrency } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import { STORE_VERTICAL_CONFIG, resolveStoreVertical } from "@/utils/storeVertical";
import { createFoodOrder, fetchFoodCheckoutSettings, fetchRestaurants, type Restaurant } from "@/service/foodService";
import { useUserStore } from "@/store/userStore";
import { ensureUserDeliveryLocation, hasValidDeliveryCoords } from "@/utils/ensureDeliveryLocation";
import { calculateDistance, calculateFoodDeliveryFee } from "@/utils/mapUtils";
import { MAX_PRESCRIPTION_PHOTOS } from "@/utils/prescription";
import { pickPrescriptionImage } from "@/utils/pickPrescriptionImage";
import { uploadMediaUri } from "@/service/mediaUpload";
import { openMomoComingSoon, useMomoPayAvailable } from "@/utils/momo";
import { useRequestId } from "@/utils/useRequestId";
import { isNoResponseError, lostConnectionMessage, useConnectivity } from "@/service/connectivity";

const ACCENT = STORE_VERTICAL_CONFIG.PHARMACY.accent;
const ACCENT_DARK = STORE_VERTICAL_CONFIG.PHARMACY.accentDark;
const SHOWN_PHARMACIES = 5;

type Rates = Record<string, { baseFare: number; perKmRate: number; minimumFare: number }> | null;

const STEPS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: "camera-outline", text: "Snap your prescription" },
  { icon: "pricetag-outline", text: "A pharmacist sends the price" },
  { icon: "checkmark-circle-outline", text: "Approve, and it's on its way" },
];

/**
 * Send a prescription (photo, or a short list) to one pharmacy. The pharmacist prices it and
 * the customer approves on the order screen; nothing is paid before that.
 */
export default function SendPrescriptionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ restaurantId?: string }>();
  const { location, setLocation } = useUserStore();
  const momoAvailable = useMomoPayAvailable();
  const online = useConnectivity((st) => st.online);

  const [photos, setPhotos] = useState<{ uri: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [pharmacies, setPharmacies] = useState<Restaurant[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rates, setRates] = useState<Rates>(null);
  const [chosenId, setChosenId] = useState<string | null>(params.restaurantId ?? null);
  const [showAll, setShowAll] = useState(false);
  const [mode, setMode] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "MOBILE_MONEY">("CASH");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    ensureUserDeliveryLocation(location, setLocation).catch(() => {});
  }, [location, setLocation]);

  useEffect(() => {
    fetchRestaurants()
      .then((all) => setPharmacies(all.filter((r) => resolveStoreVertical(r) === "PHARMACY")))
      .catch((e) => {
        setPharmacies([]);
        setLoadError(e?.response?.data?.msg || "Couldn't load pharmacies");
      });
    fetchFoodCheckoutSettings("PHARMACY")
      .then((cfg) => setRates(cfg.fareRates ?? null))
      .catch(() => setRates(null));
  }, []);

  const hasCoords = hasValidDeliveryCoords(location);
  const distanceTo = (r: Restaurant) =>
    hasCoords && typeof r.latitude === "number" && typeof r.longitude === "number"
      ? calculateDistance(r.latitude, r.longitude, location!.latitude, location!.longitude)
      : null;

  // Open ones first, nearest first.
  const sorted = useMemo(() => {
    const list = (pharmacies ?? []).map((r) => ({ r, km: distanceTo(r) }));
    list.sort((a, b) => {
      if (!!a.r.isOpen !== !!b.r.isOpen) return a.r.isOpen ? -1 : 1;
      return (a.km ?? 9999) - (b.km ?? 9999);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pharmacies, location?.latitude, location?.longitude]);

  // Nearest open pharmacy unless the customer came from a pharmacy's page.
  const selectedId = chosenId ?? sorted.find((x) => x.r.isOpen)?.r._id ?? null;
  const selected = sorted.find((x) => x.r._id === selectedId) ?? null;
  const pickupAllowed = !!selected?.r.allowsPickup;
  const fulfillment = mode === "PICKUP" && pickupAllowed ? "PICKUP" : "DELIVERY";
  const deliveryFee = selected?.km != null ? calculateFoodDeliveryFee(selected.km, rates) : null;

  const visible = showAll ? sorted : sorted.slice(0, SHOWN_PHARMACIES);
  // Keep the chosen one in view even when it's further down the list.
  if (selected && !visible.includes(selected)) visible.push(selected);

  const photoUrls = photos.map((p) => p.url);
  const hasSomething = photoUrls.length > 0 || note.trim().length >= 3;
  const ready =
    hasSomething && !uploading && !!selected?.r.isOpen && (fulfillment === "PICKUP" || hasCoords) && online;

  const clientRequestId = useRequestId(
    JSON.stringify([selectedId, photoUrls, note.trim(), fulfillment, paymentMethod, location?.latitude, location?.longitude])
  );

  const addPhoto = async () => {
    if (photos.length >= MAX_PRESCRIPTION_PHOTOS) return;
    const uri = await pickPrescriptionImage();
    if (!uri) return;
    setUploading(true);
    try {
      const { url } = await uploadMediaUri(uri, "prescriptions");
      setPhotos((prev) => [...prev, { uri, url }]);
    } catch {
      Alert.alert("Upload failed", "Couldn't upload the photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    if (!ready || !selected) return;
    setSending(true);
    try {
      const r = selected.r;
      const delivery =
        fulfillment === "PICKUP"
          ? { address: r.address || r.name, latitude: r.latitude!, longitude: r.longitude! }
          : {
              address: location!.address || "Your delivery location",
              latitude: location!.latitude,
              longitude: location!.longitude,
            };
      const res = await createFoodOrder({
        restaurantId: r._id,
        items: [],
        prescriptionRequest: true,
        prescriptionUrls: photoUrls,
        prescriptionNote: note.trim() || undefined,
        delivery,
        fulfillmentType: fulfillment,
        paymentMethod,
        clientRequestId,
      });
      const orderId = res?.order?._id as string | undefined;
      if (orderId) router.replace(`/customer/stores/order/${orderId}` as const);
    } catch (err) {
      if (isNoResponseError(err)) Alert.alert("Connection lost", lostConnectionMessage("order"));
      // Other errors were already shown by createFoodOrder.
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={DS.color.text} />
        </TouchableOpacity>
        <CustomText fontFamily="SemiBold" fontSize={17} style={{ marginLeft: 12 }}>
          Send a prescription
        </CustomText>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <View key={s.text} style={styles.step}>
                <View style={styles.stepIcon}>
                  <Ionicons name={s.icon} size={20} color={ACCENT_DARK} />
                </View>
                <CustomText fontSize={11} color="#7f1d1d" style={styles.stepText}>
                  {i + 1}. {s.text}
                </CustomText>
              </View>
            ))}
          </View>

          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionTitle}>
            Your prescription
          </CustomText>
          <View style={styles.photoRow}>
            {photos.map((p) => (
              <View key={p.uri} style={styles.photoWrap}>
                <Image source={{ uri: p.uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setPhotos((prev) => prev.filter((x) => x.uri !== p.uri))}
                  hitSlop={8}
                  accessibilityLabel="Remove photo"
                >
                  <Ionicons name="close-circle" size={22} color="#111" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < MAX_PRESCRIPTION_PHOTOS ? (
              <TouchableOpacity
                style={[styles.addPhoto, photos.length === 0 && styles.addPhotoBig]}
                onPress={addPhoto}
                disabled={uploading}
                accessibilityRole="button"
              >
                {uploading ? (
                  <ActivityIndicator color={ACCENT} />
                ) : (
                  <>
                    <Ionicons name="camera" size={photos.length ? 22 : 30} color={ACCENT} />
                    <CustomText fontFamily="Medium" fontSize={photos.length ? 11 : 14} color={ACCENT} style={{ marginTop: 4 }}>
                      {photos.length ? "Add page" : "Take a photo of your prescription"}
                    </CustomText>
                    {photos.length ? null : (
                      <CustomText fontSize={11} color="#64748b" style={{ marginTop: 2 }}>
                        Clear and well lit, every page
                      </CustomText>
                    )}
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          <TextInput
            value={note}
            onChangeText={(t) => setNote(t.slice(0, 500))}
            placeholder={
              photos.length
                ? "Anything to add? e.g. I only need the first two"
                : "No prescription? Write what you need, e.g. Paracetamol 500mg, cough syrup for a child"
            }
            placeholderTextColor="#94a3b8"
            multiline
            style={styles.noteInput}
          />

          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionTitle}>
            Pharmacy
          </CustomText>
          {pharmacies === null ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: 16 }} />
          ) : sorted.length === 0 ? (
            <CustomText fontSize={13} color="#64748b">
              {loadError || "No pharmacies are available near you yet."}
            </CustomText>
          ) : (
            <View style={styles.list}>
              {visible.map(({ r, km }) => {
                const on = r._id === selectedId;
                const fee = km != null ? calculateFoodDeliveryFee(km, rates) : null;
                return (
                  <TouchableOpacity
                    key={r._id}
                    style={[styles.pharmacy, on && styles.pharmacyOn, !r.isOpen && styles.pharmacyClosed]}
                    onPress={() => (r.isOpen ? setChosenId(r._id) : Alert.alert(r.name, r.openLabel || "Closed right now"))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on, disabled: !r.isOpen }}
                  >
                    <Ionicons
                      name={on ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={on ? ACCENT : "#94a3b8"}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <CustomText fontFamily="Medium" fontSize={14} numberOfLines={1}>
                        {r.name}
                      </CustomText>
                      <CustomText fontSize={12} color="#64748b" numberOfLines={1}>
                        {r.isOpen
                          ? [km != null ? `${km.toFixed(1)} km` : null, fee != null ? `Delivery ${formatCurrency(fee)}` : null]
                              .filter(Boolean)
                              .join(" · ") || r.address || "Open"
                          : r.openLabel || "Closed"}
                      </CustomText>
                    </View>
                    {km != null && sorted[0]?.r._id === r._id && r.isOpen ? (
                      <View style={styles.nearest}>
                        <CustomText fontSize={10} fontFamily="SemiBold" color="#166534">
                          Nearest
                        </CustomText>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
              {sorted.length > SHOWN_PHARMACIES ? (
                <TouchableOpacity onPress={() => setShowAll((v) => !v)} style={styles.more}>
                  <CustomText fontFamily="Medium" fontSize={13} color={ACCENT_DARK}>
                    {showAll ? "Show fewer" : `Show all ${sorted.length} pharmacies`}
                  </CustomText>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionTitle}>
            How you get it
          </CustomText>
          {pickupAllowed ? (
            <View style={styles.segment}>
              {(["DELIVERY", "PICKUP"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.segmentBtn, fulfillment === m && styles.segmentOn]}
                  onPress={() => setMode(m)}
                >
                  <CustomText fontFamily="Medium" fontSize={13} color={fulfillment === m ? "#fff" : "#334155"}>
                    {m === "DELIVERY" ? "Deliver to me" : "I'll pick it up"}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {fulfillment === "DELIVERY" ? (
            <View style={styles.deliverBox}>
              <DeliverToBar accentColor={ACCENT} />
            </View>
          ) : (
            <CustomText fontSize={13} color="#475569">
              Collect from {selected?.r.name}
              {selected?.r.address ? `, ${selected.r.address}` : ""}.
            </CustomText>
          )}

          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionTitle}>
            Pay after you approve
          </CustomText>
          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.payBtn, paymentMethod === "CASH" && styles.payOn]}
              onPress={() => setPaymentMethod("CASH")}
            >
              <Ionicons name="cash-outline" size={18} color={paymentMethod === "CASH" ? ACCENT : "#64748b"} />
              <CustomText fontSize={13} style={{ marginLeft: 6 }}>
                Cash
              </CustomText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payBtn, paymentMethod === "MOBILE_MONEY" && styles.payOn]}
              onPress={() => (momoAvailable ? setPaymentMethod("MOBILE_MONEY") : openMomoComingSoon("pay"))}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={18}
                color={paymentMethod === "MOBILE_MONEY" ? ACCENT : "#64748b"}
              />
              <CustomText fontSize={13} style={{ marginLeft: 6 }}>
                MoMo
              </CustomText>
              {!momoAvailable ? <SoonTag /> : null}
            </TouchableOpacity>
          </View>
          <View style={styles.privacy}>
            <Ionicons name="lock-closed-outline" size={14} color="#64748b" />
            <CustomText fontSize={11} color="#64748b" style={{ marginLeft: 6, flex: 1 }}>
              Only the pharmacy sees your prescription. Riders see a sealed pharmacy order, not what&apos;s inside.
            </CustomText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <CustomText fontSize={12} color="#64748b" style={{ textAlign: "center", marginBottom: 8 }}>
          {!hasSomething
            ? "Add a photo, or write what you need"
            : selected && !selected.r.isOpen
            ? "Choose an open pharmacy"
            : fulfillment === "DELIVERY" && deliveryFee != null
            ? `Free to send. Medicines + ${formatCurrency(deliveryFee)} delivery, after you approve.`
            : "Free to send. You only pay after you approve the price."}
        </CustomText>
        <TouchableOpacity
          style={[styles.sendBtn, !ready && styles.sendDisabled]}
          disabled={!ready || sending}
          onPress={send}
          accessibilityRole="button"
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <CustomText fontFamily="SemiBold" fontSize={15} color="#fff">
              {online ? "Send to pharmacist" : "Waiting for connection…"}
            </CustomText>
          )}
        </TouchableOpacity>
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
  steps: {
    flexDirection: "row",
    backgroundColor: "#fef2f2",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  step: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { textAlign: "center", marginTop: 6, lineHeight: 14 },
  sectionTitle: { marginTop: 20, marginBottom: 10 },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoWrap: { position: "relative" },
  photo: { width: 90, height: 112, borderRadius: 10, backgroundColor: "#e2e8f0" },
  photoRemove: { position: "absolute", top: -8, right: -8, backgroundColor: "#fff", borderRadius: 11 },
  addPhoto: {
    width: 90,
    height: 112,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 6,
  },
  addPhotoBig: { width: "100%", height: 130 },
  noteInput: {
    marginTop: 12,
    minHeight: 64,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: "#0f172a",
    textAlignVertical: "top",
  },
  list: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden" },
  pharmacy: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  pharmacyOn: { backgroundColor: "#fef2f2" },
  pharmacyClosed: { opacity: 0.5 },
  nearest: { backgroundColor: "#dcfce7", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  more: { paddingVertical: 12, alignItems: "center" },
  segment: { flexDirection: "row", gap: 10, marginBottom: 10 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  segmentOn: { backgroundColor: ACCENT },
  deliverBox: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden" },
  payBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  payOn: { borderColor: ACCENT },
  privacy: { flexDirection: "row", alignItems: "flex-start", marginTop: 8 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  sendBtn: { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  sendDisabled: { opacity: 0.45 },
});
