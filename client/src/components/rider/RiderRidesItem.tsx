import { View, Image, TouchableOpacity, StyleSheet } from "react-native";
import React, { FC, memo } from "react";
import { useRiderStore } from "@/store/riderStore";
import { acceptRideOffer, declineRideOffer } from "@/service/rideService";
import Animated, { FadeInLeft } from "react-native-reanimated";
import { orderStyles } from "@/styles/riderStyles";
import { commonStyles } from "@/styles/commonStyles";
import CustomText from "../shared/CustomText";
import { calculateDistance, getVehicleIconSource, getVehicleLabel } from "@/utils/mapUtils";
import { formatCurrency } from "@/utils/Constants";
import {
  getRiderOfferBadge,
  getRiderPickupLabel,
  getRiderDropLabel,
  isFoodDelivery,
} from "@/utils/riderRideUtils";
import { getCommerceOrderCopy } from "@/utils/commerceOrderCopy";
import { getOfferEarningsBreakdown } from "@/utils/offerRanking";
import { serviceCommissionLabel } from "@/utils/earningsBreakdown";
import { Ionicons } from "@expo/vector-icons";
import CounterButton from "./CounterButton";
import CashCollectionNote, { type RideCashCollection } from "./CashCollectionNote";
import { resolveMediaUrl } from "@/service/mediaUpload";

interface RideItem {
  _id: string;
  vehicle?: string;
  serviceType?: "RIDE" | "DELIVERY" | "FOOD";
  restaurantName?: string;
  storeVertical?: "FOOD" | "GROCERY" | "PHARMACY";
  foodOrderSummary?: string;
  cashCollection?: RideCashCollection | null;
  pickup: { address: string; latitude: number; longitude: number };
  drop?: { address: string; latitude: number; longitude: number };
  fare?: number;
  distance: number;
  customer?: {
    name?: string;
    phone?: string;
    averageRating?: number;
    totalRatings?: number;
  };
  parcelMode?: "SEND" | "RECEIVE";
  recipientName?: string;
  recipientPhone?: string;
  parcelDescription?: string;
  parcelPhotoUrl?: string;
  deliveryNote?: string;
  dispatchMeta?: {
    netEarning?: number;
    grossFare?: number;
    commissionRate?: number;
    commissionAmount?: number;
    commissionPercent?: number;
    earningsPerKm?: number;
    pickupKm?: number | null;
    tripKm?: number;
    rankHint?: string;
    serviceType?: string;
  };
}

/**
 * Seconds a rider has to accept. Client-side only: the server keeps the ride open and
 * widens the offer to more riders every 12s, so this can safely be longer than one wave.
 */
const OFFER_SECONDS = 20;

const RiderRidesItem: FC<{ item: RideItem; removeIt: () => void; isBestOffer?: boolean }> = ({
  item,
  removeIt,
  isBestOffer = false,
}) => {
  const { location } = useRiderStore();
  const badge = getRiderOfferBadge(item);
  const food = isFoodDelivery(item);
  const commerceCopy = getCommerceOrderCopy(item.storeVertical);
  const fare = Number(item?.fare ?? 0);
  const earningsBreakdown = getOfferEarningsBreakdown(item);
  const netEarning = earningsBreakdown?.netEarning ?? null;
  const metaPickupKm = item?.dispatchMeta?.pickupKm;
  const pickupKm =
    metaPickupKm != null
      ? String(metaPickupKm)
      : location &&
          item?.pickup?.latitude != null &&
          item?.pickup?.longitude != null
        ? calculateDistance(
            item.pickup.latitude,
            item.pickup.longitude,
            location.latitude,
            location.longitude
          ).toFixed(2)
        : "--";
  const earningsPerKm = item?.dispatchMeta?.earningsPerKm;
  const rankHint = isBestOffer ? item?.dispatchMeta?.rankHint : null;

  const dismissOffer = () => {
    if (item?._id) declineRideOffer(item._id);
    removeIt();
  };

  const acceptRide = async () => {
    removeIt();
    acceptRideOffer(item?._id);
  };

  return (
    <Animated.View
      entering={FadeInLeft.duration(400)}
      style={[orderStyles.container, isBestOffer && orderStyles.bestOfferCard]}
    >
      {isBestOffer ? (
        <View style={orderStyles.bestOfferBadge}>
          <Ionicons name="flash" size={12} color="#fff" />
          <CustomText fontSize={10} fontFamily="SemiBold" style={{ color: "#fff", marginLeft: 4 }}>
            Best match
          </CustomText>
        </View>
      ) : null}
      {rankHint ? (
        <CustomText fontSize={10} style={orderStyles.rankHint} numberOfLines={1}>
          {rankHint}
        </CustomText>
      ) : null}
      <View style={[commonStyles.flexRowBetween, { marginBottom: 8 }]}>
        <View style={[commonStyles.flexRow, { flex: 1 }]}>
          <Image
            source={getVehicleIconSource(item.vehicle ?? "motorcycle")}
            style={orderStyles.rideIcon}
          />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <CustomText style={{ textTransform: "capitalize" }} fontSize={12} fontFamily="SemiBold">
              {(item as { gasLeg?: string }).gasLeg === "COLLECT"
                ? "Gas refill · collect & return"
                : food
                  ? commerceCopy.riderOfferTitle
                  : getVehicleLabel(item?.vehicle ?? "motorcycle")}
            </CustomText>
            <CustomText fontSize={10} style={orderStyles.label}>
              #{item?._id?.slice(0, 8).toUpperCase()}
            </CustomText>
          </View>
          {(item.serviceType === "DELIVERY" || item.serviceType === "FOOD") && (
            <View style={[orderStyles.offerTypeBadge, { backgroundColor: badge.color }]}>
              <CustomText fontSize={10} fontFamily="SemiBold" style={{ color: "#fff" }}>
                {badge.label}
              </CustomText>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={dismissOffer} hitSlop={8}>
          <Ionicons name="close-circle" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Earnings first: one prominent number, distance and pay rate beside it. */}
      <View style={styles.earnRow}>
        <View style={{ flex: 1 }}>
          <CustomText fontSize={10} style={orderStyles.label}>
            {netEarning != null ? "You receive" : "Estimated earning"}
          </CustomText>
          <CustomText fontSize={22} fontFamily="Bold" style={styles.earnValue}>
            {netEarning != null
              ? formatCurrency(netEarning)
              : fare > 0
                ? formatCurrency(fare)
                : "—"}
          </CustomText>
        </View>
        <View style={styles.earnMeta}>
          <CustomText fontSize={11} fontFamily="SemiBold">
            {pickupKm} km to pickup
          </CustomText>
          {earningsPerKm != null ? (
            <CustomText fontSize={10} style={orderStyles.label}>
              {formatCurrency(earningsPerKm)} / km
            </CustomText>
          ) : null}
        </View>
      </View>
      {earningsBreakdown ? (
        <CustomText fontSize={10} style={[orderStyles.label, styles.fareLine]}>
          {earningsBreakdown.commissionAmount > 0
            ? `Fare ${formatCurrency(earningsBreakdown.grossFare)} − ${formatCurrency(
                earningsBreakdown.commissionAmount
              )} commission (${earningsBreakdown.commissionPercent}% · ${serviceCommissionLabel(
                earningsBreakdown.serviceType
              )})`
            : `Fare ${formatCurrency(earningsBreakdown.grossFare)} · no commission`}
        </CustomText>
      ) : null}

      {food && (item.restaurantName || item.foodOrderSummary) ? (
        <View style={orderStyles.infoPanel}>
          {item.restaurantName ? (
            <CustomText fontSize={12} fontFamily="SemiBold" numberOfLines={1}>
              {item.restaurantName}
            </CustomText>
          ) : null}
          {item.foodOrderSummary ? (
            <CustomText fontSize={10} fontFamily="Medium" style={orderStyles.label} numberOfLines={2}>
              {item.foodOrderSummary}
            </CustomText>
          ) : null}
          <CashCollectionNote cash={item.cashCollection} step="offer" />
        </View>
      ) : null}

      <View style={orderStyles?.locationsContainer}>
        <View style={orderStyles?.flexRowBase}>
          <View>
            <View style={orderStyles?.pickupHollowCircle} />
            <View style={orderStyles?.continuousLine} />
          </View>
          <View style={orderStyles?.infoText}>
            <CustomText fontSize={9} fontFamily="SemiBold" style={orderStyles.label}>
              {getRiderPickupLabel(item)}
            </CustomText>
            <CustomText fontSize={11} numberOfLines={1} fontFamily="SemiBold">
              {item?.pickup?.address?.slice(0, 20)}
            </CustomText>
            <CustomText
              numberOfLines={2}
              fontSize={9.5}
              fontFamily="Medium"
              style={orderStyles.label}
            >
              {item?.pickup?.address}
            </CustomText>
          </View>
        </View>

        <View style={orderStyles.flexRowBase}>
          <View style={orderStyles.dropHollowCircle} />
          <View style={orderStyles.infoText}>
            <CustomText fontSize={9} fontFamily="SemiBold" style={orderStyles.label}>
              {getRiderDropLabel(item)}
            </CustomText>
            <CustomText fontSize={11} numberOfLines={1} fontFamily="SemiBold">
              {item?.drop?.address?.slice(0, 20)}
            </CustomText>
            <CustomText
              numberOfLines={2}
              fontSize={9.5}
              fontFamily="Medium"
              style={orderStyles.label}
            >
              {item?.drop?.address}
            </CustomText>
          </View>
        </View>
      </View>

      {item.serviceType === "DELIVERY" &&
        (item.recipientName || item.recipientPhone || item.parcelDescription || item.parcelPhotoUrl) && (
        <View style={orderStyles.infoPanel}>
          <CustomText fontSize={9} fontFamily="SemiBold" style={orderStyles.label}>
            {item.parcelMode === "RECEIVE" ? "Customer" : "Recipient"}
          </CustomText>
          <CustomText fontSize={10} fontFamily="Medium" numberOfLines={1}>
            {/* Offers carry no phone numbers; the rider gets them after accepting. */}
            {[item.recipientName, item.recipientPhone].filter(Boolean).join(" · ") || "—"}
          </CustomText>
          {item.parcelDescription ? (
            <CustomText fontSize={9.5} fontFamily="Medium" style={orderStyles.label} numberOfLines={2}>
              {item.parcelDescription}
            </CustomText>
          ) : null}
          {item.parcelPhotoUrl ? (
            <Image
              source={{ uri: resolveMediaUrl(item.parcelPhotoUrl) ?? undefined }}
              style={{
                width: "100%",
                height: 72,
                borderRadius: 8,
                marginTop: 6,
                backgroundColor: "#E2E8F0",
              }}
              resizeMode="cover"
            />
          ) : null}
        </View>
      )}

      <View style={styles.acceptWrap}>
        <CounterButton
          onCountdownEnd={dismissOffer}
          initialCount={OFFER_SECONDS}
          onPress={acceptRide}
          title={food ? "Accept delivery" : "Accept"}
          fullWidth
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  earnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 2,
  },
  earnValue: {
    color: "#15803d",
  },
  earnMeta: {
    alignItems: "flex-end",
  },
  fareLine: {
    marginTop: 2,
  },
  acceptWrap: {
    marginTop: 10,
  },
});

export default memo(RiderRidesItem);
