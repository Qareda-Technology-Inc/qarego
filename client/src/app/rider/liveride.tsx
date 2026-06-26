import { View, Alert, TouchableOpacity } from "react-native";
import React, { useEffect, useState, useCallback } from "react";
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
import CustomText from "@/components/shared/CustomText";
import RiderActionButton from "@/components/rider/RiderActionButton";
import OtpInputModal from "@/components/rider/OtpInputModal";
import RideCompletedModal from "@/components/shared/RideCompletedModal";
import SafetyFeatures from "@/components/shared/SafetyFeatures";
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
  const { location, setLocation, setOnDuty, user } = useRiderStore();
  const { emit, on, off } = useWS();
  const [rideData, setRideData] = useState<any>(null);
  const route = useRoute() as any;
  const params = route?.params || {};
  const id = params.id;

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
    if (id) {
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

      on("rideData", (data) => {
        setRideData(data);
        if (data?.status === "COMPLETED") {
          handleDeliveryComplete(data);
        }
      });

      on("rideCanceled", (error) => {
        console.log("Ride error:", error);
        resetAndNavigate("/rider/home");
        Alert.alert("Ride Canceled");
      });

      on("rideUpdate", (data) => {
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
      });

      on("error", (error) => {
        console.log("Ride error:", error);
        resetAndNavigate("/rider/home");
        Alert.alert("Oh Dang! There was an error");
      });
    }

    return () => {
      off("rideData");
      off("rideUpdate");
      off("rideCanceled");
      off("error");
    };
  }, [id, emit, on, off, handleDeliveryComplete]);

  const handleCostPopupClose = () => {
    setShowCostPopup(false);
    resetAndNavigate("/rider/home");
  };

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
          {rideData?.status ? (
            <View style={deliveryStyles.statusPill}>
              <Ionicons name="navigate" size={14} color="#fff" style={{ marginRight: 6 }} />
              <CustomText fontSize={12} fontFamily="SemiBold" style={{ color: "#fff" }}>
                {deliveryPhase.phaseLabel}
              </CustomText>
            </View>
          ) : null}
          <RiderDeliveryBanner ride={rideData} />
          <SafetyFeatures
            rideId={rideData._id}
            pickup={{
              latitude: parseFloat(rideData?.pickup?.latitude),
              longitude: parseFloat(rideData?.pickup?.longitude),
              address: rideData?.pickup?.address,
            }}
            drop={{
              latitude: parseFloat(rideData?.drop?.latitude),
              longitude: parseFloat(rideData?.drop?.longitude),
              address: rideData?.drop?.address,
            }}
            riderInfo={{
              name: rideData?.customer?.name ?? "Customer",
              phone: rideData?.customer?.phone,
              maskedPhone: rideData?.customer?.phone ? maskPhone(rideData.customer.phone) : undefined,
            }}
            status={rideData?.status}
          />
          {canChat && (
            <TouchableOpacity
              onPress={() => setShowChat(true)}
              style={deliveryStyles.chatFab}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-ellipses" size={24} color="#0f172a" />
            </TouchableOpacity>
          )}
        </>
      )}

      <RiderActionButton
        ride={rideData}
        title={rideData ? getRiderSwipeTitle(rideData) : "LOADING…"}
        meetLabel={courierUi.meetLabel}
        contactPhone={courierUi.contactPhone}
        pickupLabel={courierUi.pickupLabel}
        dropLabel={courierUi.dropLabel}
        onPress={async () => {
          if (rideData?.status === "START") {
            if (isFood || isParcel) {
              const result = await updateRideStatus(rideData?._id, "ARRIVED");
              if (result.ok) {
                if (isParcel) {
                  const alert = getRiderParcelCollectedAlert(parcelMode);
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
          if (rideData?.status === "ARRIVED") {
            const result = await updateRideStatus(rideData?._id, "IN_PROGRESS");
            if (result.ok) {
              if (isParcel) {
                const alert = getRiderParcelDeliveryStartedAlert(parcelMode);
                Alert.alert(alert.title, alert.message);
              } else {
                Alert.alert(
                  isFood ? "On the way" : "Ride Started!",
                  isFood
                    ? "Deliver to the customer address"
                    : "Safe journey to the destination"
                );
              }
            } else {
              Alert.alert("There was an error");
            }
            return;
          }
          if (rideData?.status === "IN_PROGRESS") {
            if (isFood || isParcel) {
              setOtpPurpose("delivery");
              setOtpModalVisible(true);
            } else {
              const result = await updateRideStatus(rideData?._id, "COMPLETED");
              if (result.ok) {
                handleDeliveryComplete(result.ride ?? rideData);
              } else {
                Alert.alert("There was an error");
              }
            }
            return;
          }
        }}
        swipeColor={deliveryPhase.swipeColor}
      />

      {isOtpModalVisible && (
        <OtpInputModal
          visible={isOtpModalVisible}
          onClose={() => setOtpModalVisible(false)}
          title={otpPurpose === "delivery" ? "Enter delivery code" : "Enter OTP Below"}
          subtitle={
            otpPurpose === "delivery"
              ? isParcel
                ? getRiderParcelOtpSubtitle(parcelMode)
                : "Ask the customer for their 4-digit delivery code shown in the app before handing over the food."
              : undefined
          }
          confirmLabel={otpPurpose === "delivery" ? "Confirm delivery" : "Confirm arrival"}
          onConfirm={async (otp) => {
            if (otpPurpose === "delivery") {
              const result = await updateRideStatus(rideData?._id, "COMPLETED", otp);
              if (result.ok) {
                handleDeliveryComplete(result.ride ?? { ...rideData, status: "COMPLETED" });
              } else {
                Alert.alert(
                  "Invalid code",
                  result.message ||
                    (isParcel
                      ? getRiderParcelOtpError(parcelMode)
                      : "Ask the customer for the correct delivery code.")
                );
              }
              return;
            }
            if (otp === rideData?.otp) {
              const result = await updateRideStatus(rideData?._id, "ARRIVED", otp);
              if (result.ok) {
                setOtpModalVisible(false);
                if (result.ride) setRideData(result.ride);
              } else {
                Alert.alert("Technical Error", result.message || "Could not verify OTP.");
              }
            } else {
              Alert.alert("Wrong OTP");
            }
          }}
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
