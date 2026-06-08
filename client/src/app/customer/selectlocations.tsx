import {
  View,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
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
} from "@/utils/mapUtils";
import LocationItem from "@/components/customer/LocationItem";
import MapPickerModal from "@/components/customer/MapPickerModal";
import CustomerLogoutButton from "@/components/customer/CustomerLogoutButton";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { parseParcelMode, parcelModeLabels, type ParcelMode } from "@/utils/parcelMode";

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
            setLocation(data);
            setPickupCoords(data);
            setPickup(data?.address ?? "");
          }
          setLocations([]);
        }
      } catch {
        Alert.alert("Error", "Could not get location details.");
      }
    },
    [focusedInput, setLocation, isFoodDelivery]
  );

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
      distanceInKm: distance.toFixed(2),
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
      <LocationItem item={item} onPress={() => addLocation(item)} />
    ),
    [addLocation]
  );

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
          onFocusPickup={() => setFocusedInput("pickup")}
          onFocusDrop={() => setFocusedInput("drop")}
          onChangePickup={(text) => {
            setPickup(text);
            fetchLocation(text);
          }}
          onChangeDrop={(text) => {
            setDrop(text);
            fetchLocation(text);
          }}
          onSwap={!isFoodDelivery ? swapLocations : undefined}
          onMapPress={openMapForFocused}
        />

        {searching ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={T.ink} />
            <CustomText fontSize={13} style={styles.loadingText}>
              Searching places…
            </CustomText>
          </View>
        ) : locations.length > 0 ? (
          <View style={styles.sectionHeader}>
            <CustomText fontFamily="SemiBold" fontSize={13} style={styles.sectionTitle}>
              Suggestions
            </CustomText>
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={28} color={T.inkSoft} />
            </View>
            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.emptyTitle}>
              Find your place
            </CustomText>
            <CustomText fontSize={13} style={styles.emptyText}>
              Start typing an address, or tap “Set location on map” to drop a pin.
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
    ]
  );

  const listFooter = useMemo(() => {
    if (!canContinue) return null;
    return (
      <TouchableOpacity
        style={styles.continueBtn}
        onPress={() => checkDistanceAndNavigate()}
        activeOpacity={0.9}
      >
        <CustomText fontFamily="SemiBold" fontSize={16} style={styles.continueText}>
          {isFoodDelivery ? "Use this address" : "Continue"}
        </CustomText>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    );
  }, [canContinue, checkDistanceAndNavigate, isFoodDelivery]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeTop} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
            <CustomText fontFamily="SemiBold" fontSize={18} style={styles.headerTitle}>
              {headerTitle}
            </CustomText>
            <CustomText fontSize={13} style={styles.headerSubtitle} numberOfLines={1}>
              {headerSubtitle}
            </CustomText>
          </View>
          {isFoodDelivery || isParcel ? (
            <CustomerLogoutButton style={styles.backBtn} />
          ) : (
            <View style={styles.backBtn} />
          )}
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
                setLocation(data);
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
    backgroundColor: T.surfaceMuted,
  },
  safeTop: {
    backgroundColor: T.sheetBg,
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
    backgroundColor: T.sheetBg,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: T.surfaceMuted,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: T.ink,
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
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    color: T.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
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
    borderRadius: 28,
    backgroundColor: T.sheetBg,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: T.ink,
    marginBottom: 6,
  },
  emptyText: {
    color: T.inkMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: T.ink,
  },
  continueText: {
    color: "#fff",
  },
});

export default LocationSelection;
