import React, { FC } from "react";
import {
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import CustomText from "./CustomText";
import { Colors, formatCurrency } from "@/utils/Constants";
import { Ionicons } from "@expo/vector-icons";
import { getVehicleIconSource, getVehicleLabel } from "@/utils/mapUtils";
import RoutesMap from "../customer/RoutesMap";
import EarningsBreakdownStrip from "@/components/rider/EarningsBreakdownStrip";
import type { EarningsBreakdown } from "@/utils/earningsBreakdown";
import { breakdownFromDispatchMeta } from "@/utils/earningsBreakdown";

interface RideReceiptModalProps {
  visible: boolean;
  ride: any;
  onClose: () => void;
  onReBook?: () => void;
  role?: "customer" | "rider";
}

const RideReceiptModal: FC<RideReceiptModalProps> = ({
  visible,
  ride,
  onClose,
  onReBook,
  role = "customer",
}) => {
  if (!ride) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const dateInfo = formatDate(ride.createdAt);

  const riderBreakdown: EarningsBreakdown | null =
    role === "rider"
      ? ride.earningsBreakdown ||
        breakdownFromDispatchMeta(ride.dispatchMeta, ride.fare)
      : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <CustomText fontFamily="Bold" variant="h5">
              Ride Receipt
            </CustomText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Map Snapshot */}
            {ride.pickup?.latitude && ride.drop?.latitude && (
              <View style={styles.mapContainer}>
                <RoutesMap
                  pickup={{
                    latitude: typeof ride.pickup.latitude === 'string' 
                      ? parseFloat(ride.pickup.latitude) 
                      : ride.pickup.latitude,
                    longitude: typeof ride.pickup.longitude === 'string'
                      ? parseFloat(ride.pickup.longitude)
                      : ride.pickup.longitude,
                    address: ride.pickup.address,
                  }}
                  drop={{
                    latitude: typeof ride.drop.latitude === 'string'
                      ? parseFloat(ride.drop.latitude)
                      : ride.drop.latitude,
                    longitude: typeof ride.drop.longitude === 'string'
                      ? parseFloat(ride.drop.longitude)
                      : ride.drop.longitude,
                    address: ride.drop.address,
                  }}
                />
              </View>
            )}

            {/* Ride Details */}
            <View style={styles.section}>
              <CustomText fontFamily="SemiBold" fontSize={16} style={styles.sectionTitle}>
                Trip Details
              </CustomText>

              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={20} color="#666" />
                <View style={styles.detailContent}>
                  <CustomText fontSize={12} color="#666">Date</CustomText>
                  <CustomText fontSize={14} fontFamily="Medium">
                    {dateInfo.date}
                  </CustomText>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={20} color="#666" />
                <View style={styles.detailContent}>
                  <CustomText fontSize={12} color="#666">Time</CustomText>
                  <CustomText fontSize={14} fontFamily="Medium">
                    {dateInfo.time}
                  </CustomText>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Image
                  source={getVehicleIconSource(ride.vehicle ?? "motorcycle")}
                  style={{ width: 20, height: 20 }}
                />
                <View style={styles.detailContent}>
                  <CustomText fontSize={12} color="#666">Vehicle</CustomText>
                  <CustomText fontSize={14} fontFamily="Medium">
                    {ride.serviceType === "DELIVERY" ? "Delivery" : "Ride"} · {getVehicleLabel(ride.vehicle ?? "motorcycle")}
                  </CustomText>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={20} color="#666" />
                <View style={styles.detailContent}>
                  <CustomText fontSize={12} color="#666">Pickup</CustomText>
                  <CustomText fontSize={14} fontFamily="Medium" numberOfLines={2}>
                    {ride.pickup?.address || "N/A"}
                  </CustomText>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="location" size={20} color="#666" />
                <View style={styles.detailContent}>
                  <CustomText fontSize={12} color="#666">Drop</CustomText>
                  <CustomText fontSize={14} fontFamily="Medium" numberOfLines={2}>
                    {ride.drop?.address || "N/A"}
                  </CustomText>
                </View>
              </View>

              {ride.serviceType === "DELIVERY" && (ride.recipientName || ride.recipientPhone) && (
                <>
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={20} color="#666" />
                    <View style={styles.detailContent}>
                      <CustomText fontSize={12} color="#666">Recipient</CustomText>
                      <CustomText fontSize={14} fontFamily="Medium">
                        {ride.recipientName || "—"} · {ride.recipientPhone || "—"}
                      </CustomText>
                    </View>
                  </View>
                  {ride.parcelDescription && (
                    <View style={styles.detailRow}>
                      <Ionicons name="cube-outline" size={20} color="#666" />
                      <View style={styles.detailContent}>
                        <CustomText fontSize={12} color="#666">Parcel</CustomText>
                        <CustomText fontSize={14} fontFamily="Medium">{ride.parcelDescription}</CustomText>
                      </View>
                    </View>
                  )}
                </>
              )}

              {ride.distance && (
                <View style={styles.detailRow}>
                  <Ionicons name="navigate-outline" size={20} color="#666" />
                  <View style={styles.detailContent}>
                    <CustomText fontSize={12} color="#666">Distance</CustomText>
                    <CustomText fontSize={14} fontFamily="Medium">
                      {ride.distance.toFixed(2)} km
                    </CustomText>
                  </View>
                </View>
              )}
            </View>

            {/* Driver/Rider Info */}
            {(ride.rider || ride.customer) && (
              <View style={styles.section}>
                <CustomText fontFamily="SemiBold" fontSize={16} style={styles.sectionTitle}>
                  {role === "customer" ? "Rider" : "Customer"} Information
                </CustomText>

                <View style={styles.userInfoCard}>
                  <View style={styles.avatarContainer}>
                    <Ionicons name="person" size={30} color={Colors.text} />
                  </View>
                  <View style={styles.userDetails}>
                    <CustomText fontFamily="SemiBold" fontSize={16}>
                      {role === "customer"
                        ? ride.rider?.name || "Rider"
                        : ride.customer?.name || "Customer"}
                    </CustomText>
                    <CustomText fontSize={12} color="#666">
                      {role === "customer"
                        ? ride.rider?.phone || ""
                        : ride.customer?.phone || ""}
                    </CustomText>
                    {role === "customer" && ride.rider?.averageRating && (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={14} color="#FFD700" />
                        <CustomText fontSize={12} fontFamily="Medium">
                          {ride.rider.averageRating.toFixed(1)} (
                          {ride.rider.totalRatings || 0} ratings)
                        </CustomText>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Ratings */}
            {(ride.customerRating || ride.riderRating) && (
              <View style={styles.section}>
                <CustomText fontFamily="SemiBold" fontSize={16} style={styles.sectionTitle}>
                  Ratings
                </CustomText>

                {ride.customerRating && (
                  <View style={styles.ratingCard}>
                    <CustomText fontSize={12} color="#666" style={{ marginBottom: 4 }}>
                      Your rating to {role === "customer" ? "Rider" : "Customer"}
                    </CustomText>
                    <View style={styles.ratingStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= ride.customerRating ? "star" : "star-outline"}
                          size={16}
                          color="#FFD700"
                        />
                      ))}
                    </View>
                    {ride.customerReview && (
                      <CustomText fontSize={12} color="#666" style={{ marginTop: 4 }}>
                        "{ride.customerReview}"
                      </CustomText>
                    )}
                  </View>
                )}

                {ride.riderRating && (
                  <View style={styles.ratingCard}>
                    <CustomText fontSize={12} color="#666" style={{ marginBottom: 4 }}>
                      {role === "customer" ? "Rider" : "Customer"}'s rating to you
                    </CustomText>
                    <View style={styles.ratingStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= ride.riderRating ? "star" : "star-outline"}
                          size={16}
                          color="#FFD700"
                        />
                      ))}
                    </View>
                    {ride.riderReview && (
                      <CustomText fontSize={12} color="#666" style={{ marginTop: 4 }}>
                        "{ride.riderReview}"
                      </CustomText>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Fare / earnings */}
            <View style={styles.section}>
              <CustomText fontFamily="SemiBold" fontSize={16} style={styles.sectionTitle}>
                {role === "rider" ? "Your earnings" : "Fare breakdown"}
              </CustomText>

              {role === "rider" && riderBreakdown ? (
                <EarningsBreakdownStrip breakdown={riderBreakdown} />
              ) : (
                <View style={styles.fareCard}>
                  <View style={styles.fareRow}>
                    <CustomText fontSize={16} fontFamily="Bold">
                      Total fare
                    </CustomText>
                    <CustomText fontSize={18} fontFamily="Bold" style={{ color: Colors.primary }}>
                      {formatCurrency(ride.fare)}
                    </CustomText>
                  </View>
                  <View style={styles.paymentMethod}>
                    <Ionicons name="cash-outline" size={16} color="#666" />
                    <CustomText fontSize={12} color="#666" style={{ marginLeft: 5 }}>
                      {ride.paymentMethod === "MOBILE_MONEY" ? "Mobile money" : "Cash"}
                    </CustomText>
                  </View>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {onReBook && ride.status === "COMPLETED" && (
                <TouchableOpacity
                  style={[styles.button, styles.rebookButton]}
                  onPress={onReBook}
                >
                  <Ionicons name="repeat-outline" size={20} color="#fff" />
                  <CustomText fontFamily="SemiBold" fontSize={14} style={{ color: "#fff", marginLeft: 8 }}>
                    Re-book This Ride
                  </CustomText>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, styles.closeButtonStyle]}
                onPress={onClose}
              >
                <CustomText fontFamily="SemiBold" fontSize={14}>
                  Close
                </CustomText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  closeButton: {
    padding: 5,
  },
  mapContainer: {
    height: 200,
    margin: 15,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eee",
  },
  section: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  sectionTitle: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  detailContent: {
    marginLeft: 12,
    flex: 1,
  },
  userInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 12,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  userDetails: {
    flex: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  ratingCard: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  ratingStars: {
    flexDirection: "row",
    gap: 4,
  },
  fareCard: {
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 12,
  },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#ddd",
    marginVertical: 10,
  },
  paymentMethod: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  actionButtons: {
    padding: 15,
    gap: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 12,
  },
  rebookButton: {
    backgroundColor: Colors.primary,
  },
  closeButtonStyle: {
    backgroundColor: "#f0f0f0",
  },
});

export default RideReceiptModal;
