import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import { TouchableOpacity as BottomSheetTouchable } from "@gorhom/bottom-sheet";
import React, { FC, useCallback, useState } from "react";
import { useWS } from "@/service/WSProvider";
import CustomText from "../shared/CustomText";
import { getVehicleIconSource, getVehicleLabel } from "@/utils/mapUtils";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
import { openMapsRoute, openMapsToPoint, type MapPoint } from "@/utils/openMapsNavigation";

interface RideItem {
  _id: string;
  serviceType?: "RIDE" | "DELIVERY" | "FOOD";
  parcelMode?: "SEND" | "RECEIVE";
  vehicle?: string;
  paymentMethod?: "CASH" | "MOBILE_MONEY";
  paymentStatus?: string;
  pickup?: MapPoint;
  drop?: MapPoint;
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

function getStatusTitle(item: RideItem, isFood: boolean, isParcel: boolean, storeCopy: ReturnType<typeof getCommerceOrderCopy>, parcelStatus: { title: string } | null) {
  if (item.status === "COMPLETED") {
    if (isFood) return "Order delivered";
    if (isParcel) return "Parcel delivered";
    return "Ride completed";
  }
  if (isFood && item.status === "START") return storeCopy.trackingCourierToStore;
  if (isFood && item.status === "ARRIVED") return "Picked up your order";
  if (isFood && item.status === "IN_PROGRESS") return "Courier on the way";
  if (parcelStatus) return parcelStatus.title;
  if (item.status === "START") return "Rider heading to you";
  if (item.status === "ARRIVED") return "Rider has arrived";
  if (item.status === "IN_PROGRESS") return "On the way to destination";
  return "Trip in progress";
}

function getStatusSubtitle(
  item: RideItem,
  isFood: boolean,
  isParcel: boolean,
  storeCopy: ReturnType<typeof getCommerceOrderCopy>,
  parcelStatus: { subtitle: string } | null
) {
  if (item.status === "COMPLETED") {
    if (isFood) return storeCopy.liveEnjoy;
    if (isParcel) return "Delivery complete";
    return "Thank you for riding with us";
  }
  if (parcelStatus) return parcelStatus.subtitle;
  if (isFood) return item.restaurantName ?? storeCopy.liveDeliveryFallback;
  if (isParcel && item.recipientName) return `For ${item.recipientName}`;
  if (isParcel) return "Parcel delivery";
  return getVehicleLabel(item.vehicle ?? "motorcycle");
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
  const isRide = !isFood && !isParcel;
  const storeCopy = getCommerceOrderCopy(
    isFood ? resolveOrderVertical({ storeVertical: item?.storeVertical, restaurantName: item?.restaurantName }) : "FOOD"
  );
  const parcelMode = parseRideParcelMode(item);
  const parcelLabels = parcelModeLabels(parcelMode);
  const routeLabels = getCustomerRouteLabels(item);
  const parcelPhase = getCustomerParcelPhase(parcelMode, item?.status, item?.recipientName);
  const parcelStatus =
    isParcel && item?.status ? getCustomerParcelStatus(parcelMode, item.status, item.recipientName) : null;
  const canChat =
    item?.rider && (item?.status === "START" || item?.status === "ARRIVED" || item?.status === "IN_PROGRESS");
  const isCompleted = item?.status === "COMPLETED";
  const isActive = !isCompleted;
  const showRideOtp = isRide && item?.otp && (item.status === "START" || item.status === "ARRIVED");
  const showFoodDeliveryCode = isFood && item?.status === "IN_PROGRESS" && item?.otp;
  const showParcelDeliveryCode = isParcel && item?.status === "IN_PROGRESS" && item?.deliveryOtp;
  const riderName = item?.rider?.name ?? (isParcel ? "Your courier" : "Your rider");

  const statusTitle = getStatusTitle(item, isFood, isParcel, storeCopy, parcelStatus);
  const statusSubtitle = getStatusSubtitle(item, isFood, isParcel, storeCopy, parcelStatus);

  const handleCallRider = useCallback(() => {
    const phone = item?.rider?.phone;
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  }, [item?.rider?.phone]);

  const handleNavigateRoute = useCallback(() => {
    if (item?.pickup && item?.drop) openMapsRoute(item.pickup, item.drop);
  }, [item?.pickup, item?.drop]);

  const handleNavigatePickup = useCallback(() => {
    if (item?.pickup) openMapsToPoint(item.pickup, routeLabels.pickupLabel);
  }, [item?.pickup, routeLabels.pickupLabel]);

  const handleNavigateDrop = useCallback(() => {
    if (item?.drop) openMapsToPoint(item.drop, routeLabels.dropLabel);
  }, [item?.drop, routeLabels.dropLabel]);

  return (
    <View style={styles.container}>
      {/* Status + rider */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.iconRing}>
            <Image
              source={getVehicleIconSource(item.vehicle ?? "motorcycle")}
              style={styles.vehicleIcon}
            />
          </View>
          <View style={styles.heroText}>
            {isParcel ? (
              <View style={[styles.phaseChip, { backgroundColor: `${parcelPhase.color}18` }]}>
                <CustomText fontSize={10} fontFamily="SemiBold" style={{ color: parcelPhase.color }}>
                  Step {parcelPhase.step} of {parcelPhase.totalSteps}
                </CustomText>
              </View>
            ) : null}
            <CustomText fontFamily="Bold" fontSize={17} style={styles.heroTitle}>
              {statusTitle}
            </CustomText>
            <CustomText fontSize={13} style={styles.heroSubtitle} numberOfLines={2}>
              {statusSubtitle}
            </CustomText>
          </View>
        </View>

        {item?.rider && isActive ? (
          <View style={styles.riderRow}>
            <View style={styles.riderInfo}>
              <CustomText fontFamily="SemiBold" fontSize={14}>
                {riderName}
              </CustomText>
              {item.rider?.phone ? (
                <CustomText fontSize={12} style={{ color: "#64748b", marginTop: 2 }}>
                  {maskPhone(item.rider.phone)}
                </CustomText>
              ) : null}
            </View>
            <View style={styles.riderActions}>
              {item.rider?.phone ? (
                <TouchableOpacity style={styles.actionBtn} onPress={handleCallRider} activeOpacity={0.85}>
                  <Ionicons name="call-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
              ) : null}
              {canChat ? (
                <TouchableOpacity style={styles.actionBtn} onPress={() => setShowChat(true)} activeOpacity={0.85}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {showRideOtp ? (
        <View style={styles.otpCard}>
          <CustomText fontSize={11} fontFamily="SemiBold" style={styles.otpLabel}>
            Share this code with your rider
          </CustomText>
          <CustomText fontFamily="Bold" fontSize={32} style={styles.otpCode}>
            {item.otp}
          </CustomText>
          <CustomText fontSize={11} style={styles.otpHint}>
            Rider will ask for this when they arrive
          </CustomText>
        </View>
      ) : null}

      {showFoodDeliveryCode ? (
        <View style={styles.codeWrap}>
          <DeliveryCodeCard code={item.otp!} compact />
        </View>
      ) : null}

      {showParcelDeliveryCode ? (
        <View style={styles.codeWrap}>
          <DeliveryCodeCard
            code={item.deliveryOtp!}
            compact
            variant="parcel"
            title="Delivery code"
            hint={parcelLabels.deliveryCodeHint}
          />
        </View>
      ) : null}

      {isParcel && (item?.recipientName || item?.recipientPhone || item?.parcelDescription) ? (
        <View style={styles.recipientBanner}>
          {item.recipientName ? (
            <CustomText fontSize={12} fontFamily="Medium">
              {parcelMode === "RECEIVE" ? "Customer" : "Recipient"}: {item.recipientName}
            </CustomText>
          ) : null}
          {item.recipientPhone ? (
            <CustomText fontSize={11} style={{ color: "#64748b", marginTop: 2 }}>
              {maskPhone(item.recipientPhone)}
            </CustomText>
          ) : null}
          {item.parcelDescription ? (
            <CustomText fontSize={11} style={{ color: "#64748b", marginTop: 4 }}>
              {item.parcelDescription}
            </CustomText>
          ) : null}
        </View>
      ) : null}

      {isFood && item?.foodOrderSummary ? (
        <View style={styles.orderSummary}>
          <CustomText fontSize={12} style={{ color: "#475569" }}>
            {item.foodOrderSummary}
          </CustomText>
        </View>
      ) : null}

      <View style={styles.routeCard}>
        <View style={styles.routeCardHeader}>
          <CustomText fontFamily="SemiBold" fontSize={13} style={styles.routeCardTitle}>
            Your route
          </CustomText>
          <TouchableOpacity style={styles.routeNavPill} onPress={handleNavigateRoute} activeOpacity={0.85}>
            <Ionicons name="map-outline" size={14} color={Colors.primary} />
            <CustomText fontSize={11} fontFamily="SemiBold" style={{ color: Colors.primary }}>
              Open in Maps
            </CustomText>
          </TouchableOpacity>
        </View>

        <View style={styles.stopRow}>
          <View style={styles.timelineCol}>
            <View style={[styles.dot, styles.dotPickup]} />
            <View style={styles.connector} />
          </View>
          <View style={styles.stopBody}>
            <CustomText fontSize={10} fontFamily="SemiBold" style={styles.stopLabel}>
              {routeLabels.pickupLabel}
            </CustomText>
            <CustomText fontSize={13} numberOfLines={2} style={styles.stopAddress}>
              {item?.pickup?.address || "Pickup location"}
            </CustomText>
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={handleNavigatePickup} activeOpacity={0.8}>
            <Ionicons name="navigate" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.stopRow}>
          <View style={styles.timelineCol}>
            <View style={[styles.dot, styles.dotDrop]} />
          </View>
          <View style={styles.stopBody}>
            <CustomText fontSize={10} fontFamily="SemiBold" style={styles.stopLabel}>
              {routeLabels.dropLabel}
            </CustomText>
            <CustomText fontSize={13} numberOfLines={2} style={styles.stopAddress}>
              {item?.drop?.address || "Destination"}
            </CustomText>
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={handleNavigateDrop} activeOpacity={0.8}>
            <Ionicons name="navigate" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.fareCard}>
        <View style={styles.fareLeft}>
          <MaterialCommunityIcons name="credit-card-outline" size={20} color="#64748b" />
          <View style={{ marginLeft: 10 }}>
            <CustomText fontFamily="SemiBold" fontSize={13}>
              {item?.paymentMethod === "MOBILE_MONEY" ? "Mobile money" : "Cash"}
            </CustomText>
            <CustomText fontSize={11} style={{ color: "#94a3b8", marginTop: 1 }}>
              {item?.paymentMethod === "MOBILE_MONEY"
                ? item?.paymentStatus === "PAID"
                  ? "Paid"
                  : "Pay when trip ends"
                : "Pay driver directly"}
            </CustomText>
          </View>
        </View>
        <CustomText fontFamily="Bold" fontSize={17}>
          {formatCurrency(item.fare)}
        </CustomText>
      </View>

      {isCompleted && onRateDriver ? (
        <TouchableOpacity style={styles.rateBtn} onPress={onRateDriver} activeOpacity={0.85}>
          <CustomText fontFamily="SemiBold" fontSize={16} style={{ color: "#fff" }}>
            {isParcel ? "Rate your courier" : "Rate your driver"}
          </CustomText>
          <CustomText fontSize={12} style={{ color: "rgba(255,255,255,0.9)", marginTop: 4 }}>
            {isParcel ? "How was the delivery?" : "How was your trip?"}
          </CustomText>
        </TouchableOpacity>
      ) : null}

      {isActive ? (
        <BottomSheetTouchable
          style={styles.cancelBtn}
          onPress={() => emit("cancelRide", item?._id)}
          activeOpacity={0.85}
        >
          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.cancelText}>
            Cancel trip
          </CustomText>
        </BottomSheetTouchable>
      ) : (
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => resetAndNavigate("/customer/home")}
          activeOpacity={0.85}
        >
          <CustomText fontFamily="SemiBold" fontSize={15} style={{ color: "#fff" }}>
            Back to home
          </CustomText>
        </TouchableOpacity>
      )}

      {canChat ? (
        <ChatModal
          visible={showChat}
          onClose={() => setShowChat(false)}
          rideId={item._id}
          otherUserId={item.rider?._id || item.rider}
          otherUserName={riderName}
          otherUserPhone={item.rider?.phone}
          currentUserId={user?._id || user?.id}
          currentUserName={user?.name}
          maskedPhone={item.rider?.phone ? maskPhone(item.rider.phone) : undefined}
        />
      ) : null}
    </View>
  );
};

export default LiveTrackingSheet;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fef9e7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fde68a",
  },
  vehicleIcon: {
    width: 34,
    height: 34,
    resizeMode: "contain",
  },
  heroText: {
    flex: 1,
  },
  phaseChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    marginBottom: 4,
  },
  heroTitle: {
    color: "#0f172a",
  },
  heroSubtitle: {
    color: "#64748b",
    marginTop: 2,
  },
  riderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  riderInfo: {
    flex: 1,
  },
  riderActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  otpCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  otpLabel: {
    color: "#92400e",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  otpCode: {
    color: Colors.primary,
    marginVertical: 8,
    letterSpacing: 8,
  },
  otpHint: {
    color: "#78716c",
    textAlign: "center",
  },
  codeWrap: {
    marginBottom: 14,
  },
  recipientBanner: {
    backgroundColor: "#f5f3ff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#ddd6fe",
  },
  orderSummary: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  routeCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  routeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  routeCardTitle: {
    color: "#334155",
  },
  routeNavPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  timelineCol: {
    alignItems: "center",
    width: 14,
    paddingTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotPickup: {
    backgroundColor: "#22c55e",
  },
  dotDrop: {
    backgroundColor: "#ef4444",
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: "#e2e8f0",
    marginVertical: 4,
  },
  stopBody: {
    flex: 1,
    paddingBottom: 14,
  },
  stopLabel: {
    color: "#94a3b8",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  stopAddress: {
    color: "#1e293b",
    lineHeight: 18,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 2,
  },
  fareCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  fareLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rateBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  cancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  cancelText: {
    color: "#dc2626",
  },
  homeBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
});
