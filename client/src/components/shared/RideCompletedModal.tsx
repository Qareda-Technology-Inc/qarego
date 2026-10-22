import React, { FC } from "react";
import { View, Modal, TouchableOpacity, StyleSheet } from "react-native";
import CustomText from "./CustomText";
import { Colors, formatCurrency } from "@/utils/Constants";
import { Ionicons } from "@expo/vector-icons";

interface RideCompletedModalProps {
  visible: boolean;
  ride: {
    fare?: number;
    serviceType?: string;
    paymentMethod?: "CASH" | "MOBILE_MONEY";
    paymentStatus?: string;
    /** Food/gas: what the courier collects and keeps (set by the server). */
    cashCollection?: { collectFromCustomer?: number; riderKeeps?: number } | null;
  } | null;
  onClose: () => void;
  /** Riders see what to collect in cash; customers see what the trip cost. */
  viewer?: "customer" | "rider";
  /** When provided and payment is outstanding, shows a "Pay now" action. */
  onPay?: () => void;
  payBusy?: boolean;
  /** Rider: the customer paid cash instead of mobile money. */
  onPaidCash?: () => void;
  paidCashBusy?: boolean;
}

const RideCompletedModal: FC<RideCompletedModalProps> = ({
  visible,
  ride,
  onClose,
  onPay,
  payBusy,
  onPaidCash,
  paidCashBusy,
  viewer = "customer",
}) => {
  const tripFare = ride?.fare != null ? Number(ride.fare) : 0;
  const isRider = viewer === "rider";
  const cashTotal = Number(ride?.cashCollection?.collectFromCustomer);
  // A food/gas courier collects the whole order total, not just their delivery fee.
  const collectAmount = Number.isFinite(cashTotal) && cashTotal > 0 ? cashTotal : tripFare;
  const riderKeeps = Number(ride?.cashCollection?.riderKeeps);
  const isDelivery = ride?.serviceType === "DELIVERY";
  const isFood = ride?.serviceType === "FOOD";
  const isMomo = ride?.paymentMethod === "MOBILE_MONEY";
  const isPaid = isMomo && ride?.paymentStatus === "PAID";
  const momoOutstanding =
    isMomo && ["UNPAID", "PENDING", "FAILED"].includes(String(ride?.paymentStatus));
  const needsPayment = !!onPay && momoOutstanding;
  // Rides and parcels are paid after the trip; food orders are paid before.
  const riderAwaitingPayment = isRider && momoOutstanding && !isFood;

  const title = isFood
    ? "Order delivered"
    : isDelivery
      ? "Delivery completed"
      : "Ride completed";
  const fare = isRider && !isMomo ? collectAmount : tripFare;
  const subtitle = needsPayment
    ? "Amount to pay with mobile money"
    : riderAwaitingPayment
      ? "Waiting for the customer to pay by mobile money"
      : isRider
        ? isMomo
          ? "Paid by mobile money: nothing to collect"
          : "Collect in cash from the customer"
        : "Total cost for this trip";

  return (
    <Modal
      visible={visible && !!ride}
      animationType="fade"
      transparent
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.primary} />
          </View>
          <CustomText fontFamily="Bold" variant="h5" style={styles.title}>
            {title}
          </CustomText>
          <CustomText fontSize={14} style={styles.subtitle}>
            {subtitle}
          </CustomText>
          <View style={styles.fareWrap}>
            <CustomText fontFamily="Bold" fontSize={28} style={styles.fare}>
              {formatCurrency(fare)}
            </CustomText>
          </View>

          {isRider && !isMomo && Number.isFinite(riderKeeps) && riderKeeps > 0 && riderKeeps !== fare ? (
            <CustomText fontSize={13} style={styles.subtitle}>
              Includes your delivery fee of {formatCurrency(riderKeeps)}
            </CustomText>
          ) : null}

          {isMomo ? (
            <View style={styles.payRow}>
              <Ionicons
                name={isPaid ? "checkmark-circle" : "phone-portrait-outline"}
                size={16}
                color={isPaid ? "#16a34a" : "#666"}
              />
              <CustomText fontSize={13} style={[styles.payText, isPaid && styles.payTextPaid]}>
                {isPaid ? "Paid with mobile money" : riderAwaitingPayment ? "Not paid yet" : "Mobile money"}
              </CustomText>
            </View>
          ) : null}

          {needsPayment ? (
            <>
              <TouchableOpacity
                style={[styles.button, payBusy && { opacity: 0.7 }]}
                onPress={onPay}
                disabled={payBusy}
                activeOpacity={0.8}
              >
                <CustomText fontFamily="SemiBold" fontSize={16} style={styles.buttonText}>
                  {payBusy ? "Opening…" : `Pay ${formatCurrency(fare)} with mobile money`}
                </CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <CustomText fontFamily="Medium" fontSize={14} style={styles.secondaryButtonText}>
                  Pay later
                </CustomText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {riderAwaitingPayment ? (
                <CustomText fontSize={12} style={styles.subtitle}>
                  You can close this. If the customer pays you in cash instead, tap below so the trip
                  settles as a cash trip.
                </CustomText>
              ) : null}
              <TouchableOpacity
                style={styles.button}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <CustomText fontFamily="SemiBold" fontSize={16} style={styles.buttonText}>
                  OK
                </CustomText>
              </TouchableOpacity>
              {riderAwaitingPayment && onPaidCash ? (
                <TouchableOpacity
                  style={[styles.secondaryButton, paidCashBusy && { opacity: 0.7 }]}
                  onPress={onPaidCash}
                  disabled={paidCashBusy}
                  activeOpacity={0.8}
                >
                  <CustomText fontFamily="Medium" fontSize={14} style={styles.secondaryButtonText}>
                    {paidCashBusy ? "Saving…" : "Customer paid me cash"}
                  </CustomText>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    elevation: 24,
    zIndex: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  iconWrap: {
    marginBottom: 12,
  },
  title: {
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    marginBottom: 16,
    textAlign: "center",
    color: "#64748B",
  },
  fareWrap: {
    backgroundColor: Colors.secondary_light,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 20,
    minWidth: 160,
    alignItems: "center",
  },
  fare: {
    color: Colors.primary,
  },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  payText: {
    marginLeft: 6,
    color: "#666",
  },
  payTextPaid: {
    color: "#16a34a",
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#64748b",
  },
  buttonText: {
    color: Colors.text,
  },
});

export default RideCompletedModal;
