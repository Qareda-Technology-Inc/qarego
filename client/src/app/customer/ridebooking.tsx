import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Alert,
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
import { openMapsRoute } from "@/utils/openMapsNavigation";
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
  const [sheetIndex, setSheetIndex] = useState(0);

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

  const getOptionMeta = useCallback(
    (ride: (typeof displayOptions)[number]) => {
      const parts: string[] = [];
      if ("capacity" in ride && typeof ride.capacity === "number") {
        parts.push(`${ride.capacity} seat${ride.capacity > 1 ? "s" : ""}`);
      } else if ("detail" in ride && ride.detail) {
        parts.push(ride.detail);
      }
      parts.push(ride.eta != null ? `${ride.eta} min` : "-- min");
      return parts.join("  ·  ");
    },
    []
  );

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

  const openExternalRoute = useCallback(() => {
    if (!pickup || !drop) {
      Alert.alert("Route unavailable", "Pickup or destination is missing.");
      return;
    }
    openMapsRoute(pickup, drop);
  }, [pickup, drop]);

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
    const low = Math.max(Math.round(windowHeight * 0.38), 300);
    const mid = Math.max(Math.round(windowHeight * 0.68), low + 100);
    const high = Math.max(Math.round(windowHeight * 0.88), mid + 60);
    return [low, mid, high];
  }, [windowHeight]);
  const activeSheetHeight =
    sheetSnapPoints[Math.min(Math.max(sheetIndex, 0), sheetSnapPoints.length - 1)] ??
    sheetSnapPoints[0];
  const isSmallScreen = windowHeight < 700;
  const distanceKm = parseFloat(item?.distanceInKm || "0");
  const distanceLabel = Number.isFinite(distanceKm) && distanceKm > 0
    ? `${distanceKm.toFixed(1)} km`
    : null;

  /**
   * Map view is sized to the strip *above* the sheet (explicit height).
   * Padding is only for top nav + labeled pins inside that strip.
   */
  const mapStripHeight = Math.max(windowHeight - activeSheetHeight, 220);
  const routeMapPadding = useMemo(
    () => ({
      top: Math.max(insets.top, 8) + 56,
      right: 40,
      bottom: 28,
      left: 40,
    }),
    [insets.top]
  );

  const mapPickup = useMemo(
    () =>
      pickup
        ? {
            latitude: pickup.latitude,
            longitude: pickup.longitude,
            address: pickup.address,
          }
        : null,
    [pickup]
  );
  const mapDrop = useMemo(
    () =>
      drop
        ? {
            latitude: drop.latitude,
            longitude: drop.longitude,
            address: drop.address,
          }
        : null,
    [drop]
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
      {mapPickup && mapDrop ? (
        <View style={[styles.mapLayer, { height: mapStripHeight }]}>
          <RoutesMap
            mapEdgePadding={routeMapPadding}
            drop={mapDrop}
            pickup={mapPickup}
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
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back-ios" size={20} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.routeInlinePill}
          onPress={openLocationEditor}
          activeOpacity={0.85}
        >
          <View style={styles.routeDots}>
            <View style={[styles.routeDot, styles.routeDotPickup]} />
            <View style={styles.routeDotLine} />
            <View style={[styles.routeDot, styles.routeDotDrop]} />
          </View>
          <View style={styles.routeInlineTextWrap}>
            <CustomText fontFamily="SemiBold" fontSize={12} numberOfLines={1} style={styles.routeInlineText}>
              {pickupShort}
            </CustomText>
            <CustomText fontSize={11} numberOfLines={1} style={styles.routeInlineDrop}>
              {dropShort}
            </CustomText>
          </View>
          <Ionicons name="pencil" size={14} color={T.inkSoft} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navCircleBtn}
          onPress={openExternalRoute}
          activeOpacity={0.8}
          accessibilityLabel="Open in Maps"
        >
          <Ionicons name="navigate-outline" size={20} color={Colors.text} />
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
        onChange={setSheetIndex}
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
            ) : (
              <View style={styles.rideSheetHeader}>
                <View>
                  <CustomText fontFamily="Bold" fontSize={22} style={styles.rideSheetTitle}>
                    Choose a ride
                  </CustomText>
                  <CustomText fontSize={13} style={styles.rideSheetSubtitle}>
                    {distanceLabel
                      ? `${distanceLabel} trip · tap an option below`
                      : "Tap an option to continue"}
                  </CustomText>
                </View>
                {distanceLabel ? (
                  <View style={styles.distanceChip}>
                    <Ionicons name="navigate" size={14} color={Colors.theme} />
                    <CustomText fontFamily="SemiBold" fontSize={12} style={styles.distanceChipText}>
                      {distanceLabel}
                    </CustomText>
                  </View>
                ) : null}
              </View>
            )}

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
              {isParcelFlow ? (
                <CustomText fontFamily="SemiBold" fontSize={14} style={styles.sectionTitle}>
                  Courier options
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
                    <View
                      style={[
                        styles.optionIconWrap,
                        isSelected && styles.optionIconWrapSelected,
                        isSelected && serviceType === "DELIVERY" && styles.optionIconWrapParcel,
                      ]}
                    >
                      <Image source={ride.icon} style={styles.optionIcon} />
                    </View>
                    <View style={styles.optionInfo}>
                      <View style={styles.optionTitleRow}>
                        <CustomText fontFamily="SemiBold" fontSize={15} numberOfLines={1}>
                          {ride.label}
                        </CustomText>
                        {isFastest && !isBusy ? (
                          <View style={styles.fastestBadgeInline}>
                            <CustomText fontFamily="SemiBold" fontSize={9} style={styles.fastestBadgeText}>
                              Fastest
                            </CustomText>
                          </View>
                        ) : null}
                      </View>
                      <CustomText fontSize={12} color="#94a3b8" numberOfLines={1} style={styles.optionMeta}>
                        {isBusy ? "Currently unavailable" : getOptionMeta(ride)}
                      </CustomText>
                    </View>
                    <View style={styles.optionRight}>
                      <CustomText
                        fontFamily="Bold"
                        fontSize={17}
                        style={[styles.optionPrice, isBusy && styles.optionPriceBusy]}
                      >
                        {isBusy ? "Busy" : formatCurrency(Math.round(Number(ride?.price ?? 0)))}
                      </CustomText>
                      {isSelected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={accentColor}
                          style={styles.optionCheck}
                        />
                      ) : (
                        <View style={styles.optionRadio} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.paymentSection}>
              <CustomText fontFamily="Medium" fontSize={12} style={styles.paymentLabel}>
                Pay with
              </CustomText>
              <View style={styles.paymentToggle}>
                <TouchableOpacity
                  onPress={() => setPaymentMethod("CASH")}
                  style={[
                    styles.paymentSeg,
                    paymentMethod === "CASH" && styles.paymentSegActive,
                    paymentMethod === "CASH" && serviceType === "DELIVERY" && styles.paymentSegParcelActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="cash-outline"
                    size={18}
                    color={paymentMethod === "CASH" ? accentColor : "#94a3b8"}
                  />
                  <CustomText
                    fontFamily="SemiBold"
                    fontSize={13}
                    style={{ color: paymentMethod === "CASH" ? Colors.text : "#94a3b8" }}
                  >
                    Cash
                  </CustomText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPaymentMethod("MOBILE_MONEY")}
                  style={[
                    styles.paymentSeg,
                    paymentMethod === "MOBILE_MONEY" && styles.paymentSegActive,
                    paymentMethod === "MOBILE_MONEY" &&
                      serviceType === "DELIVERY" &&
                      styles.paymentSegParcelActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={18}
                    color={paymentMethod === "MOBILE_MONEY" ? accentColor : "#94a3b8"}
                  />
                  <CustomText
                    fontFamily="SemiBold"
                    fontSize={13}
                    style={{
                      color: paymentMethod === "MOBILE_MONEY" ? Colors.text : "#94a3b8",
                    }}
                  >
                    MoMo
                  </CustomText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.ctaWrap}>
              {!pickup || !drop ? (
                <CustomText fontSize={14} color="#888" style={{ textAlign: "center", marginVertical: 8 }}>
                  Missing pickup or destination. Please go back and select locations.
                </CustomText>
              ) : null}
              <CustomButton
                title={
                  serviceType === "DELIVERY"
                    ? parcelLabels.confirmCta
                    : selectedOption
                      ? `Confirm ${selectedOption}`
                      : "Select a ride"
                }
                disabled={
                  loading ||
                  uploadingPhoto ||
                  !pickup ||
                  !drop ||
                  (serviceType === "RIDE" && selectedOption === null) ||
                  (serviceType === "DELIVERY" &&
                    (!recipientName.trim() || !recipientPhone.trim())) ||
                  !!(
                    selectedOption &&
                    busyVehicleSet.has(
                      String(
                        displayOptions.find((o) => o.type === selectedOption)?.vehicle || ""
                      ).toLowerCase()
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
    backgroundColor: "#F4F7FB",
  },
  mapLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
    overflow: "hidden",
    backgroundColor: "#E8EEF5",
  },
  topNav: {
    position: "absolute",
    top: Platform.OS === "android" ? 46 : 54,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  routeInlinePill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    backgroundColor: "rgba(255,255,255,0.97)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    ...T.shadow.card,
  },
  routeDots: {
    alignItems: "center",
    width: 10,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeDotPickup: {
    backgroundColor: "#22c55e",
  },
  routeDotDrop: {
    backgroundColor: "#ef4444",
  },
  routeDotLine: {
    width: 2,
    height: 8,
    backgroundColor: "#e2e8f0",
    marginVertical: 2,
    borderRadius: 1,
  },
  routeInlineTextWrap: {
    flex: 1,
  },
  routeInlineText: {
    color: "#0F172A",
  },
  routeInlineDrop: {
    color: "#64748B",
    marginTop: 1,
  },
  navCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...T.shadow.card,
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
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },
  sheetContentCompact: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
  },
  rideSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  rideSheetTitle: {
    color: T.ink,
    letterSpacing: -0.3,
  },
  rideSheetSubtitle: {
    color: T.inkMuted,
    marginTop: 4,
  },
  distanceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ffedd5",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  distanceChipText: {
    color: Colors.theme,
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
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.text,
    marginBottom: 10,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    minHeight: 72,
  },
  optionCardBusy: {
    opacity: 0.65,
    backgroundColor: "#F1F5F9",
  },
  optionCardSelected: {
    backgroundColor: "#fffef5",
    borderColor: Colors.primary,
  },
  optionCardParcelSelected: {
    backgroundColor: P.accentSoft,
    borderColor: P.accent,
  },
  optionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  optionIconWrapSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#fef9c3",
  },
  optionIconWrapParcel: {
    borderColor: P.accent,
    backgroundColor: "#fff",
  },
  optionIcon: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },
  optionInfo: { flex: 1 },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionMeta: {
    marginTop: 3,
  },
  optionRight: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 8,
    minWidth: 72,
  },
  optionPrice: {
    color: Colors.text,
  },
  optionPriceBusy: {
    color: "#94a3b8",
    fontSize: 13,
  },
  optionCheck: { marginTop: 4 },
  optionRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    marginTop: 5,
  },
  fastestBadgeInline: {
    backgroundColor: Colors.theme,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  fastestBadgeText: {
    color: "#fff",
  },
  paymentSection: {
    marginBottom: 14,
  },
  paymentLabel: {
    color: T.inkMuted,
    marginBottom: 8,
  },
  paymentToggle: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  paymentSeg: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  paymentSegActive: {
    backgroundColor: "#fff",
    borderColor: Colors.primary,
  },
  paymentSegParcelActive: {
    backgroundColor: "#fff",
    borderColor: P.accent,
  },
  ctaWrap: {
    marginTop: 4,
    marginBottom: 8,
  },
});

export default memo(RideBooking);
