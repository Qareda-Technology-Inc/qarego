import { View, Image, StyleSheet } from "react-native";
import { TouchableOpacity } from "@gorhom/bottom-sheet";
import React, { FC, useState } from "react";
import { useWS } from "@/service/WSProvider";
import { rideStyles } from "@/styles/rideStyles";
import { commonStyles } from "@/styles/commonStyles";
import CustomText from "../shared/CustomText";
import { getVehicleIconSource, getVehicleLabel } from "@/utils/mapUtils";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { resetAndNavigate } from "@/utils/Helpers";
import ChatModal from "../shared/ChatModal";
import { maskPhone } from "@/utils/maskPhone";
import { useUserStore } from "@/store/userStore";
import { formatCurrency, Colors } from "@/utils/Constants";
import DeliveryCodeCard from "@/components/customer/food/DeliveryCodeCard";
import { parseRideParcelMode, parcelModeLabels } from "@/utils/parcelMode";
import {
  getCustomerParcelPhase,
  getCustomerParcelStatus,
  getCustomerRouteLabels,
} from "@/utils/customerCourierUi";
import { getCommerceOrderCopy, resolveOrderVertical } from "@/utils/commerceOrderCopy";
import { ParcelTheme } from "@/styles/parcelTheme";

interface RideItem {
  _id: string;
  serviceType?: "RIDE" | "DELIVERY" | "FOOD";
  parcelMode?: "SEND" | "RECEIVE";
  vehicle?: string;
  pickup?: { address: string };
  drop?: { address: string };
  fare?: number;
  otp?: string;
  restaurantName?: string;
  storeVertical?: "FOOD" | "GROCERY" | "PHARMACY";
  foodOrderSummary?: string;
  recipientName?: string;
  recipientPhone?: string;
  parcelDescription?: string;
  parcelPhotoUrl?: string;
  deliveryOtp?: string;
  rider: any;
  status: string;
}

const LiveTrackingSheet: FC<{
  item: RideItem;
  onRateDriver?: () => void;
}> = ({ item, onRateDriver }) => {
  const { emit } = useWS();
  const { user } = useUserStore();
  const [showChat, setShowChat] = useState(false);

  const isFood = item?.serviceType === "FOOD";
  const isParcel = item?.serviceType === "DELIVERY";
  const storeCopy = getCommerceOrderCopy(
    isFood ? resolveOrderVertical({ storeVertical: item?.storeVertical, restaurantName: item?.restaurantName }) : "FOOD"
  );
  const parcelMode = parseRideParcelMode(item);
  const parcelLabels = parcelModeLabels(parcelMode);
  const routeLabels = getCustomerRouteLabels(item);
  const parcelPhase = getCustomerParcelPhase(parcelMode, item?.status, item?.recipientName);
  const parcelStatus =
    isParcel && item?.status
      ? getCustomerParcelStatus(parcelMode, item.status, item.recipientName)
      : null;
  const canChat = item?.rider && (item?.status === "START" || item?.status === "ARRIVED" || item?.status === "IN_PROGRESS");
  const isCompleted = item?.status === "COMPLETED";
  const showFoodDeliveryCode = isFood && item?.status === "IN_PROGRESS" && item?.otp;
  const showParcelDeliveryCode =
    isParcel && item?.status === "IN_PROGRESS" && item?.deliveryOtp;

  return (
    <View>
      <View style={rideStyles?.headerContainer}>
        <View style={[commonStyles.flexRowGap, { flex: 1, minWidth: 0, marginRight: 8 }]}>
          <Image
            source={getVehicleIconSource(item.vehicle ?? "motorcycle")}
            style={rideStyles.rideIcon}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            {isParcel ? (
              <View style={[styles.phaseChip, { backgroundColor: `${parcelPhase.color}1a` }]}>
                <CustomText fontSize={10} fontFamily="SemiBold" style={{ color: parcelPhase.color }}>
                  Step {parcelPhase.step} of {parcelPhase.totalSteps}
                </CustomText>
              </View>
            ) : null}
            <CustomText fontSize={10}>
              {isCompleted
                ? isFood
                  ? "Order delivered"
                  : isParcel
                    ? "Parcel delivered"
                    : "Ride completed"
                : isFood && item?.status === "START"
                  ? storeCopy.trackingCourierToStore
                  : isFood && item?.status === "ARRIVED"
                    ? "Picked up your order"
                    : isFood && item?.status === "IN_PROGRESS"
                      ? "Courier on the way"
                      : parcelStatus
                        ? parcelStatus.title
                        : item?.status === "START"
                              ? "Rider heading to you"
                              : item?.status === "ARRIVED"
                                ? "Rider arrived"
                                : item?.status === "IN_PROGRESS"
                                  ? "On the way"
                                  : "On the way"}
            </CustomText>

            <CustomText>
              {isCompleted
                ? isFood
                  ? storeCopy.liveEnjoy
                  : isParcel
                    ? "Delivery complete"
                    : "Thank you for riding with us"
                : showFoodDeliveryCode
                  ? "Share the delivery code with your recipient"
                  : showParcelDeliveryCode
                    ? parcelMode === "RECEIVE"
                      ? "Give the delivery code to your courier"
                      : "Share the delivery code with your recipient"
                  : parcelStatus
                    ? parcelStatus.subtitle
                    : !isFood && !isParcel && (item?.status === "START" || item?.status === "ARRIVED")
                      ? `OTP - ${item?.otp}`
                      : isFood
                      ? item?.restaurantName ?? storeCopy.liveDeliveryFallback
                      : isParcel && item?.recipientName
                        ? `For ${item.recipientName}`
                        : isParcel
                          ? "Parcel delivery"
                          : getVehicleLabel(item.vehicle ?? "motorcycle")}
            </CustomText>
            {isParcel ? (
              <CustomText fontSize={10} color="#64748b" style={{ marginTop: 4 }}>
                {parcelPhase.hint}
              </CustomText>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {item?.rider?.phone && (
            <CustomText fontSize={11} numberOfLines={1} fontFamily="Medium">
              {maskPhone(item.rider.phone)}
            </CustomText>
          )}
          {canChat && (
            <TouchableOpacity
              onPress={() => setShowChat(true)}
              style={{
                padding: 8,
                backgroundColor: "#f0f0f0",
                borderRadius: 20,
              }}
            >
              <Ionicons name="chatbubble-ellipses" size={18} color="#333" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showFoodDeliveryCode ? (
        <View style={{ paddingHorizontal: 10, paddingTop: 8 }}>
          <DeliveryCodeCard code={item.otp!} compact />
        </View>
      ) : null}

      {showParcelDeliveryCode ? (
        <View style={{ paddingHorizontal: 10, paddingTop: 8 }}>
          <DeliveryCodeCard
            code={item.deliveryOtp!}
            compact
            variant="parcel"
            title="Delivery code"
            hint={parcelLabels.deliveryCodeHint}
          />
        </View>
      ) : null}

      <View style={{ padding: 10 }}>
        <CustomText fontFamily="SemiBold" fontSize={12}>
          {isFood || isParcel ? "Delivery details" : "Location details"}
        </CustomText>

        {isParcel && (item?.recipientName || item?.recipientPhone) ? (
          <View style={styles.parcelMetaCard}>
            {item.recipientName ? (
              <CustomText fontSize={11} fontFamily="Medium">
                {parcelMode === "RECEIVE" ? "Customer" : "Recipient"}: {item.recipientName}
              </CustomText>
            ) : null}
            {item.recipientPhone ? (
              <CustomText fontSize={10} color="#666" style={{ marginTop: 2 }}>
                {maskPhone(item.recipientPhone)}
              </CustomText>
            ) : null}
            {item.parcelDescription ? (
              <CustomText fontSize={10} color="#666" style={{ marginTop: 4 }}>
                {item.parcelDescription}
              </CustomText>
            ) : null}
          </View>
        ) : null}

        {isFood && item?.foodOrderSummary ? (
          <CustomText fontSize={10} color="#666" style={{ marginTop: 4 }}>
            {item.foodOrderSummary}
          </CustomText>
        ) : null}

        <View style={[commonStyles.flexRowGap, styles.routeRow]}>
          <Image
            source={require("@/assets/icons/marker.png")}
            style={rideStyles.pinIcon}
          />
          <View style={{ flex: 1 }}>
            {isParcel ? (
              <CustomText fontSize={9} fontFamily="SemiBold" style={{ color: "#888", marginBottom: 2 }}>
                {routeLabels.pickupLabel}
              </CustomText>
            ) : null}
            <CustomText fontSize={10} numberOfLines={2}>
              {item?.pickup?.address}
            </CustomText>
          </View>
        </View>

        <View style={[commonStyles.flexRowGap, styles.routeRow]}>
          <Image
            source={require("@/assets/icons/drop_marker.png")}
            style={rideStyles.pinIcon}
          />
          <View style={{ flex: 1 }}>
            {isParcel ? (
              <CustomText fontSize={9} fontFamily="SemiBold" style={{ color: "#888", marginBottom: 2 }}>
                {routeLabels.dropLabel}
              </CustomText>
            ) : null}
            <CustomText fontSize={10} numberOfLines={2}>
              {item?.drop?.address}
            </CustomText>
          </View>
        </View>

        <View style={{ marginVertical: 20 }}>
          <View style={[commonStyles.flexRowBetween]}>
            <View style={commonStyles.flexRow}>
              <MaterialCommunityIcons
                name="credit-card"
                size={24}
                color="black"
              />
              <CustomText
                style={{ marginLeft: 10 }}
                fontFamily="SemiBold"
                fontSize={12}
              >
                Payment
              </CustomText>
            </View>

            <CustomText fontFamily="SemiBold" fontSize={14}>
              {formatCurrency(item.fare)}
            </CustomText>
          </View>

          <CustomText fontSize={10}>Payment via cash</CustomText>
        </View>
      </View>

      {/* Completed: prompt to rate driver */}
      {isCompleted && onRateDriver && (
        <TouchableOpacity
          onPress={onRateDriver}
          style={{
            backgroundColor: Colors.primary,
            marginHorizontal: 10,
            marginTop: 16,
            marginBottom: 8,
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
          }}
          activeOpacity={0.8}
        >
          <CustomText fontFamily="SemiBold" fontSize={16} style={{ color: "#fff" }}>
            {isParcel ? "Rate your courier" : "Rate your driver"}
          </CustomText>
          <CustomText fontSize={12} style={{ color: "rgba(255,255,255,0.9)", marginTop: 4 }}>
            {isParcel ? "How was the delivery?" : "How was your trip?"}
          </CustomText>
        </TouchableOpacity>
      )}

      <View style={rideStyles.bottomButtonContainer}>
        {!isCompleted && (
          <TouchableOpacity
            style={rideStyles.cancelButton}
            onPress={() => emit("cancelRide", item?._id)}
          >
            <CustomText style={rideStyles.cancelButtonText}>Cancel</CustomText>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[rideStyles.backButton2, isCompleted && { flex: 1 }]}
          onPress={() => {
            if (isCompleted) {
              resetAndNavigate("/customer/home");
            }
          }}
        >
          <CustomText style={rideStyles.backButtonText}>
            {isCompleted ? "Back to home" : "Back"}
          </CustomText>
        </TouchableOpacity>
      </View>

      {canChat && (
        <ChatModal
          visible={showChat}
          onClose={() => setShowChat(false)}
          rideId={item._id}
          otherUserId={item.rider?._id || item.rider}
          otherUserName={item.rider?.name ?? (isParcel ? "Courier" : "Rider")}
          otherUserPhone={item.rider?.phone}
          currentUserId={user?._id || user?.id}
          currentUserName={user?.name}
          maskedPhone={item.rider?.phone ? maskPhone(item.rider.phone) : undefined}
        />
      )}
    </View>
  );
};

export default LiveTrackingSheet;

const styles = StyleSheet.create({
  phaseChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 6,
  },
  parcelMetaCard: {
    marginTop: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    backgroundColor: "#f5f3ff",
    borderRadius: 12,
    padding: 10,
  },
  routeRow: {
    width: "90%",
    marginTop: 14,
  },
});
