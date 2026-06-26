import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Alert,
  Linking,
} from "react-native";
import React, { memo, useCallback, useMemo, useState, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import ParcelRecipientForm from "@/components/customer/ParcelRecipientForm";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { ParcelTheme as P } from "@/styles/parcelTheme";
import { pickParcelImage } from "@/utils/pickParcelImage";
import { uploadMediaUri } from "@/service/mediaUpload";
import { parseParcelMode, parcelModeLabels, type ParcelMode } from "@/utils/parcelMode";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";

const RideBooking = () => {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
    busyVehicles?: string | string[];
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
      busyVehicles: merged.busyVehicles,
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

  const busyVehicleSet = useMemo(() => {
    const raw = (item as { busyVehicles?: unknown })?.busyVehicles;
    const list = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? raw.split(",")
        : [];
    return new Set(
      list
        .map((v) => String(v).trim().toLowerCase())
        .filter(Boolean)
    );
  }, [item]);

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
      const eta = Math.max(1, Math.round(baseMinutes));
      return { baseMinutes, eta };
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
        detail: "Fast city option",
        capacity: 1,
        price: farePrices?.motorcycle,
        eta: etaByVehicle?.motorcycle.eta,
        icon: require("@/assets/icons/bike.png"),
      },
      {
        type: "Pragya" as const,
        vehicle: "pragya" as const,
        label: "Pragya",
        detail: "Balanced comfort",
        capacity: 3,
        price: farePrices?.pragya,
        eta: etaByVehicle?.pragya.eta,
        icon: require("@/assets/icons/auto.png"),
      },
      {
        type: "Comfort" as const,
        vehicle: "comfort" as const,
        label: "Car",
        detail: "Spacious ride",
        capacity: 4,
        price: farePrices?.comfort,
        eta: etaByVehicle?.comfort.eta,
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
        eta: etaByVehicle?.motorcycle.eta,
        icon: require("@/assets/icons/bike.png"),
      },
      {
        type: "Pragya" as const,
        vehicle: "pragya" as const,
        label: "Tricycle courier",
        detail: "Medium packages · up to ~15 kg",
        price: farePrices?.pragya,
        eta: etaByVehicle?.pragya.eta,
        icon: require("@/assets/icons/auto.png"),
      },
    ],
    [farePrices, etaByVehicle]
  );

  const displayOptions = serviceType === "DELIVERY" ? parcelOptions : rideOptions;

  const handleOptionSelect = useCallback((type: "Motorcycle" | "Pragya" | "Comfort") => {
    setSelectedOption(type);
  }, []);

  const openExternalRoute = useCallback(() => {
    if (!pickup || !drop) {
      Alert.alert("Route unavailable", "Pickup or destination is missing.");
      return;
    }
    const sLat = Number(pickup.latitude);
    const sLng = Number(pickup.longitude);
    const dLat = Number(drop.latitude);
    const dLng = Number(drop.longitude);
    const googleMapsUrl = Platform.select({
      ios: `comgooglemaps://?saddr=${sLat},${sLng}&daddr=${dLat},${dLng}&directionsmode=driving`,
      android: `google.navigation:q=${dLat},${dLng}`,
    });
    const appleMapsUrl = `maps://app?saddr=${sLat},${sLng}&daddr=${dLat},${dLng}&dirflg=d`;
    const webMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${sLat},${sLng}&destination=${dLat},${dLng}&travelmode=driving`;

    if (Platform.OS === "ios") {
      Linking.canOpenURL(googleMapsUrl || webMapsUrl)
        .then((ok) =>
          ok
            ? Linking.openURL(googleMapsUrl || webMapsUrl)
            : Linking.openURL(appleMapsUrl).catch(() => Linking.openURL(webMapsUrl))
        )
        .catch(() => Linking.openURL(webMapsUrl));
      return;
    }
    Linking.canOpenURL(googleMapsUrl || webMapsUrl)
      .then((ok) => Linking.openURL(ok ? (googleMapsUrl || webMapsUrl) : webMapsUrl))
      .catch(() => Linking.openURL(webMapsUrl));
  }, [pickup, drop]);

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

  const sheetSnapPoints = useMemo(() => {
    const low = Math.max(Math.round(windowHeight * 0.4), 320);
    const mid = Math.max(Math.round(windowHeight * 0.72), low + 120);
    const high = Math.max(Math.round(windowHeight * 0.9), mid + 80);
    return [low, mid, high];
  }, [windowHeight]);
  const collapsedSheetHeight = sheetSnapPoints[0];
  const isSmallScreen = windowHeight < 700;

  /** Inset map camera so pickup → drop fits in the strip above the bottom sheet */
  const routeMapPadding = useMemo(
    () => ({
      top: Platform.OS === "android" ? 86 : 94,
      right: 24,
      bottom: Math.round(collapsedSheetHeight) + 8,
      left: 24,
    }),
    [collapsedSheetHeight]
  );

  const openLocationEditor = useCallback(() => {
    const selectedVehicle = displayOptions.find((o) => o.type === selectedOption)?.vehicle;
    router.navigate({
      pathname: "/customer/selectlocations",
      params: {
        serviceType,
        ...(selectedVehicle ? { vehicle: selectedVehicle } : {}),
        ...(serviceType === "DELIVERY" ? { parcelMode } : {}),
      },
    });
  }, [displayOptions, selectedOption, serviceType, parcelMode]);

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

      <View
        style={[
          styles.topNav,
          { top: Math.max(insets.top + 8, Platform.OS === "android" ? 46 : 54) },
        ]}
      >
        <TouchableOpacity
          style={styles.navCircleBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back-ios" size={20} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.routeInlinePill} onPress={openLocationEditor} activeOpacity={0.85}>
          <CustomText fontFamily="SemiBold" fontSize={11} numberOfLines={1} style={styles.routeInlineText}>
            {pickupShort} → {dropShort}
          </CustomText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navCircleBtn}
          onPress={openExternalRoute}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <BottomSheet
        index={0}
        snapPoints={sheetSnapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        handleIndicatorStyle={styles.handle}
        style={styles.sheetContainer}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetScrollView
          contentContainerStyle={[styles.sheetContent, isSmallScreen && styles.sheetContentCompact]}
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
              <CustomText fontFamily="SemiBold" fontSize={14} style={styles.sectionTitle}>
                Compare your options
              </CustomText>
              {serviceType === "RIDE" && selectedOption === null ? (
                <CustomText fontSize={12} color="#888" style={{ marginTop: -6, marginBottom: 12 }}>
                  Tap one option to select.
                </CustomText>
              ) : null}
              {displayOptions.map((ride) => {
                const isSelected = selectedOption === ride.type;
                const isFastest = !isParcelFlow && fastestVehicle && ride.vehicle === fastestVehicle;
                const isBusy =
                  busyVehicleSet.has(String(ride.vehicle).toLowerCase()) ||
                  !Number.isFinite(Number(ride.price)) ||
                  Number(ride.price) <= 0;
                return (
                  <TouchableOpacity
                    key={ride.type}
                    onPress={() => {
                      if (!isBusy) handleOptionSelect(ride.type);
                    }}
                    style={[
                      styles.optionCard,
                      isBusy && styles.optionCardBusy,
                      isSelected && styles.optionCardSelected,
                      isSelected && serviceType === "DELIVERY" && styles.optionCardParcelSelected,
                    ]}
                    activeOpacity={isBusy ? 1 : 0.8}
                    disabled={isBusy}
                  >
                    <Image source={ride.icon} style={styles.optionIcon} />
                    <View style={styles.optionInfo}>
                      <CustomText fontFamily="SemiBold" fontSize={15}>
                        {ride.label}
                      </CustomText>
                      <View style={styles.optionMetaRow}>
                        {"capacity" in ride && typeof ride.capacity === "number" ? (
                          <View style={styles.capacityChip}>
                            <Ionicons name="people-outline" size={13} color="#64748b" />
                            <CustomText fontSize={11} fontFamily="SemiBold" style={styles.capacityText}>
                              {ride.capacity}
                            </CustomText>
                          </View>
                        ) : (
                          <CustomText fontSize={12} color="#888" numberOfLines={1}>
                            {ride.detail}
                          </CustomText>
                        )}
                        <View style={styles.timeChip}>
                          <Ionicons name="time-outline" size={13} color="#64748b" />
                          <CustomText fontSize={11} fontFamily="SemiBold" style={styles.timeText}>
                            {ride.eta != null ? `${ride.eta} min` : "-- min"}
                          </CustomText>
                        </View>
                        {isBusy ? (
                          <View style={styles.busyBadge}>
                            <CustomText fontFamily="SemiBold" fontSize={10} style={styles.busyBadgeText}>
                              Busy
                            </CustomText>
                          </View>
                        ) : null}
                      </View>
                      {isFastest ? (
                        <View style={styles.optionTagRow}>
                          <View style={styles.fastestBadgeInline}>
                            <CustomText fontFamily="SemiBold" fontSize={10} style={styles.fastestBadgeText}>
                              Fastest
                            </CustomText>
                          </View>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.optionRight}>
                      <CustomText fontFamily="Bold" fontSize={17} style={[styles.optionPrice, isBusy && styles.optionPriceBusy]}>
                        {isBusy ? "Busy" : formatCurrency(Math.round(Number(ride?.price ?? 0)))}
                      </CustomText>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={24} color={accentColor} style={styles.optionCheck} />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Payment */}
            <View style={styles.section}>
              <CustomText fontFamily="SemiBold" fontSize={14} style={styles.sectionTitle}>
                Payment
              </CustomText>
              <View style={[styles.paymentRow, isSmallScreen && styles.paymentRowCompact]}>
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
                  (serviceType === "DELIVERY" && (!recipientName.trim() || !recipientPhone.trim())) ||
                  !!(
                    selectedOption &&
                    busyVehicleSet.has(
                      String(displayOptions.find((o) => o.type === selectedOption)?.vehicle || "").toLowerCase()
                    )
                  )
                }
                loading={loading}
                onPress={handleRideBooking}
              />
            </View>
        </BottomSheetScrollView>
      </BottomSheet>
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
    top: Platform.OS === "android" ? 46 : 54,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  routeInlinePill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "rgba(255,255,255,0.96)",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  routeInlineText: {
    color: "#334155",
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
  sheetContainer: {
    zIndex: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetBackground: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },
  sheetContentCompact: {
    paddingHorizontal: 16,
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
    marginBottom: 22,
  },
  sectionTitle: {
    color: Colors.text,
    marginBottom: 14,
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
    minHeight: 86,
  },
  optionCardBusy: {
    opacity: 0.72,
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
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
  optionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
    marginBottom: 2,
  },
  optionTagRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  capacityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  capacityText: {
    color: "#475569",
  },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timeText: {
    color: "#475569",
  },
  optionRight: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 10,
  },
  optionPrice: {
    color: Colors.text,
    marginRight: 0,
  },
  optionPriceBusy: {
    color: "#64748b",
  },
  optionCheck: { marginTop: 4 },
  fastestBadgeInline: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  fastestBadgeText: {
    color: "#fff",
  },
  busyBadge: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  busyBadgeText: {
    color: "#475569",
  },
  paymentRow: {
    flexDirection: "row",
    gap: 14,
  },
  paymentRowCompact: {
    flexDirection: "column",
    gap: 10,
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
    marginBottom: 8,
  },
});

export default memo(RideBooking);
