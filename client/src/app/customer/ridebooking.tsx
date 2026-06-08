import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from "react-native";
import React, { memo, useCallback, useMemo, useState, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { useRoute } from "@react-navigation/native";
import { useUserStore } from "@/store/userStore";
import { StatusBar } from "expo-status-bar";
import { calculateFare, type FareRateStructure } from "@/utils/mapUtils";
import { fetchRideFareRates } from "@/service/rideService";
import RoutesMap from "@/components/customer/RoutesMap";
import CustomText from "@/components/shared/CustomText";
import { router } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CustomButton from "@/components/shared/CustomButton";
import { createRide } from "@/service/rideService";
import { formatCurrency, Colors } from "@/utils/Constants";
import CustomerLogoutButton from "@/components/customer/CustomerLogoutButton";
import ParcelRecipientForm from "@/components/customer/ParcelRecipientForm";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { ParcelTheme as P } from "@/styles/parcelTheme";
import { pickParcelImage } from "@/utils/pickParcelImage";
import { uploadMediaUri } from "@/service/mediaUpload";
import { parseParcelMode, parcelModeLabels, type ParcelMode } from "@/utils/parcelMode";

const RideBooking = () => {
  const { height: windowHeight } = useWindowDimensions();
  const route = useRoute() as any;
  const localParams = useLocalSearchParams<{
    serviceType?: string;
    vehicle?: string;
    distanceInKm?: string;
    pickup_latitude?: string;
    pickup_longitude?: string;
    pickup_address?: string;
    drop_latitude?: string;
    drop_longitude?: string;
    drop_address?: string;
    parcelMode?: string;
  }>();
  // Params can come from route.state (navigate params) or URL (useLocalSearchParams)
  const item = useMemo(() => {
    const fromRoute = route?.params ?? {};
    const fromLocal = localParams ?? {};
    const merged = { ...fromRoute, ...fromLocal };
    // Normalize: Expo Router can give arrays for query params
    const str = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;
    return {
      ...merged,
      serviceType: str(merged.serviceType) ?? merged.serviceType,
      vehicle: str(merged.vehicle) ?? merged.vehicle,
      distanceInKm: str(merged.distanceInKm) ?? merged.distanceInKm,
      pickup_latitude: str(merged.pickup_latitude) ?? merged.pickup_latitude,
      pickup_longitude: str(merged.pickup_longitude) ?? merged.pickup_longitude,
      pickup_address: str(merged.pickup_address) ?? merged.pickup_address,
      drop_latitude: str(merged.drop_latitude) ?? merged.drop_latitude,
      drop_longitude: str(merged.drop_longitude) ?? merged.drop_longitude,
      drop_address: str(merged.drop_address) ?? merged.drop_address,
      parcelMode: str(merged.parcelMode) ?? merged.parcelMode,
    };
  }, [route?.params, localParams]);
  const { location: storeLocation, user } = useUserStore() as any;
  const isParcelFlow = item?.serviceType === "DELIVERY";
  const parcelMode: ParcelMode = isParcelFlow ? parseParcelMode(item?.parcelMode) : "SEND";
  const parcelLabels = parcelModeLabels(parcelMode);
  const [serviceType, setServiceType] = useState<"RIDE" | "DELIVERY">(
    isParcelFlow ? "DELIVERY" : "RIDE"
  );

  // Keep serviceType in sync with params when they load (e.g. from parcel flow)
  useEffect(() => {
    if (item?.serviceType === "DELIVERY") setServiceType("DELIVERY");
    else if (item?.serviceType === "RIDE") setServiceType("RIDE");
  }, [item?.serviceType]);

  const [selectedOption, setSelectedOption] = useState<"Motorcycle" | "Pragya" | "Comfort" | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "MOBILE_MONEY">("CASH");
  const [loading, setLoading] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [parcelDescription, setParcelDescription] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [parcelPhotoUri, setParcelPhotoUri] = useState<string | null>(null);
  const [parcelPhotoUrl, setParcelPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [fareRates, setFareRates] = useState<FareRateStructure | null>(null);

  useEffect(() => {
    if (!isParcelFlow || parcelMode !== "RECEIVE") return;
    if (!recipientName && user?.name) setRecipientName(user.name);
    if (!recipientPhone && user?.phone) setRecipientPhone(user.phone);
  }, [isParcelFlow, parcelMode, user?.name, user?.phone]);

  useEffect(() => {
    let cancelled = false;
    fetchRideFareRates()
      .then((rates) => {
        if (!cancelled) setFareRates(rates);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const farePrices = useMemo(
    () => calculateFare(parseFloat(item?.distanceInKm || "0"), fareRates),
    [item?.distanceInKm, fareRates]
  );

  const etaByVehicle = useMemo(() => {
    const distanceKm = parseFloat(item?.distanceInKm || "0");
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;

    // Assumed average speeds (km/h) to create a hybrid ETA range.
    // You can tune these later or swap to Google Distance Matrix if desired.
    const speedsKmh: Record<"motorcycle" | "pragya" | "comfort", number> = {
      motorcycle: 30,
      pragya: 22,
      comfort: 18,
    };

    const calc = (vehicle: "motorcycle" | "pragya" | "comfort") => {
      const baseMinutes = (distanceKm / speedsKmh[vehicle]) * 60;
      const low = Math.max(1, Math.round(baseMinutes * 0.9));
      const high = Math.max(low, Math.round(baseMinutes * 1.1));
      return { baseMinutes, low, high };
    };

    return {
      motorcycle: calc("motorcycle"),
      pragya: calc("pragya"),
      comfort: calc("comfort"),
    };
  }, [item?.distanceInKm]);

  const fastestVehicle = useMemo(() => {
    if (!etaByVehicle) return null;
    const entries = [
      { vehicle: "motorcycle" as const, base: etaByVehicle.motorcycle.baseMinutes },
      { vehicle: "pragya" as const, base: etaByVehicle.pragya.baseMinutes },
      { vehicle: "comfort" as const, base: etaByVehicle.comfort.baseMinutes },
    ];
    return entries.sort((a, b) => a.base - b.base)[0]?.vehicle ?? null;
  }, [etaByVehicle]);

  // Reset selection when switching between Ride/Delivery:
  // - Ride: compare-first (no preselection)
  // - Delivery: keep default vehicle selection
  useEffect(() => {
    if (serviceType === "DELIVERY") {
      const next = item?.vehicle === "pragya" ? "Pragya" : "Motorcycle";
      setSelectedOption(next);
    } else {
      setSelectedOption(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType]);

  const rideOptions = useMemo(
    () => [
      {
        type: "Motorcycle" as const,
        vehicle: "motorcycle" as const,
        label: "Motorcycle",
        detail: "1 seat",
        price: farePrices?.motorcycle,
        etaLow: etaByVehicle?.motorcycle.low,
        etaHigh: etaByVehicle?.motorcycle.high,
        icon: require("@/assets/icons/bike.png"),
      },
      {
        type: "Pragya" as const,
        vehicle: "pragya" as const,
        label: "Pragya",
        detail: "3 seats",
        price: farePrices?.pragya,
        etaLow: etaByVehicle?.pragya.low,
        etaHigh: etaByVehicle?.pragya.high,
        icon: require("@/assets/icons/auto.png"),
      },
      {
        type: "Comfort" as const,
        vehicle: "comfort" as const,
        label: "Car",
        detail: "4 seats",
        price: farePrices?.comfort,
        etaLow: etaByVehicle?.comfort.low,
        etaHigh: etaByVehicle?.comfort.high,
        icon: require("@/assets/icons/cab.png"),
      },
    ],
    [farePrices, etaByVehicle]
  );

  const parcelOptions = useMemo(
    () => [
      {
        type: "Motorcycle" as const,
        vehicle: "motorcycle" as const,
        label: "Motorbike courier",
        detail: "Small packages · up to ~5 kg",
        price: farePrices?.motorcycle,
        etaLow: etaByVehicle?.motorcycle.low,
        etaHigh: etaByVehicle?.motorcycle.high,
        icon: require("@/assets/icons/bike.png"),
      },
      {
        type: "Pragya" as const,
        vehicle: "pragya" as const,
        label: "Tricycle courier",
        detail: "Medium packages · up to ~15 kg",
        price: farePrices?.pragya,
        etaLow: etaByVehicle?.pragya.low,
        etaHigh: etaByVehicle?.pragya.high,
        icon: require("@/assets/icons/auto.png"),
      },
    ],
    [farePrices, etaByVehicle]
  );

  const displayOptions = serviceType === "DELIVERY" ? parcelOptions : rideOptions;

  const handleOptionSelect = useCallback((type: "Motorcycle" | "Pragya" | "Comfort") => {
    setSelectedOption(type);
  }, []);

  const handlePickParcelPhoto = useCallback(async () => {
    const uri = await pickParcelImage();
    if (!uri) return;
    setParcelPhotoUri(uri);
    setUploadingPhoto(true);
    try {
      const { url } = await uploadMediaUri(uri, "parcels");
      setParcelPhotoUrl(url);
    } catch {
      setParcelPhotoUri(null);
      setParcelPhotoUrl(null);
    } finally {
      setUploadingPhoto(false);
    }
  }, []);

  const handleRemoveParcelPhoto = useCallback(() => {
    setParcelPhotoUri(null);
    setParcelPhotoUrl(null);
  }, []);

  const getVehicleFromOption = (): "motorcycle" | "pragya" | "comfort" | null => {
    if (!selectedOption) return null;
    const opt = displayOptions.find((o) => o.type === selectedOption);
    return opt?.vehicle ?? null;
  };

  // Prefer pickup from route params (from selectlocations), fallback to store
  const pickup = useMemo(() => {
    const lat = item?.pickup_latitude ?? storeLocation?.latitude;
    const lon = item?.pickup_longitude ?? storeLocation?.longitude;
    const addr = item?.pickup_address ?? storeLocation?.address;
    if (lat != null && lon != null) return { latitude: Number(lat), longitude: Number(lon), address: addr ?? "" };
    return null;
  }, [item?.pickup_latitude, item?.pickup_longitude, item?.pickup_address, storeLocation?.latitude, storeLocation?.longitude, storeLocation?.address]);

  const drop = useMemo(() => {
    if (item?.drop_latitude != null && item?.drop_longitude != null) {
      return {
        latitude: parseFloat(String(item.drop_latitude)),
        longitude: parseFloat(String(item.drop_longitude)),
        address: item?.drop_address ?? "",
      };
    }
    return null;
  }, [item?.drop_latitude, item?.drop_longitude, item?.drop_address]);

  const handleRideBooking = async () => {
    if (!pickup || !drop) {
      return;
    }
    if (serviceType === "RIDE" && !selectedOption) {
      return;
    }
    if (serviceType === "DELIVERY" && (!recipientName.trim() || !recipientPhone.trim())) {
      return;
    }
    setLoading(true);
    const vehicle = getVehicleFromOption();
    if (!vehicle) {
      setLoading(false);
      return;
    }
    const payload: Parameters<typeof createRide>[0] = {
      serviceType,
      vehicle,
      paymentMethod,
      drop: {
        latitude: drop.latitude,
        longitude: drop.longitude,
        address: drop.address,
      },
      pickup: {
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        address: pickup.address,
      },
    };
    if (serviceType === "DELIVERY") {
      payload.parcelMode = parcelMode;
      payload.recipientName = recipientName.trim();
      payload.recipientPhone = recipientPhone.trim();
      if (parcelDescription.trim()) payload.parcelDescription = parcelDescription.trim();
      if (deliveryNote.trim()) payload.deliveryNote = deliveryNote.trim();
      if (parcelPhotoUrl) payload.parcelPhotoUrl = parcelPhotoUrl;
    }
    await createRide(payload);
    setLoading(false);
  };

  const pickupShort = pickup?.address
    ? pickup.address.length > 40
      ? `${pickup.address.slice(0, 40)}…`
      : pickup.address
    : "Your location";
  const dropShort = drop?.address
    ? drop.address.length > 40
      ? `${drop.address.slice(0, 40)}…`
      : drop.address
    : isParcelFlow
      ? parcelLabels.routeDrop
      : "Destination";
  const accentColor = serviceType === "DELIVERY" ? P.accent : Colors.primary;

  const sheetHeight = Math.max(windowHeight * 0.56, 380);
  const isSmallScreen = windowHeight < 700;

  /** Inset map camera so pickup → drop fits in the strip above the bottom sheet */
  const routeMapPadding = useMemo(
    () => ({
      top: Platform.OS === "android" ? 100 : 108,
      right: 20,
      bottom: Math.round(sheetHeight) + 36,
      left: 20,
    }),
    [sheetHeight]
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="transparent" translucent />
      {pickup && drop ? (
        <View style={styles.mapLayer} pointerEvents="box-none">
          <RoutesMap
            mapEdgePadding={routeMapPadding}
            drop={{
              latitude: drop.latitude,
              longitude: drop.longitude,
              address: drop.address,
            }}
            pickup={{
              latitude: pickup.latitude,
              longitude: pickup.longitude,
              address: pickup.address,
            }}
          />
        </View>
      ) : null}

      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.navCircleBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back-ios" size={20} color={Colors.text} />
        </TouchableOpacity>
        {serviceType === "DELIVERY" ? (
          <CustomerLogoutButton style={styles.navCircleBtn} size={20} />
        ) : null}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.sheetWrapper, { height: sheetHeight }]}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={[styles.sheet, isSmallScreen && styles.sheetCompact]}>
          <View style={styles.handle} />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {isParcelFlow ? (
              <View style={styles.parcelSheetHeader}>
                <View style={styles.parcelSheetIcon}>
                  <Ionicons name="cube" size={20} color={P.accent} />
                </View>
                <View style={styles.parcelSheetHeadText}>
                  <CustomText fontFamily="Bold" fontSize={20} style={{ color: T.ink }}>
                    {parcelLabels.bookingTitle}
                  </CustomText>
                  <CustomText fontSize={13} style={{ color: T.inkMuted, marginTop: 2 }}>
                    {parcelLabels.bookingSubtitle}
                  </CustomText>
                </View>
              </View>
            ) : null}

            <View style={[styles.routeCard, isParcelFlow && styles.routeCardParcel]}>
              <View style={styles.routeRow}>
                <View style={[styles.dot, styles.dotGreen]} />
                <View style={styles.routeLabelWrap}>
                  <CustomText fontSize={11} fontFamily="Medium" style={styles.routeLabel}>
                    {isParcelFlow ? parcelLabels.routePickup : "Pickup"}
                  </CustomText>
                  <CustomText fontSize={14} numberOfLines={2} style={styles.routeText}>
                    {pickupShort}
                  </CustomText>
                </View>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={[styles.dot, isParcelFlow ? styles.dotParcel : styles.dotRed]} />
                <View style={styles.routeLabelWrap}>
                  <CustomText fontSize={11} fontFamily="Medium" style={styles.routeLabel}>
                    {isParcelFlow ? parcelLabels.routeDrop : "Destination"}
                  </CustomText>
                  <CustomText fontSize={14} numberOfLines={2} style={styles.routeText}>
                    {dropShort}
                  </CustomText>
                </View>
              </View>
            </View>

            {!isParcelFlow ? (
              <View style={styles.section}>
                <View style={styles.segmentedRow}>
                  <TouchableOpacity
                    onPress={() => setServiceType("RIDE")}
                    style={[styles.segment, serviceType === "RIDE" && styles.segmentActive]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="car-outline" size={20} color={serviceType === "RIDE" ? Colors.text : "#888"} />
                    <CustomText fontFamily="SemiBold" fontSize={14} style={{ color: serviceType === "RIDE" ? Colors.text : "#888" }}>
                      Ride
                    </CustomText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setServiceType("DELIVERY")}
                    style={[styles.segment, serviceType === "DELIVERY" && styles.segmentActive]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="cube-outline" size={20} color={serviceType === "DELIVERY" ? Colors.text : "#888"} />
                    <CustomText fontFamily="SemiBold" fontSize={14} style={{ color: serviceType === "DELIVERY" ? Colors.text : "#888" }}>
                      Parcel
                    </CustomText>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {serviceType === "DELIVERY" ? (
              <ParcelRecipientForm
                mode={parcelMode}
                recipientName={recipientName}
                recipientPhone={recipientPhone}
                parcelDescription={parcelDescription}
                deliveryNote={deliveryNote}
                parcelPhotoUri={parcelPhotoUri}
                parcelPhotoUrl={parcelPhotoUrl}
                uploadingPhoto={uploadingPhoto}
                onChangeName={setRecipientName}
                onChangePhone={setRecipientPhone}
                onChangeDescription={setParcelDescription}
                onChangeNote={setDeliveryNote}
                onPickPhoto={handlePickParcelPhoto}
                onRemovePhoto={handleRemoveParcelPhoto}
              />
            ) : null}

            <View style={styles.section}>
              <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionTitle}>
                {serviceType === "DELIVERY" ? "Choose courier" : "Compare your options"}
              </CustomText>
              {serviceType === "RIDE" && selectedOption === null ? (
                <CustomText fontSize={12} color="#888" style={{ marginTop: -6, marginBottom: 12 }}>
                  Tap one option to select.
                </CustomText>
              ) : null}
              {displayOptions.map((ride) => {
                const isSelected = selectedOption === ride.type;
                const isFastest = !isParcelFlow && fastestVehicle && ride.vehicle === fastestVehicle;
                return (
                  <TouchableOpacity
                    key={ride.type}
                    onPress={() => handleOptionSelect(ride.type)}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                      isSelected && serviceType === "DELIVERY" && styles.optionCardParcelSelected,
                    ]}
                    activeOpacity={0.8}
                  >
                    {isFastest ? (
                      <View style={styles.fastestBadge}>
                        <CustomText fontFamily="SemiBold" fontSize={11} style={styles.fastestBadgeText}>
                          Fastest
                        </CustomText>
                      </View>
                    ) : null}
                    <Image source={ride.icon} style={styles.optionIcon} />
                    <View style={styles.optionInfo}>
                      <CustomText fontFamily="SemiBold" fontSize={16}>
                        {ride.label}
                      </CustomText>
                      <CustomText fontSize={13} color="#888">
                        {ride.detail} · ETA{" "}
                        {ride.etaLow != null && ride.etaHigh != null ? `${ride.etaLow}–${ride.etaHigh}` : "--"}{" "}
                        min
                      </CustomText>
                    </View>
                    <CustomText fontFamily="Bold" fontSize={18} style={styles.optionPrice}>
                      {formatCurrency(ride?.price)}
                    </CustomText>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={26} color={accentColor} style={styles.optionCheck} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Payment */}
            <View style={styles.section}>
              <CustomText fontFamily="SemiBold" fontSize={15} style={styles.sectionTitle}>
                Payment
              </CustomText>
              <View style={styles.paymentRow}>
                <TouchableOpacity
                  onPress={() => setPaymentMethod("CASH")}
                  style={[
                    styles.paymentOption,
                    paymentMethod === "CASH" && styles.paymentOptionActive,
                    paymentMethod === "CASH" && serviceType === "DELIVERY" && styles.paymentOptionParcelActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cash-outline" size={24} color={paymentMethod === "CASH" ? accentColor : "#666"} />
                  <CustomText fontFamily="Medium" fontSize={14} style={{ color: paymentMethod === "CASH" ? Colors.text : "#666" }}>
                    Cash
                  </CustomText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPaymentMethod("MOBILE_MONEY")}
                  style={[
                    styles.paymentOption,
                    paymentMethod === "MOBILE_MONEY" && styles.paymentOptionActive,
                    paymentMethod === "MOBILE_MONEY" && serviceType === "DELIVERY" && styles.paymentOptionParcelActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="phone-portrait-outline" size={24} color={paymentMethod === "MOBILE_MONEY" ? accentColor : "#666"} />
                  <CustomText fontFamily="Medium" fontSize={14} style={{ color: paymentMethod === "MOBILE_MONEY" ? Colors.text : "#666" }}>
                    Mobile Money
                  </CustomText>
                </TouchableOpacity>
              </View>
            </View>

            {/* CTA */}
            <View style={styles.ctaWrap}>
              {!pickup || !drop ? (
                <CustomText fontSize={14} color="#888" style={{ textAlign: "center", marginVertical: 8 }}>
                  Missing pickup or destination. Please go back and select locations.
                </CustomText>
              ) : null}
              <CustomButton
                title={serviceType === "DELIVERY" ? parcelLabels.confirmCta : "Confirm ride"}
                disabled={
                  loading ||
                  uploadingPhoto ||
                  !pickup ||
                  !drop ||
                  (serviceType === "RIDE" && selectedOption === null) ||
                  (serviceType === "DELIVERY" && (!recipientName.trim() || !recipientPhone.trim()))
                }
                loading={loading}
                onPress={handleRideBooking}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  topNav: {
    position: "absolute",
    top: Platform.OS === "android" ? 48 : 56,
    left: 16,
    flexDirection: "row",
    gap: 10,
    zIndex: 10,
  },
  navCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  sheetWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetCompact: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e0e0e0",
    alignSelf: "center",
    marginBottom: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  parcelSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 18,
  },
  parcelSheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: P.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  parcelSheetHeadText: {
    flex: 1,
  },
  routeCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
  },
  routeCardParcel: {
    backgroundColor: P.accentSoft,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  routeLabelWrap: {
    flex: 1,
  },
  routeLabel: {
    color: T.inkMuted,
    marginBottom: 2,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 14,
  },
  dotGreen: { backgroundColor: "#22c55e" },
  dotRed: { backgroundColor: "#ef4444" },
  dotParcel: { backgroundColor: P.accent },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: "#e5e7eb",
    marginLeft: 5,
    marginVertical: 8,
  },
  routeText: {
    flex: 1,
    color: Colors.text,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: Colors.text,
    marginBottom: 14,
  },
  segmentedRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
    padding: 5,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
  },
  segmentActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
  },
  inputLast: { marginBottom: 0 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative",
  },
  optionCardSelected: {
    backgroundColor: "#fefce8",
    borderColor: Colors.primary,
  },
  optionCardParcelSelected: {
    backgroundColor: P.accentSoft,
    borderColor: P.accent,
  },
  optionIcon: {
    width: 48,
    height: 48,
    resizeMode: "contain",
    marginRight: 16,
  },
  optionInfo: { flex: 1 },
  optionPrice: {
    color: Colors.text,
    marginRight: 10,
  },
  optionCheck: { marginLeft: 4 },
  fastestBadge: {
    position: "absolute",
    right: 14,
    top: 10,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    zIndex: 2,
  },
  fastestBadgeText: {
    color: "#fff",
  },
  paymentRow: {
    flexDirection: "row",
    gap: 14,
  },
  paymentOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: "#f8f9fa",
    borderWidth: 2,
    borderColor: "transparent",
  },
  paymentOptionActive: {
    backgroundColor: "#fefce8",
    borderColor: Colors.primary,
  },
  paymentOptionParcelActive: {
    backgroundColor: P.accentSoft,
    borderColor: P.accent,
  },
  ctaWrap: {
    marginTop: 12,
  },
});

export default memo(RideBooking);
