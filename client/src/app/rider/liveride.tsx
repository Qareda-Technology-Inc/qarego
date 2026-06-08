import { View, Alert, TouchableOpacity, Image } from "react-native";
import React, { useEffect, useState } from "react";
import { useRiderStore } from "@/store/riderStore";
import { useWS } from "@/service/WSProvider";
import { useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import { resetAndNavigate } from "@/utils/Helpers";
import { StatusBar } from "expo-status-bar";
import { rideStyles } from "@/styles/rideStyles";
import RiderLiveTracking from "@/components/rider/RiderLiveTracking";
import { updateRideStatus, getRideById } from "@/service/rideService";
import { isFoodDelivery } from "@/utils/riderRideUtils";
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
import { resolveMediaUrl } from "@/service/mediaUpload";
import { parseRideParcelMode, parcelModeLabels } from "@/utils/parcelMode";
import {
  getRiderCourierUi,
  getRiderSwipeTitle,
  getRiderParcelCollectedAlert,
  getRiderParcelDeliveryStartedAlert,
  getRiderParcelOtpSubtitle,
  getRiderParcelOtpError,
} from "@/utils/riderCourierUi";
import { getCommerceOrderCopy } from "@/utils/commerceOrderCopy";

type OtpPurpose = "pickup" | "delivery";

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
  const parcelLabels = parcelModeLabels(parcelMode);
  const parcelPhotoSrc = rideData?.parcelPhotoUrl
    ? resolveMediaUrl(rideData.parcelPhotoUrl)
    : null;
  const canChat =
    rideData?.customer &&
    (rideData?.status === "START" ||
      rideData?.status === "ARRIVED" ||
      rideData?.status === "IN_PROGRESS");
  const courierUi = getRiderCourierUi(rideData);

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

  useEffect(() => {
    if (id) {
      emit("subscribeRide", id);

      getRideById(id).then((ride) => {
        if (ride) setRideData(ride);
      });

      on("rideData", (data) => {
        setRideData(data);
        if (data?.status === "COMPLETED") {
          setShowCostPopup(true);
        }
      });

      on("rideCanceled", (error) => {
        console.log("Ride error:", error);
        resetAndNavigate("/rider/home");
        Alert.alert("Ride Canceled");
      });

      on("rideUpdate", (data) => {
        setRideData(data);
        if (data?.status === "COMPLETED") {
          setShowCostPopup(true);
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
  }, [id, emit, on, off]);

  const handleCostPopupClose = () => {
    setShowCostPopup(false);
    resetAndNavigate("/rider/home");
  };

  return (
    <View style={rideStyles.container}>
      <StatusBar style="light" backgroundColor="orange" translucent={false} />

      {rideData && (
        <>
          <RiderLiveTracking
            status={rideData?.status}
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
          {isParcel && (rideData?.recipientName || parcelPhotoSrc) ? (
            <View
              style={{
                position: "absolute",
                top: 52,
                left: 12,
                right: 12,
                backgroundColor: "rgba(245, 243, 255, 0.97)",
                padding: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#DDD6FE",
                zIndex: 5,
              }}
            >
              <CustomText fontFamily="SemiBold" fontSize={12} style={{ color: "#4C1D95" }}>
                📦 {parcelLabels.riderBadge}
              </CustomText>
              {rideData?.recipientName ? (
                <CustomText fontSize={11} style={{ marginTop: 4, color: "#444" }}>
                  {parcelMode === "RECEIVE" ? "Customer" : "To"}: {rideData.recipientName}
                  {rideData?.recipientPhone ? ` · ${rideData.recipientPhone}` : ""}
                </CustomText>
              ) : null}
              {rideData?.parcelDescription ? (
                <CustomText fontSize={11} numberOfLines={2} style={{ marginTop: 4, color: "#666" }}>
                  {rideData.parcelDescription}
                </CustomText>
              ) : null}
              {parcelPhotoSrc ? (
                <Image
                  source={{ uri: parcelPhotoSrc }}
                  style={{
                    width: "100%",
                    height: 100,
                    borderRadius: 8,
                    marginTop: 8,
                    backgroundColor: "#E2E8F0",
                  }}
                  resizeMode="cover"
                />
              ) : null}
            </View>
          ) : null}
          {isFoodDelivery(rideData) && rideData?.foodOrderSummary ? (
            <View
              style={{
                position: "absolute",
                top: 52,
                left: 12,
                right: 12,
                backgroundColor: "rgba(255, 247, 237, 0.95)",
                padding: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#f97316",
                zIndex: 5,
              }}
            >
              <CustomText fontFamily="SemiBold" fontSize={12} style={{ color: "#c2410c" }}>
                {getCommerceOrderCopy(rideData?.storeVertical).storeEmoji}{" "}
                {rideData.restaurantName || getCommerceOrderCopy(rideData?.storeVertical).liveDeliveryFallback}
              </CustomText>
              <CustomText fontSize={11} numberOfLines={2} style={{ marginTop: 4, color: "#444" }}>
                {rideData.foodOrderSummary}
              </CustomText>
            </View>
          ) : null}
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
              style={{
                position: "absolute",
                bottom: 100,
                right: 15,
                backgroundColor: "#fff",
                padding: 12,
                borderRadius: 30,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
                zIndex: 10,
              }}
            >
              <Ionicons name="chatbubble-ellipses" size={24} color="#333" />
            </TouchableOpacity>
          )}
        </>
      )}

      <RiderActionButton
        ride={rideData}
        title={getRiderSwipeTitle(rideData)}
        meetLabel={courierUi.meetLabel}
        contactPhone={courierUi.contactPhone}
        pickupLabel={courierUi.pickupLabel}
        dropLabel={courierUi.dropLabel}
        onPress={async () => {
          if (rideData?.status === "START") {
            if (isFood || isParcel) {
              const isSuccess = await updateRideStatus(rideData?._id, "ARRIVED");
              if (isSuccess) {
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
            const isSuccess = await updateRideStatus(rideData?._id, "IN_PROGRESS");
            if (isSuccess) {
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
              const isSuccess = await updateRideStatus(rideData?._id, "COMPLETED");
              if (isSuccess) {
                setShowCostPopup(true);
              } else {
                Alert.alert("There was an error");
              }
            }
            return;
          }
        }}
        color={
          rideData?.status === "START"
            ? "#FF9800"
            : rideData?.status === "ARRIVED"
            ? "#4CAF50"
            : rideData?.status === "IN_PROGRESS"
            ? "#228B22"
            : "#228B22"
        }
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
          onConfirm={async (otp) => {
            if (otpPurpose === "delivery") {
              const isSuccess = await updateRideStatus(
                rideData?._id,
                "COMPLETED",
                otp
              );
              if (isSuccess) {
                setOtpModalVisible(false);
                setShowCostPopup(true);
              } else {
                Alert.alert(
                  "Invalid code",
                  isParcel
                    ? getRiderParcelOtpError(parcelMode)
                    : "Ask the customer for the correct delivery code."
                );
              }
              return;
            }
            if (otp === rideData?.otp) {
              const isSuccess = await updateRideStatus(
                rideData?._id,
                "ARRIVED",
                otp
              );
              if (isSuccess) {
                setOtpModalVisible(false);
              } else {
                Alert.alert("Technical Error");
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
