import React, { FC } from "react";
import { View, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { DS } from "@/theme/designSystem";
import { getCommerceOrderCopy } from "@/utils/commerceOrderCopy";
import { isFoodDelivery } from "@/utils/riderRideUtils";
import { parseRideParcelMode, parcelModeLabels } from "@/utils/parcelMode";
import { resolveMediaUrl } from "@/service/mediaUpload";

type Props = {
  ride: {
    serviceType?: string;
    parcelMode?: unknown;
    storeVertical?: string;
    restaurantName?: string;
    foodOrderSummary?: string;
    recipientName?: string;
    recipientPhone?: string;
    parcelDescription?: string;
    parcelPhotoUrl?: string;
  };
};

const RiderDeliveryBanner: FC<Props> = ({ ride }) => {
  const food = isFoodDelivery(ride);
  const isParcel = ride?.serviceType === "DELIVERY";
  const parcelMode = parseRideParcelMode(ride);
  const parcelLabels = parcelModeLabels(parcelMode);
  const commerceCopy = getCommerceOrderCopy(ride?.storeVertical);
  const photoUri = ride?.parcelPhotoUrl ? resolveMediaUrl(ride.parcelPhotoUrl) : null;

  if (food && ride.foodOrderSummary) {
    return (
      <View style={[styles.card, styles.foodCard]}>
        <View style={styles.row}>
          <View style={styles.iconBadge}>
            <CustomText fontSize={18}>{commerceCopy.storeEmoji}</CustomText>
          </View>
          <View style={styles.body}>
            <CustomText fontFamily="SemiBold" fontSize={14} style={styles.foodTitle}>
              {ride.restaurantName || commerceCopy.liveDeliveryFallback}
            </CustomText>
            <CustomText fontSize={12} color={DS.color.textMuted} numberOfLines={2}>
              {ride.foodOrderSummary}
            </CustomText>
          </View>
        </View>
      </View>
    );
  }

  if (isParcel && (ride.recipientName || photoUri || ride.parcelDescription)) {
    return (
      <View style={[styles.card, styles.parcelCard]}>
        <View style={styles.row}>
          <View style={[styles.iconBadge, styles.parcelBadge]}>
            <Ionicons name="cube-outline" size={20} color="#6d28d9" />
          </View>
          <View style={styles.body}>
            <CustomText fontFamily="SemiBold" fontSize={13} style={styles.parcelTitle}>
              {parcelLabels.riderBadge}
            </CustomText>
            {ride.recipientName ? (
              <CustomText fontSize={12} color={DS.color.textMuted}>
                {parcelMode === "RECEIVE" ? "Customer" : "To"}: {ride.recipientName}
                {ride.recipientPhone ? ` · ${ride.recipientPhone}` : ""}
              </CustomText>
            ) : null}
            {ride.parcelDescription ? (
              <CustomText fontSize={11} color={DS.color.textSoft} numberOfLines={2} style={{ marginTop: 4 }}>
                {ride.parcelDescription}
              </CustomText>
            ) : null}
          </View>
        </View>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.parcelPhoto} resizeMode="cover" />
        ) : null}
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 56,
    left: 12,
    right: 12,
    borderRadius: 16,
    padding: 14,
    zIndex: 5,
    ...DS.shadow.card,
  },
  foodCard: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  parcelCard: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "#ddd6fe",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff7ed",
    alignItems: "center",
    justifyContent: "center",
  },
  parcelBadge: {
    backgroundColor: "#f5f3ff",
  },
  body: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  foodTitle: {
    color: "#c2410c",
    marginBottom: 4,
  },
  parcelTitle: {
    color: "#5b21b6",
    marginBottom: 4,
  },
  parcelPhoto: {
    width: "100%",
    height: 96,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: "#e2e8f0",
  },
});

export default RiderDeliveryBanner;
