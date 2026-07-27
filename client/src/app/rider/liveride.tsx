import { View, Alert, TouchableOpacity } from "react-native";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRiderStore } from "@/store/riderStore";
import { useWS } from "@/service/WSProvider";
import { useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import { resetAndNavigate } from "@/utils/Helpers";
import { StatusBar } from "expo-status-bar";
import { rideStyles } from "@/styles/rideStyles";
import RiderLiveTracking from "@/components/rider/RiderLiveTracking";
import RiderDeliveryBanner from "@/components/rider/RiderDeliveryBanner";
import { updateRideStatus, getRideById } from "@/service/rideService";
import RiderActionButton from "@/components/rider/RiderActionButton";
import OtpInputModal from "@/components/rider/OtpInputModal";
import RideCompletedModal from "@/components/shared/RideCompletedModal";
import ChatModal from "@/components/shared/ChatModal";
import { Ionicons } from "@expo/vector-icons";
import { maskPhone } from "@/utils/maskPhone";
import { stopRiderOfferRing } from "@/utils/ringSound";
import { emitRiderOfferAccepted } from "@/utils/riderOfferEvents";
import { parseRideParcelMode } from "@/utils/parcelMode";
import {
  getRiderCourierUi,
  getRiderSwipeTitle,
  getRiderDeliveryPhase,
  getRiderParcelCollectedAlert,
  getRiderParcelDeliveryStartedAlert,
  getRiderParcelOtpSubtitle,
  getRiderParcelOtpError,
} from "@/utils/riderCourierUi";
import { riderDeliveryStyles as deliveryStyles } from "@/styles/riderDeliveryStyles";
import { ACTIVE_RIDER_RIDE_STATUSES } from "@/utils/riderRideUtils";

type OtpPurpose = "pickup" | "delivery";

function hasMapCoords(loc?: { latitude?: unknown; longitude?: unknown } | null) {
  const lat = Number(loc?.latitude);
  const lng = Number(loc?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

const LiveRide = () => {
  const [isOtpModalVisible, setOtpModalVisible] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>("pickup");
  const [showCostPopup, setShowCostPopup] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { location, setLocation, setOnDuty, user } = useRiderStore();
  const { emit, on, off } = useWS();
  const [rideData, setRideData] = useState<any>(null);
  const rideDataRef = useRef<any>(null);
  const route = useRoute() as any;
  const params = route?.params || {};
  const id = params.id;

  useEffect(() => {
    rideDataRef.current = rideData;
  }, [rideData]);

  useEffect(() => {
    void stopRiderOfferRing();
    emitRiderOfferAccepted();
  }, []);

  const isFood = rideData?.serviceType === "FOOD";
  const isParcel = rideData?.serviceType === "DELIVERY";
  const parcelMode = parseRideParcelMode(rideData);
  const canChat =
    rideData?.customer &&
    (rideData?.status === "START" ||
      rideData?.status === "ARRIVED" ||
      rideData?.status === "IN_PROGRESS");
  const courierUi = getRiderCourierUi(rideData);
  const deliveryPhase = getRiderDeliveryPhase(rideData);
  const mapReady =
    rideData &&
    hasMapCoords(rideData.pickup) &&
    hasMapCoords(rideData.drop);

  useEffect(() => {
    let locationSubscription: any;

    const publishLocation = (latitude: number, longitude: number, heading?: number | null) => {
      const coords = {
        latitude,
        longitude,
        heading: heading ?? 0,
      };
      setLocation({
        latitude,
        longitude,
        address: "Somewhere",
        heading: coords.heading,
      });
      emit("updateLocation", coords);
    };

    const startLocationUpdates = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Location permission denied");
        return;
      }

      try {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const { latitude, longitude, heading } = initial.coords;
        setOnDuty(true);
        emit("goOnDuty", { latitude, longitude, heading: heading ?? 0 });
        publishLocation(latitude, longitude, heading);
      } catch (err) {
        console.log("Initial courier location failed:", err);
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 8,
        },
        (location) => {
          const { latitude, longitude, heading } = location.coords;
          publishLocation(latitude, longitude, heading);
        }
      );
    };

    startLocationUpdates();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [id, setLocation, setOnDuty, emit]);

  const handleDeliveryComplete = useCallback((ride: { status?: string } | null) => {
    if (!ride || ride.status !== "COMPLETED") return;
    setOtpModalVisible(false);
    setRideData(ride);
    setShowCostPopup(true);
  }, []);

  useEffect(() => {
    if (!id) return;

    emit("subscribeRide", id);

    getRideById(id).then((ride) => {
      if (!ride) {
        resetAndNavigate("/rider/home");
        return;
      }
      if (ride.status === "COMPLETED") {
        handleDeliveryComplete(ride);
        return;
      }
      if (
        !ACTIVE_RIDER_RIDE_STATUSES.includes(
          ride.status as (typeof ACTIVE_RIDER_RIDE_STATUSES)[number]
        )
      ) {
        resetAndNavigate("/rider/home");
        Alert.alert("Delivery ended", "This trip is no longer active.");
        return;
      }
      setRideData(ride);
    });

    const onRideData = (data: any) => {
      setRideData(data);
      if (data?.status === "COMPLETED") {
        handleDeliveryComplete(data);
      }
    };

    const onRideCanceled = () => {
      resetAndNavigate("/rider/home");
      Alert.alert("Ride Canceled");
    };

    const onRideUpdate = (data: any) => {
      if (
        data?.status &&
        !ACTIVE_RIDER_RIDE_STATUSES.includes(
          data.status as (typeof ACTIVE_RIDER_RIDE_STATUSES)[number]
        ) &&
        data?.status !== "COMPLETED"
      ) {
        resetAndNavigate("/rider/home");
        return;
      }
      setRideData(data);
      if (data?.status === "COMPLETED") {
        handleDeliveryComplete(data);
      }
    };

    const onSocketError = () => {
      resetAndNavigate("/rider/home");
      Alert.alert("Oh Dang! There was an error");
    };

    on("rideData", onRideData);
    on("rideCanceled", onRideCanceled);
    on("rideUpdate", onRideUpdate);
    on("error", onSocketError);

    return () => {
      off("rideData", onRideData);
      off("rideUpdate", onRideUpdate);
      off("rideCanceled", onRideCanceled);
      off("error", onSocketError);
    };
  }, [id, emit, on, off, handleDeliveryComplete]);

  const handleCostPopupClose = () => {
    setShowCostPopup(false);
    resetAndNavigate("/rider/home");
  };

  const handlePrimaryAction = useCallback(async () => {
    const current = rideDataRef.current;
    if (!current || actionLoading) return;

    const food = current.serviceType === "FOOD";
    const parcel = current.serviceType === "DELIVERY";
    const mode = parseRideParcelMode(current);

    setActionLoading(true);
    try {
      if (current.status === "START") {
        if (food || parcel) {
          const result = await updateRideStatus(current._id, "ARRIVED");
          if (result.ok) {
            if (result.ride) setRideData(result.ride);
            if (parcel) {
              const alert = getRiderParcelCollectedAlert(mode);
              Alert.alert(alert.title, alert.message);
            } else {
              Alert.alert("Picked up", "Food collected — head to the customer");
            }
          }
        } else {
          setOtpPurpose("pickup");
          setOtpModalVisible(true);
        }
        return;
      }
      if (current.status === "ARRIVED") {
        const result = await updateRideStatus(current._id, "IN_PROGRESS");
        if (result.ok) {
          if (result.ride) setRideData(result.ride);
          if (parcel) {
            const alert = getRiderParcelDeliveryStartedAlert(mode);
            Alert.alert(alert.title, alert.message);
          } else {
            Alert.alert(
              food ? "On the way" : "Ride Started!",
              food ? "Deliver to the customer address" : "Safe journey to the destination"
            );
          }
        } else {
          Alert.alert("There was an error");
        }
        return;
      }
      if (current.status === "IN_PROGRESS") {
        if (food || parcel) {
          setOtpPurpose("delivery");
          setOtpModalVisible(true);
        } else {
          const result = await updateRideStatus(current._id, "COMPLETED");
          if (result.ok) {
            handleDeliveryComplete(result.ride ?? current);
          } else {
            Alert.alert("There was an error");
          }
        }
      }
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, handleDeliveryComplete]);

  const handleOtpConfirm = useCallback(
    async (otp: string) => {
      const current = rideDataRef.current;
      if (!current) return;
      const parcel = current.serviceType === "DELIVERY";
      const mode = parseRideParcelMode(current);

      if (otpPurpose === "delivery") {
        const result = await updateRideStatus(current._id, "COMPLETED", otp);
        if (result.ok) {
          handleDeliveryComplete(result.ride ?? { ...current, status: "COMPLETED" });
        } else {
          Alert.alert(
            "Invalid code",
            result.message ||
              (parcel
                ? getRiderParcelOtpError(mode)
                : "Ask the customer for the correct delivery code.")
          );
        }
        return;
      }

      if (otp === current.otp) {
        const result = await updateRideStatus(current._id, "ARRIVED", otp);
        if (result.ok) {
          setOtpModalVisible(false);
          if (result.ride) setRideData(result.ride);
        } else {
          Alert.alert("Technical Error", result.message || "Could not verify OTP.");
        }
      } else {
        Alert.alert("Wrong OTP");
      }
    },
    [otpPurpose, handleDeliveryComplete]
  );

  return (
    <View style={rideStyles.container}>
      <StatusBar style="light" backgroundColor="orange" translucent={false} />

      {mapReady && (
        <>
          <RiderLiveTracking
            status={rideData?.status}
            vehicle={rideData?.vehicle}
            serviceType={rideData?.serviceType}
            parcelMode={rideData?.parcelMode}
            restaurantName={rideData?.restaurantName}
            storeVertical={rideData?.storeVertical}
            foodOrderSummary={rideData?.foodOrderSummary}
            drop={{
              latitude: parseFloat(rideData?.drop.latitude),
              longitude: parseFloat(rideData?.drop.longitude),
              address: rideData?.drop?.address,
            }}
            pickup={{
              latitude: parseFloat(rideData?.pickup.latitude),
              longitude: parseFloat(rideData?.pickup.longitude),
              address: rideData?.pickup?.address,
            }}
            rider={{
              latitude: location?.latitude,
              longitude: location?.longitude,
              heading: location?.heading,
            }}
          />
          {canChat && (
            <TouchableOpacity
              onPress={() => setShowChat(true)}
              style={deliveryStyles.chatFab}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-ellipses" size={22} color="#0f172a" />
            </TouchableOpacity>
          )}
        </>
      )}

      <RiderActionButton
        ride={rideData}
        actionLabel={rideData ? getRiderSwipeTitle(rideData) : "Loading…"}
        meetLabel={courierUi.meetLabel}
        contactPhone={courierUi.contactPhone}
        pickupLabel={courierUi.pickupLabel}
        dropLabel={courierUi.dropLabel}
        actionLoading={actionLoading}
        banner={
          rideData && (isFood || isParcel) ? (
            <RiderDeliveryBanner ride={rideData} variant="inline" />
          ) : undefined
        }
        onAction={handlePrimaryAction}
        actionColor={deliveryPhase.swipeColor}
      />

      {isOtpModalVisible && (
        <OtpInputModal
          visible={isOtpModalVisible}
          onClose={() => setOtpModalVisible(false)}
          title={otpPurpose === "delivery" ? "Enter delivery code" : "Confirm arrival"}
          subtitle={
            otpPurpose === "delivery"
              ? isParcel
                ? getRiderParcelOtpSubtitle(parcelMode)
                : "Ask the customer for their 4-digit delivery code before handing over the food."
              : "Ask the customer for the 4-digit code on their screen."
          }
          confirmLabel={otpPurpose === "delivery" ? "Complete delivery" : "Confirm"}
          onConfirm={handleOtpConfirm}
        />
      )}

      {showCostPopup && rideData && (
        <RideCompletedModal
          visible={showCostPopup}
          ride={rideData}
          onClose={handleCostPopupClose}
        />
      )}
      {canChat && (
        <ChatModal
          visible={showChat}
          onClose={() => setShowChat(false)}
          rideId={rideData._id}
          otherUserId={rideData.customer?._id || rideData.customer}
          otherUserName={rideData.customer?.name ?? "Customer"}
          otherUserPhone={rideData.customer?.phone}
          currentUserId={user?._id || user?.id}
          currentUserName={user?.name}
          maskedPhone={rideData.customer?.phone ? maskPhone(rideData.customer.phone) : undefined}
        />
      )}
    </View>
  );
};

export default LiveRide;
