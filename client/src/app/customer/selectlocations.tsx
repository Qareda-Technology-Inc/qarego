import {
  View,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useUserStore } from "@/store/userStore";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import RouteLocationCard from "@/components/customer/RouteLocationCard";
import {
  calculateDistance,
  getLatLong,
  getPlacesSuggestions,
  reverseGeocode,
} from "@/utils/mapUtils";
import { getCurrentLocationAsync } from "@/utils/locationUtils";
import LocationItem from "@/components/customer/LocationItem";
import MapPickerModal from "@/components/customer/MapPickerModal";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { Colors } from "@/utils/Constants";
import { parseParcelMode, parcelModeLabels, type ParcelMode } from "@/utils/parcelMode";
import ParcelPointList from "@/components/customer/ParcelPointList";
import {
  fetchParcelPoints,
  parcelPointAddress,
  type ParcelPoint,
} from "@/service/parcelPointService";
import { ParcelTheme as P } from "@/styles/parcelTheme";
import { useRecentPlacesStore, type RecentPlace } from "@/store/recentPlacesStore";

const CURRENT_LOCATION_LABEL = "Current location";

const LocationSelection = () => {
  const { location, setLocation } = useUserStore();
  const params = useLocalSearchParams<{
    vehicle?: string;
    serviceType?: string;
    foodCheckout?: string;
    parcelMode?: string;
  }>();
  const vehicle = params?.vehicle;
  const serviceType = params?.serviceType ?? "RIDE";
  const isFoodDelivery = serviceType === "FOOD" || params?.foodCheckout === "1";
  const isParcel = serviceType === "DELIVERY";
  const parcelMode: ParcelMode = isParcel ? parseParcelMode(params?.parcelMode) : "SEND";
  const parcelLabels = parcelModeLabels(parcelMode);

  const [pickup, setPickup] = useState("");
  const [pickupCoords, setPickupCoords] = useState<any>(null);
  const [dropCoords, setDropCoords] = useState<any>(null);
  const [drop, setDrop] = useState("");
  const [locations, setLocations] = useState<any[]>([]);
  const [focusedInput, setFocusedInput] = useState<"pickup" | "drop">(
    isParcel && parcelMode === "RECEIVE" ? "pickup" : "drop"
  );
  const [modalTitle, setModalTitle] = useState<"pickup" | "drop">("drop");
  const [isMapModalVisible, setMapModalVisible] = useState(false);
  const [searching, setSearching] = useState(false);
  const hasAutoNavigated = useRef(false);
  // Admin-added parcel points, and what the customer is typing (to filter them).
  const [parcelPoints, setParcelPoints] = useState<ParcelPoint[]>([]);
  const [typedQuery, setTypedQuery] = useState("");
  // When receiving a parcel the pickup is someone else's place, so it must not
  // replace the customer's own saved location (which is the drop-off).
  const pickupIsMyLocation = !(isParcel && parcelMode === "RECEIVE");
  const accent = isParcel ? P.accent : Colors.theme;
  // The parcel point chosen for each field (so the list can tick it and show where to meet).
  const [pointIds, setPointIds] = useState<{ pickup: string | null; drop: string | null }>({ pickup: null, drop: null });
  const recentPlaces = useRecentPlacesStore((st) => st.places);
  const addRecent = useRecentPlacesStore((st) => st.add);
  const [locating, setLocating] = useState(false);

  const headerTitle = isFoodDelivery
    ? "Delivery address"
    : isParcel
      ? parcelLabels.title
      : "Where to?";

  const headerSubtitle = isFoodDelivery
    ? "Where should we bring your order?"
    : isParcel
      ? parcelLabels.subtitle
      : "Search or pin your destination";

  const dropPlaceholder = isFoodDelivery
    ? "Street, area, or landmark"
    : isParcel
      ? parcelLabels.dropPlaceholder
      : "Enter destination";

  const fetchLocation = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setLocations([]);
      return;
    }
    setSearching(true);
    try {
      const data = await getPlacesSuggestions(query);
      setLocations(data || []);
    } finally {
      setSearching(false);
    }
  }, []);

  const addLocation = useCallback(
    async (item: { place_id: string; title?: string; description?: string }) => {
      try {
        const data = await getLatLong(item.place_id, {
          title: item.title,
          description: item.description,
        });
        if (data) {
          addRecent(data);
          setPointIds((ids) => ({ ...ids, [focusedInput]: null }));
          if (focusedInput === "drop") {
            setDrop(data?.address ?? "");
            setDropCoords(data);
            if (isFoodDelivery) {
              setLocation({
                latitude: data.latitude,
                longitude: data.longitude,
                address: data.address ?? "",
              });
              setLocations([]);
              setMapModalVisible(false);
              if (router.canGoBack()) router.back();
              else router.replace("/customer/stores/checkout");
              return;
            }
          } else {
            if (pickupIsMyLocation) setLocation(data);
            setPickupCoords(data);
            setPickup(data?.address ?? "");
          }
          setLocations([]);
          setTypedQuery("");
        }
      } catch {
        Alert.alert("Error", "Could not get location details.");
      }
    },
    [focusedInput, setLocation, isFoodDelivery, pickupIsMyLocation, addRecent]
  );

  const pickParcelPoint = useCallback(
    (point: ParcelPoint) => {
      const data = {
        latitude: point.latitude,
        longitude: point.longitude,
        address: parcelPointAddress(point),
      };
      // Stay on this screen so the customer sees the meeting spot; they tap Continue.
      hasAutoNavigated.current = true;
      setPointIds((ids) => ({ ...ids, [focusedInput]: point._id }));
      if (focusedInput === "drop") {
        setDropCoords(data);
        setDrop(data.address);
      } else {
        setPickupCoords(data);
        setPickup(data.address);
      }
      setLocations([]);
      setTypedQuery("");
    },
    [focusedInput]
  );

  /** Fill the field being edited with a saved place (a recent one, or where the phone is). */
  const applySavedPlace = useCallback(
    (place: { latitude: number; longitude: number; address: string }) => {
      setPointIds((ids) => ({ ...ids, [focusedInput]: null }));
      setLocations([]);
      setTypedQuery("");
      if (focusedInput === "drop") {
        setDrop(place.address);
        setDropCoords(place);
        if (isFoodDelivery) {
          setLocation(place);
          if (router.canGoBack()) router.back();
          else router.replace("/customer/stores/checkout");
        }
      } else {
        if (pickupIsMyLocation) setLocation(place);
        setPickupCoords(place);
        setPickup(place.address);
      }
    },
    [focusedInput, isFoodDelivery, pickupIsMyLocation, setLocation]
  );

  const fillMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const result = await getCurrentLocationAsync();
      if (!result.ok) {
        Alert.alert("Location off", "Turn on location for QareGO, or search for the place instead.");
        return;
      }
      let address = "";
      try {
        address = await reverseGeocode(result.latitude, result.longitude);
      } catch {
        /* generic label below */
      }
      applySavedPlace({ latitude: result.latitude, longitude: result.longitude, address: address || CURRENT_LOCATION_LABEL });
    } finally {
      setLocating(false);
    }
  }, [applySavedPlace]);

  const confirmFoodDeliveryAddress = useCallback((): boolean => {
    if (!dropCoords) {
      Alert.alert("Missing address", "Please select your delivery address.");
      return false;
    }
    setLocation({
      latitude: dropCoords.latitude,
      longitude: dropCoords.longitude,
      address: drop || dropCoords.address || "",
    });
    setLocations([]);
    setMapModalVisible(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/customer/stores/checkout");
    }
    return true;
  }, [dropCoords, drop, setLocation]);

  const checkDistanceAndNavigate = useCallback((): boolean => {
    if (isFoodDelivery) {
      return confirmFoodDeliveryAddress();
    }

    if (!pickupCoords || !dropCoords) {
      Alert.alert(
        "Missing locations",
        "Please select both pickup and destination."
      );
      return false;
    }

    const { latitude: lat1, longitude: lon1 } = pickupCoords;
    const { latitude: lat2, longitude: lon2 } = dropCoords;

    if (lat1 === lat2 && lon1 === lon2) {
      Alert.alert(
        "Same location",
        "Pickup and drop cannot be the same. Please choose a different destination."
      );
      return false;
    }

    const distance = calculateDistance(lat1, lon1, lat2, lon2);
    const minDistance = 0.5;
    const maxDistance = 50;

    if (distance < minDistance) {
      Alert.alert(
        "Too close",
        "Please choose a destination further apart (at least 0.5 km)."
      );
      return false;
    }
    if (distance > maxDistance) {
      Alert.alert(
        "Too far",
        "Please select a destination within 50 km."
      );
      return false;
    }

    setLocations([]);
    setMapModalVisible(false);
    const navParams: Record<string, any> = {
      // Unrounded, so the quoted fare matches what the server charges (it prices the exact
      // distance); screens round for display.
      distanceInKm: String(distance),
      drop_latitude: String(dropCoords.latitude),
      drop_longitude: String(dropCoords.longitude),
      drop_address: drop || "",
      pickup_latitude: String(pickupCoords.latitude),
      pickup_longitude: String(pickupCoords.longitude),
      pickup_address: pickup || "",
      serviceType,
    };

    if (serviceType === "DELIVERY") {
      navParams.vehicle = vehicle ?? "motorcycle";
      navParams.parcelMode = parcelMode;
    }

    router.navigate({
      pathname: "/customer/ridebooking",
      params: navParams,
    });
    return true;
  }, [
    pickupCoords,
    dropCoords,
    drop,
    pickup,
    vehicle,
    serviceType,
    parcelMode,
    isFoodDelivery,
    confirmFoodDeliveryAddress,
  ]);

  const swapLocations = useCallback(() => {
    setPickup(drop);
    setDrop(pickup);
    setPickupCoords(dropCoords);
    setDropCoords(pickupCoords);
    setFocusedInput((prev) => (prev === "pickup" ? "drop" : "pickup"));
    setLocations([]);
  }, [drop, pickup, dropCoords, pickupCoords]);

  // The service home has no map, so on a fresh install nothing has saved the
  // user's position yet. Look it up here so pickup isn't left empty, and retry
  // if an earlier lookup only managed the generic label (e.g. while offline).
  useEffect(() => {
    if (location?.address && location.address !== CURRENT_LOCATION_LABEL) return;
    let cancelled = false;
    (async () => {
      // Coordinates saved without a street name only need the address lookup.
      let latitude = location?.latitude;
      let longitude = location?.longitude;
      if (latitude == null || longitude == null) {
        const result = await getCurrentLocationAsync();
        if (!result.ok || cancelled) return;
        ({ latitude, longitude } = result);
      }
      let address = "";
      try {
        address = await reverseGeocode(latitude, longitude);
      } catch {
        /* fall back to a generic label */
      }
      if (!cancelled) {
        setLocation({ latitude, longitude, address: address || CURRENT_LOCATION_LABEL });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only on mount: a later address change comes from the user's own choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isFoodDelivery) {
      if (location?.address) {
        setDropCoords(location);
        setDrop(location.address);
      }
      return;
    }
    if (!location?.address) return;
    if (isParcel && parcelMode === "RECEIVE") {
      setDropCoords(location);
      setDrop(location.address);
      return;
    }
    setPickupCoords(location);
    setPickup(location.address);
  }, [location, isFoodDelivery, isParcel, parcelMode]);

  // Load parcel points once we know roughly where the customer is (nearest first).
  const pointsLoadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isParcel) return;
    const key =
      location?.latitude != null && location?.longitude != null
        ? `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`
        : "none";
    if (pointsLoadedFor.current === key) return;
    pointsLoadedFor.current = key;
    let cancelled = false;
    fetchParcelPoints(location?.latitude, location?.longitude).then((pts) => {
      if (!cancelled) setParcelPoints(pts);
    });
    return () => {
      cancelled = true;
    };
  }, [isParcel, location?.latitude, location?.longitude]);

  useEffect(() => {
    if (isFoodDelivery || hasAutoNavigated.current) return;
    if (!pickupCoords || !dropCoords) return;
    const didNavigate = checkDistanceAndNavigate();
    if (didNavigate) hasAutoNavigated.current = true;
  }, [pickupCoords, dropCoords, isFoodDelivery, checkDistanceAndNavigate]);

  const canContinue = isFoodDelivery
    ? Boolean(dropCoords)
    : Boolean(pickupCoords && dropCoords);

  const openMapForFocused = useCallback(() => {
    setModalTitle(focusedInput);
    setMapModalVisible(true);
  }, [focusedInput]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <LocationItem item={item} query={typedQuery} onPress={() => addLocation(item)} />
    ),
    [addLocation, typedQuery]
  );

  // Recent places, minus what's already in the other field.
  const recents: RecentPlace[] = useMemo(() => {
    const other = focusedInput === "drop" ? pickup : drop;
    return recentPlaces.filter((r) => r.address !== other).slice(0, 4);
  }, [recentPlaces, focusedInput, pickup, drop]);

  const showPoints =
    isParcel &&
    parcelPoints.some((p) => (focusedInput === "pickup" ? p.canPickup : p.canDrop));

  const listHeader = useMemo(
    () => (
      <View>
        <RouteLocationCard
          showPickup={!isFoodDelivery}
          pickup={pickup}
          drop={drop}
          pickupLabel={isParcel ? parcelLabels.pickupLabel : undefined}
          dropLabel={isParcel ? parcelLabels.dropLabel : undefined}
          pickupPlaceholder={isParcel ? parcelLabels.pickupPlaceholder : undefined}
          dropPlaceholder={dropPlaceholder}
          focusedInput={focusedInput}
          onFocusPickup={() => {
            setFocusedInput("pickup");
            setTypedQuery("");
          }}
          onFocusDrop={() => {
            setFocusedInput("drop");
            setTypedQuery("");
          }}
          onChangePickup={(text) => {
            setPickup(text);
            setTypedQuery(text);
            fetchLocation(text);
          }}
          onChangeDrop={(text) => {
            setDrop(text);
            setTypedQuery(text);
            fetchLocation(text);
          }}
          onSwap={!isFoodDelivery ? swapLocations : undefined}
          accent={accent}
        />

        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickChip} onPress={fillMyLocation} disabled={locating} activeOpacity={0.8}>
            {locating ? (
              <ActivityIndicator size="small" color={accent} />
            ) : (
              <Ionicons name="navigate-outline" size={14} color={accent} />
            )}
            <CustomText fontSize={12} fontFamily="Medium" style={styles.quickText}>
              Use my location
            </CustomText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickChip} onPress={openMapForFocused} activeOpacity={0.8}>
            <Ionicons name="map-outline" size={14} color={accent} />
            <CustomText fontSize={12} fontFamily="Medium" style={styles.quickText}>
              Pick on map
            </CustomText>
          </TouchableOpacity>
        </View>

        {showPoints ? (
          <ParcelPointList
            points={parcelPoints}
            target={focusedInput}
            query={typedQuery}
            onPick={pickParcelPoint}
            selectedId={pointIds[focusedInput]}
          />
        ) : null}

        {searching ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={T.ink} />
            <CustomText fontSize={13} style={styles.loadingText}>
              Searching places…
            </CustomText>
          </View>
        ) : locations.length > 0 ? (
          <View style={styles.sectionHeader}>
            <CustomText fontFamily="Medium" fontSize={12} style={styles.sectionTitle}>
              Places
            </CustomText>
          </View>
        ) : !typedQuery.trim() && recents.length > 0 ? (
          <View>
            <View style={styles.sectionHeader}>
              <CustomText fontFamily="Medium" fontSize={12} style={styles.sectionTitle}>
                Recent
              </CustomText>
            </View>
            {recents.map((r) => (
              <LocationItem
                key={r.at}
                item={{ title: r.address.split(",")[0], description: r.address.split(",").slice(1).join(",").trim() }}
                icon="time-outline"
                onPress={() => applySavedPlace(r)}
              />
            ))}
          </View>
        ) : showPoints && !typedQuery.trim() ? null : (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={28} color={T.inkSoft} />
            </View>
            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.emptyTitle}>
              Find your place
            </CustomText>
            <CustomText fontSize={13} style={styles.emptyText}>
              Start typing an address, or tap “Pick on map” to drop a pin.
            </CustomText>
          </View>
        )}
      </View>
    ),
    [
      isFoodDelivery,
      pickup,
      drop,
      dropPlaceholder,
      isParcel,
      parcelLabels,
      focusedInput,
      fetchLocation,
      swapLocations,
      openMapForFocused,
      searching,
      locations.length,
      showPoints,
      parcelPoints,
      typedQuery,
      pickParcelPoint,
      accent,
      fillMyLocation,
      locating,
      pointIds,
      recents,
      applySavedPlace,
    ]
  );

  const listFooter = useMemo(() => {
    if (!canContinue) return null;
    return (
      <TouchableOpacity
        style={[styles.continueBtn, { backgroundColor: accent }]}
        onPress={() => checkDistanceAndNavigate()}
        activeOpacity={0.9}
      >
        <CustomText fontFamily="SemiBold" fontSize={16} style={styles.continueText}>
          {isFoodDelivery ? "Use this address" : "Continue"}
        </CustomText>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    );
  }, [canContinue, checkDistanceAndNavigate, isFoodDelivery, accent]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={styles.safeTop} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior="padding"
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/customer/home")
            }
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons name="arrow-back-ios" size={20} color={T.ink} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <CustomText fontFamily="Bold" fontSize={20} style={styles.headerTitle}>
              {headerTitle}
            </CustomText>
            <CustomText fontSize={13} style={styles.headerSubtitle} numberOfLines={1}>
              {headerSubtitle}
            </CustomText>
          </View>
          {/* Balances the back button so the title stays centred. */}
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={locations}
          renderItem={renderItem}
          keyExtractor={(item: any) => item?.place_id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>

      {isMapModalVisible ? (
        <MapPickerModal
          selectedLocation={{
            latitude:
              focusedInput === "drop" ? dropCoords?.latitude : pickupCoords?.latitude,
            longitude:
              focusedInput === "drop" ? dropCoords?.longitude : pickupCoords?.longitude,
            address: focusedInput === "drop" ? drop : pickup,
          }}
          title={modalTitle}
          visible={isMapModalVisible}
          onClose={() => setMapModalVisible(false)}
          onSelectLocation={(data) => {
            if (data) {
              addRecent(data);
              setPointIds((ids) => ({ ...ids, [modalTitle]: null }));
              if (modalTitle === "drop") {
                setDropCoords(data);
                setDrop(data?.address ?? "");
                if (isFoodDelivery) {
                  setLocation({
                    latitude: data.latitude,
                    longitude: data.longitude,
                    address: data.address ?? "",
                  });
                  setMapModalVisible(false);
                  if (router.canGoBack()) router.back();
                  else router.replace("/customer/stores/checkout");
                }
              } else {
                if (pickupIsMyLocation) setLocation(data);
                setPickupCoords(data);
                setPickup(data?.address ?? "");
              }
            }
          }}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  quickRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.15)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  quickText: { color: T.ink },
  safeTop: {
    backgroundColor: "transparent",
  },
  keyboard: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 4,
    backgroundColor: "transparent",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...T.shadow.card,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: T.ink,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: T.inkMuted,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingTop: 18,
    paddingBottom: 4,
  },
  sectionTitle: {
    color: T.inkMuted,
  },
  loadingWrap: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: T.inkMuted,
  },
  emptyWrap: {
    marginTop: 32,
    alignItems: "center",
    paddingBottom: 16,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    ...T.shadow.card,
  },
  emptyTitle: {
    color: T.ink,
    marginBottom: 6,
  },
  emptyText: {
    color: T.inkMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.theme,
  },
  continueText: {
    color: "#fff",
  },
});

export default LocationSelection;
