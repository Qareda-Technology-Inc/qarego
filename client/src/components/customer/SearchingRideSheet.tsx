import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import React, { FC, useCallback } from "react";
import { useWS } from "@/service/WSProvider";
import CustomText from "../shared/CustomText";
import { getVehicleIconSource, getVehicleLabel } from "@/utils/mapUtils";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { formatCurrency, Colors } from "@/utils/Constants";
import { parseRideParcelMode, parcelModeLabels } from "@/utils/parcelMode";
import { getCustomerParcelPhase, getCustomerRouteLabels } from "@/utils/customerCourierUi";
import { openMapsRoute, openMapsToPoint, type MapPoint } from "@/utils/openMapsNavigation";

interface RideItem {
  serviceType?: "RIDE" | "DELIVERY" | "FOOD";
  parcelMode?: "SEND" | "RECEIVE";
  vehicle?: string;
  paymentMethod?: "CASH" | "MOBILE_MONEY";
  _id: string;
  pickup?: MapPoint;
  drop?: MapPoint;
  fare?: number;
  recipientName?: string;
}

const SearchingRideSheet: FC<{ item: RideItem }> = ({ item }) => {
  const { emit } = useWS();
  const isParcel = item?.serviceType === "DELIVERY";
  const parcelMode = parseRideParcelMode(item);
  const parcelLabels = parcelModeLabels(parcelMode);
  const routeLabels = getCustomerRouteLabels(item);
  const parcelPhase = getCustomerParcelPhase(parcelMode, "START", item?.recipientName);
  const vehicleLabel = getVehicleLabel(item?.vehicle ?? "motorcycle");

  const handleNavigatePickup = useCallback(() => {
    if (item?.pickup) openMapsToPoint(item.pickup, routeLabels.pickupLabel);
  }, [item?.pickup, routeLabels.pickupLabel]);

  const handleNavigateDrop = useCallback(() => {
    if (item?.drop) openMapsToPoint(item.drop, routeLabels.dropLabel);
  }, [item?.drop, routeLabels.dropLabel]);

  const handleNavigateRoute = useCallback(() => {
    if (item?.pickup && item?.drop) openMapsRoute(item.pickup, item.drop);
  }, [item?.pickup, item?.drop]);

  return (
    <View style={styles.container}>
      <View style={styles.searchHero}>
        <View style={styles.iconRing}>
          <Image
            source={getVehicleIconSource(item?.vehicle ?? "motorcycle")}
            style={styles.vehicleIcon}
          />
        </View>
        <View style={styles.searchHeroText}>
          {isParcel ? (
            <View style={[styles.phaseChip, { backgroundColor: `${parcelPhase.color}18` }]}>
              <CustomText fontSize={10} fontFamily="SemiBold" style={{ color: parcelPhase.color }}>
                Step {parcelPhase.step} of {parcelPhase.totalSteps}
              </CustomText>
            </View>
          ) : null}
          <CustomText fontFamily="Bold" fontSize={18} style={styles.heroTitle}>
            {isParcel ? "Finding a courier" : "Finding your rider"}
          </CustomText>
          <CustomText fontSize={13} style={styles.heroSubtitle}>
            {isParcel
              ? `Matching a ${vehicleLabel.toLowerCase()} for your parcel`
              : `Matching a nearby ${vehicleLabel.toLowerCase()}`}
          </CustomText>
        </View>
        <ActivityIndicator color={Colors.primary} size="small" />
      </View>

      {isParcel && item?.recipientName ? (
        <View style={styles.recipientBanner}>
          <Ionicons name="person-outline" size={16} color="#64748b" />
          <CustomText fontSize={12} style={styles.recipientText}>
            {parcelLabels.searchingHint}: {item.recipientName}
          </CustomText>
        </View>
      ) : null}

      <View style={styles.routeCard}>
        <View style={styles.routeCardHeader}>
          <CustomText fontFamily="SemiBold" fontSize={13} style={styles.routeCardTitle}>
            Your route
          </CustomText>
          <TouchableOpacity
            style={styles.routeNavPill}
            onPress={handleNavigateRoute}
            activeOpacity={0.85}
          >
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
          <TouchableOpacity
            style={styles.navBtn}
            onPress={handleNavigatePickup}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
          >
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
          <TouchableOpacity
            style={styles.navBtn}
            onPress={handleNavigateDrop}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
          >
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
              {item?.paymentMethod === "MOBILE_MONEY" ? "Pay when trip ends" : "Pay driver directly"}
            </CustomText>
          </View>
        </View>
        <CustomText fontFamily="Bold" fontSize={17}>
          {formatCurrency(item?.fare)}
        </CustomText>
      </View>

      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={() => emit("cancelRide", item?._id)}
        activeOpacity={0.85}
      >
        <CustomText fontFamily="SemiBold" fontSize={15} style={styles.cancelText}>
          Cancel search
        </CustomText>
      </TouchableOpacity>
    </View>
  );
};

export default SearchingRideSheet;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 28,
  },
  searchHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fef9e7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fde68a",
  },
  vehicleIcon: {
    width: 36,
    height: 36,
    resizeMode: "contain",
  },
  searchHeroText: {
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
  recipientBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  recipientText: {
    color: "#475569",
    flex: 1,
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  fareLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
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
});
