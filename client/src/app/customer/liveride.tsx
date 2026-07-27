import {
  View,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWS } from "@/service/WSProvider";
import { useIsFocused, useRoute } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { rideStyles } from "@/styles/rideStyles";
import { StatusBar } from "expo-status-bar";
import LiveTrackingMap from "@/components/customer/LiveTrackingMap";
import CustomText from "@/components/shared/CustomText";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import SearchingRideSheet from "@/components/customer/SearchingRideSheet";
import LiveTrackingSheet from "@/components/customer/LiveTrackingSheet";
import { resetAndNavigate } from "@/utils/Helpers";
import RatingModal from "@/components/shared/RatingModal";
import RideCompletedModal from "@/components/shared/RideCompletedModal";
import HubtelCheckoutModal from "@/components/shared/HubtelCheckoutModal";
import { useMessage } from "@/context/MessageContext";
import {
  fetchCourierLocation,
  getRideById,
  initiateRidePayment,
  fetchRidePaymentStatus,
} from "@/service/rideService";
import {
  coordsFromRideRider,
  courierCoordsChanged,
  normalizeRiderId,
  parseCourierLocationPayload,
  type RiderLiveCoords,
} from "@/utils/riderLiveLocation";
import { customerRatesRiderForRide } from "@/utils/ratingFlow";
import { buildLiveRideSnapPoints } from "@/utils/bottomSheetSnapPoints";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACTIVE_RIDE_STATUSES = new Set(["START", "ARRIVED", "IN_PROGRESS"]);
const LIVE_MAP_STATUSES = new Set(["START", "ARRIVED", "IN_PROGRESS"]);
const COURIER_POLL_MS = 2000;

function isRideSearchFatalError(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("no riders found") ||
    msg.includes("error searching for rider") ||
    msg.includes("ride not found") ||
    msg.includes("invalid ride id")
  );
}

const LiveRide = () => {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { emit, on, off, connectNonce } = useWS();
  const [rideData, setRideData] = useState<any>(null);
  const [riderCoords, setRiderCoords] = useState<RiderLiveCoords | null>(null);
  const [courierRevision, setCourierRevision] = useState(0);
  const [showCostPopup, setShowCostPopup] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [ridePaymentStatus, setRidePaymentStatus] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const { showToast } = useMessage();
  const route = useRoute() as any;
  const urlParams = useLocalSearchParams<{ id?: string }>();
  const params = route?.params || {};
  const rideId = useMemo(() => {
    const raw = urlParams?.id ?? params?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [urlParams?.id, params?.id]);

  const rideStatusRef = useRef<string | null>(null);
  const rideDataRef = useRef<any>(null);
  const searchEmittedRef = useRef(false);
  const riderIdRef = useRef<string | null>(null);
  const riderCoordsRef = useRef<RiderLiveCoords | null>(null);

  const applyCourierLocation = useCallback((payload: unknown) => {
    const next = parseCourierLocationPayload(payload);
    if (!next) return;
    const expectedRiderId = riderIdRef.current ?? normalizeRiderId(rideDataRef.current?.rider);
    const incomingRiderId =
      payload && typeof payload === "object" && "riderId" in payload
        ? String((payload as { riderId?: unknown }).riderId ?? "")
        : "";
    if (incomingRiderId && expectedRiderId && incomingRiderId !== expectedRiderId) return;
    if (!courierCoordsChanged(riderCoordsRef.current, next)) return;
    riderCoordsRef.current = next;
    setRiderCoords(next);
    setCourierRevision((n) => n + 1);
  }, []);
  const snapPoints = useMemo(
    () => buildLiveRideSnapPoints(windowHeight),
    [windowHeight]
  );
  const sheetReady = windowHeight >= 100 && snapPoints.length >= 2;
  const [mapHeight, setMapHeight] = useState(() => windowHeight * 0.5);

  useEffect(() => {
    rideStatusRef.current = rideData?.status ?? null;
    rideDataRef.current = rideData;
    const id = normalizeRiderId(rideData?.rider);
    if (id) riderIdRef.current = id;
  }, [rideData]);

  useEffect(() => {
    if (windowHeight > 0) setMapHeight(windowHeight * 0.5);
  }, [windowHeight]);

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index < 0 || windowHeight < 1) return;
      setMapHeight(windowHeight * (index >= 1 ? 0.5 : 0.8));
    },
    [windowHeight]
  );

  useEffect(() => {
    if (!rideId) return;

    emit("subscribeRide", rideId);

    getRideById(rideId)
      .then((ride) => {
        if (!ride) return;
        setRideData(ride);
        const id = normalizeRiderId(ride?.rider);
        if (id) riderIdRef.current = id;
        const seeded = coordsFromRideRider(ride);
        if (seeded) applyCourierLocation({ coords: seeded });
      })
      .catch(() => {});

    const onRideData = (data: any) => {
      setRideData(data);
      const id = normalizeRiderId(data?.rider);
      if (id) riderIdRef.current = id;
      const seeded = coordsFromRideRider(data);
      if (seeded) applyCourierLocation({ coords: seeded });
      if (data?.status === "SEARCHING_FOR_RIDER" && !searchEmittedRef.current) {
        searchEmittedRef.current = true;
        emit("searchrider", rideId);
      }
      if (data?.status && data.status !== "SEARCHING_FOR_RIDER") {
        searchEmittedRef.current = false;
      }
      if (data?.status === "COMPLETED") {
        setShowCostPopup(true);
      }
    };

    const onRideUpdate = (data: any) => {
      setRideData(data);
      const id = normalizeRiderId(data?.rider);
      if (id) riderIdRef.current = id;
      const seeded = coordsFromRideRider(data);
      if (seeded) applyCourierLocation({ coords: seeded });
      if (data?.status === "COMPLETED") {
        setShowCostPopup(true);
      }
    };

    const onRideCanceled = () => {
      resetAndNavigate("/customer/home");
      Alert.alert("Ride Canceled");
    };

    const onSocketError = (error: { message?: string }) => {
      const message = error?.message || "";
      if (!isRideSearchFatalError(message)) return;
      if (ACTIVE_RIDE_STATUSES.has(rideStatusRef.current || "")) return;

      resetAndNavigate("/customer/home");
      Alert.alert(
        "No riders available",
        message || "We could not find a rider. Please try again."
      );
    };

    const onRiderLocation = (data: any) => {
      applyCourierLocation(data);
    };

    on("rideData", onRideData);
    on("rideUpdate", onRideUpdate);
    on("rideCanceled", onRideCanceled);
    on("error", onSocketError);
    on("riderLocationUpdate", onRiderLocation);

    return () => {
      off("rideData", onRideData);
      off("rideUpdate", onRideUpdate);
      off("rideCanceled", onRideCanceled);
      off("error", onSocketError);
      off("riderLocationUpdate", onRiderLocation);
      searchEmittedRef.current = false;
    };
  }, [rideId, emit, on, off, applyCourierLocation]);

  const riderId = normalizeRiderId(rideData?.rider);

  useEffect(() => {
    if (!rideId || !isFocused) return;
    emit("subscribeRide", rideId);
    if (riderId) emit("subscribeToriderLocation", riderId);
  }, [rideId, riderId, connectNonce, isFocused, emit]);

  useEffect(() => {
    if (!rideId || !riderId || !LIVE_MAP_STATUSES.has(rideData?.status || "") || !isFocused) {
      return;
    }

    const pollCourier = async () => {
      const coords = await fetchCourierLocation(rideId);
      if (coords) applyCourierLocation({ coords, riderId });
    };

    void pollCourier();
    const interval = setInterval(pollCourier, COURIER_POLL_MS);
    return () => clearInterval(interval);
  }, [rideId, riderId, rideData?.status, isFocused, applyCourierLocation]);

  useEffect(() => {
    if (rideData?.status === "COMPLETED") {
      setShowCostPopup(true);
    }
  }, [rideData?.status]);

  const foodOrderId =
    rideData?.foodOrder?._id?.toString?.() ||
    (rideData?.foodOrder ? String(rideData.foodOrder) : null);

  const pickup = useMemo(
    () => ({
      latitude: rideData?.pickup?.latitude,
      longitude: rideData?.pickup?.longitude,
      address: rideData?.pickup?.address,
    }),
    [rideData?.pickup?.latitude, rideData?.pickup?.longitude, rideData?.pickup?.address]
  );

  const drop = useMemo(
    () => ({
      latitude: rideData?.drop?.latitude,
      longitude: rideData?.drop?.longitude,
      address: rideData?.drop?.address,
    }),
    [rideData?.drop?.latitude, rideData?.drop?.longitude, rideData?.drop?.address]
  );

  const rider = useMemo(
    () =>
      riderCoords
        ? {
            latitude: riderCoords.latitude,
            longitude: riderCoords.longitude,
            heading: riderCoords.heading,
          }
        : null,
    [riderCoords?.latitude, riderCoords?.longitude, riderCoords?.heading]
  );

  const handleCostPopupClose = () => {
    setShowCostPopup(false);
    if (customerRatesRiderForRide(rideData)) {
      setShowRating(true);
      return;
    }
    if (foodOrderId) {
      router.replace(`/customer/stores/order/${foodOrderId}`);
      return;
    }
    resetAndNavigate("/customer/hub");
  };

  const handleRatingSuccess = () => {
    setShowRating(false);
    resetAndNavigate("/customer/home");
  };

  const handleRequestRate = useCallback(() => {
    setShowRating(true);
  }, []);

  const serviceType = rideData?.serviceType;
  const isMomoPayableRide =
    rideData?.paymentMethod === "MOBILE_MONEY" &&
    (serviceType === "RIDE" || serviceType === "DELIVERY");
  const effectivePaymentStatus = ridePaymentStatus || rideData?.paymentStatus || "NOT_REQUIRED";
  const needsMomoPayment =
    isMomoPayableRide &&
    rideData?.status === "COMPLETED" &&
    ["UNPAID", "PENDING", "FAILED", "NOT_REQUIRED"].includes(effectivePaymentStatus);

  const loadRidePaymentStatus = useCallback(async () => {
    if (!rideId) return;
    try {
      const status = await fetchRidePaymentStatus(rideId);
      setRidePaymentStatus(status.ridePaymentStatus);
    } catch {
      // Ignore transient errors.
    }
  }, [rideId]);

  useEffect(() => {
    if (rideData?.status === "COMPLETED" && isMomoPayableRide) {
      loadRidePaymentStatus();
    }
  }, [rideData?.status, isMomoPayableRide, loadRidePaymentStatus]);

  useEffect(() => {
    if (!isMomoPayableRide || effectivePaymentStatus !== "PENDING") return;
    const t = setInterval(loadRidePaymentStatus, 4000);
    return () => clearInterval(t);
  }, [isMomoPayableRide, effectivePaymentStatus, loadRidePaymentStatus]);

  const closeCheckout = useCallback(() => {
    setCheckoutVisible(false);
    setCheckoutUrl(null);
  }, []);

  const handlePayRide = useCallback(async () => {
    if (!rideId) return;
    setPaymentBusy(true);
    try {
      const payment = await initiateRidePayment(rideId);
      if (payment?.status === "success") {
        setRidePaymentStatus("PAID");
        return;
      }
      const url = payment?.checkoutDirectUrl || payment?.checkoutUrl;
      if (!url) {
        showToast?.({
          type: "error",
          title: "Payment unavailable",
          message: "Could not open payment. Please try again.",
        });
        return;
      }
      setShowCostPopup(false);
      setCheckoutUrl(url);
      setCheckoutVisible(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not start payment";
      showToast?.({ type: "error", title: "Payment unavailable", message: msg });
    } finally {
      setPaymentBusy(false);
    }
  }, [rideId, showToast]);

  const handleCheckoutSuccess = useCallback(async () => {
    closeCheckout();
    showToast?.({
      type: "success",
      title: "Payment received",
      message: "Confirming your payment…",
    });
    setRidePaymentStatus("PAID");
    await loadRidePaymentStatus();
    setShowCostPopup(true);
  }, [closeCheckout, loadRidePaymentStatus, showToast]);

  const handleCheckoutCancel = useCallback(async () => {
    closeCheckout();
    showToast?.({
      type: "info",
      title: "Payment cancelled",
      message: "You can still pay from this screen.",
    });
    await loadRidePaymentStatus();
    setShowCostPopup(true);
  }, [closeCheckout, loadRidePaymentStatus, showToast]);

  return (
    <View style={rideStyles.container}>
      <StatusBar style="light" backgroundColor="orange" translucent={false} />

      {rideData ? (
        <>
          <LiveTrackingMap
            height={mapHeight}
            status={rideData?.status}
            serviceType={rideData?.serviceType}
            parcelMode={rideData?.parcelMode}
            storeVertical={rideData?.storeVertical}
            vehicle={rideData?.vehicle}
            drop={drop}
            pickup={pickup}
            rider={rider}
            courierRevision={courierRevision}
          />
          {rideData?.status === "COMPLETED" && customerRatesRiderForRide(rideData) ? (
            <TouchableOpacity
              style={[styles.rateButton, { top: insets.top + 12 }]}
              onPress={handleRequestRate}
              activeOpacity={0.85}
            >
              <CustomText fontFamily="SemiBold" fontSize={14} style={{ color: "#fff" }}>
                {rideData?.serviceType === "DELIVERY" ? "Rate your courier" : "Rate your driver"}
              </CustomText>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}

      {rideData && sheetReady ? (
        <BottomSheet
          key={rideData._id}
          index={1}
          animateOnMount
          handleIndicatorStyle={{
            backgroundColor: "#ccc",
          }}
          enableOverDrag={false}
          enableDynamicSizing={false}
          style={{ zIndex: 4 }}
          snapPoints={snapPoints}
          onChange={handleSheetChanges}
        >
          <BottomSheetScrollView contentContainerStyle={rideStyles?.container}>
            {rideData?.status === "SEARCHING_FOR_RIDER" ? (
              <SearchingRideSheet item={rideData} />
            ) : (
              <LiveTrackingSheet
                item={rideData}
                onRateDriver={
                  rideData?.status === "COMPLETED" && customerRatesRiderForRide(rideData)
                    ? handleRequestRate
                    : undefined
                }
              />
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      ) : (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          {rideId ? (
            <>
              <CustomText variant="h8">Fetching ride...</CustomText>
              <ActivityIndicator color="black" size="small" style={{ marginTop: 8 }} />
            </>
          ) : (
            <CustomText variant="h8">Missing ride. Go back to home.</CustomText>
          )}
        </View>
      )}

      {showCostPopup && rideData?.status === "COMPLETED" ? (
        <RideCompletedModal
          visible={showCostPopup}
          ride={{ ...rideData, paymentStatus: effectivePaymentStatus }}
          onClose={handleCostPopupClose}
          onPay={needsMomoPayment ? handlePayRide : undefined}
          payBusy={paymentBusy}
        />
      ) : null}
      <HubtelCheckoutModal
        visible={checkoutVisible}
        checkoutUrl={checkoutUrl}
        onSuccess={handleCheckoutSuccess}
        onCancel={handleCheckoutCancel}
        onClose={closeCheckout}
      />
      {showRating && customerRatesRiderForRide(rideData) && (rideId || rideData?._id) ? (
        <RatingModal
          visible={showRating}
          rideId={rideId || rideData?._id}
          role="customer"
          onClose={() => setShowRating(false)}
          onSuccess={handleRatingSuccess}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  rateButton: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "orange",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});

export default memo(LiveRide);
