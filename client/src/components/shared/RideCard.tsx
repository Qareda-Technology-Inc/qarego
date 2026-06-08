import { View, Image, StyleSheet, TouchableOpacity } from "react-native";
import React, { FC, useState } from "react";
import { commonStyles } from "@/styles/commonStyles";
import CustomText from "./CustomText";
import { getVehicleIconSource, getVehicleLabel } from "@/utils/mapUtils";
import { Colors, formatCurrency } from "@/utils/Constants";
import { Ionicons } from "@expo/vector-icons";
import RideReceiptModal from "./RideReceiptModal";
import EarningsBreakdownStrip from "@/components/rider/EarningsBreakdownStrip";
import type { EarningsBreakdown } from "@/utils/earningsBreakdown";

interface RideItem {
  _id: string;
  vehicle?: string;
  serviceType?: "RIDE" | "DELIVERY" | "FOOD";
  pickup: { address: string; latitude?: number; longitude?: number };
  drop?: { address: string; latitude?: number; longitude?: number };
  fare?: number;
  distance: number;
  status: string;
  createdAt: string;
  rating?: number;
  customerRating?: number;
  riderRating?: number;
  customerReview?: string;
  riderReview?: string;
  rider?: any;
  customer?: any;
  onReBook?: () => void;
  role?: "customer" | "rider";
  earningsBreakdown?: EarningsBreakdown | null;
}

const RideCard: FC<{ item: RideItem; onReBook?: () => void; role?: "customer" | "rider" }> = ({ 
  item, 
  onReBook,
  role = "customer"
}) => {
  const [showReceipt, setShowReceipt] = useState(false);
  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "#16a34a";
      case "CANCELLED": return "#dc2626";
      case "START":
      case "ARRIVED":
      case "IN_PROGRESS": return "#2563eb";
      case "SEARCHING_FOR_RIDER": return "#ca8a04";
      default: return "#64748b";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "COMPLETED": return "#dcfce7";
      case "CANCELLED": return "#fee2e2";
      case "START":
      case "ARRIVED":
      case "IN_PROGRESS": return "#dbeafe";
      case "SEARCHING_FOR_RIDER": return "#fef9c3";
      default: return "#f1f5f9";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
      START: "On the way",
      ARRIVED: "Arrived",
      IN_PROGRESS: "In progress",
      SEARCHING_FOR_RIDER: "Searching",
    };
    return labels[status] ?? status.replace(/_/g, " ").toLowerCase();
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.container}
        onPress={() => setShowReceipt(true)}
        activeOpacity={0.7}
      >
        <View style={[commonStyles.flexRowBetween, { marginBottom: 12 }]}>
          <CustomText fontSize={12} color="#666">
            {new Date(item.createdAt).toDateString()}, {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </CustomText>
          <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
              <CustomText 
                  fontSize={10} 
                  fontFamily="Bold"
                  style={{ color: getStatusColor(item.status) }}
              >
                  {getStatusLabel(item.status)}
              </CustomText>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.contentRow}>
            <View style={styles.vehicleContainer}>
              <Image
                source={getVehicleIconSource(item.vehicle ?? "motorcycle")}
                style={styles.rideIcon}
              />
            </View>

            <View style={styles.routeContainer}>
              <View style={styles.locationRow}>
                  <View style={[styles.dot, { backgroundColor: "green" }]} />
                  <CustomText fontSize={13} numberOfLines={1} style={{ flex: 1, marginLeft: 8 }}>
                      {item.pickup?.address}
                  </CustomText>
              </View>
              
              <View style={styles.verticalLine} />

              <View style={styles.locationRow}>
                  <View style={[styles.dot, { backgroundColor: "red" }]} />
                  <CustomText fontSize={13} numberOfLines={1} style={{ flex: 1, marginLeft: 8 }}>
                      {item.drop?.address}
                  </CustomText>
              </View>
            </View>
        </View>

        <View style={[commonStyles.flexRowBetween, { marginTop: 12 }]}>
            <View style={{ flex: 1 }}>
              {role === "rider" && item.earningsBreakdown ? (
                <>
                  <CustomText fontFamily="Bold" fontSize={16} style={{ color: "#16a34a" }}>
                    {formatCurrency(item.earningsBreakdown.netEarning)}
                  </CustomText>
                  <CustomText fontSize={11} color="#888" style={{ textDecorationLine: "line-through" }}>
                    Gross {formatCurrency(item.earningsBreakdown.grossFare)}
                  </CustomText>
                </>
              ) : (
                <CustomText fontFamily="Bold" fontSize={16}>
                  {item.fare != null ? formatCurrency(item.fare) : "NA"}
                </CustomText>
              )}
              {item.distance ? (
                 <CustomText fontSize={12} color="#888">
                    {item.distance.toFixed(1)} km
                 </CustomText>
              ) : null}
            </View>

            {/* Ratings Display */}
            {(item.customerRating || item.riderRating) && (
              <View style={styles.ratingContainer}>
                {item.customerRating && (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <CustomText fontSize={10} fontFamily="Medium" style={{ marginLeft: 2 }}>
                      {item.customerRating}
                    </CustomText>
                  </View>
                )}
                {item.riderRating && (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <CustomText fontSize={10} fontFamily="Medium" style={{ marginLeft: 2 }}>
                      {item.riderRating}
                    </CustomText>
                  </View>
                )}
              </View>
            )}

            <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </View>
        {role === "rider" && item.earningsBreakdown && item.status === "COMPLETED" ? (
          <EarningsBreakdownStrip breakdown={item.earningsBreakdown} compact />
        ) : null}
      </TouchableOpacity>

      <RideReceiptModal
        visible={showReceipt}
        ride={item}
        onClose={() => setShowReceipt(false)}
        onReBook={onReBook}
        role={role}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
    // Shadow for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    // Elevation for Android
    elevation: 2,
  },
  statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4
  },
  divider: {
      height: 1,
      backgroundColor: '#f0f0f0',
      marginBottom: 12
  },
  contentRow: {
      flexDirection: 'row',
      alignItems: 'center'
  },
  vehicleContainer: {
      width: 50,
      height: 50,
      backgroundColor: '#f9f9f9',
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 15
  },
  rideIcon: {
    width: 35,
    height: 35,
    resizeMode: "contain",
  },
  routeContainer: {
      flex: 1
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  verticalLine: {
    width: 1,
    height: 20,
    backgroundColor: "#ccc",
    marginLeft: 3.5, 
    marginVertical: 2,
  },
  ratingContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff9e6",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
});

export default RideCard;
