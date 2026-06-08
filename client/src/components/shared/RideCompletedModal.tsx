import React, { FC } from "react";
import { View, Modal, TouchableOpacity, StyleSheet } from "react-native";
import CustomText from "./CustomText";
import { Colors, formatCurrency } from "@/utils/Constants";
import { Ionicons } from "@expo/vector-icons";

interface RideCompletedModalProps {
  visible: boolean;
  ride: { fare?: number } | null;
  onClose: () => void;
}

const RideCompletedModal: FC<RideCompletedModalProps> = ({
  visible,
  ride,
  onClose,
}) => {
  if (!ride) return null;

  const fare = ride.fare != null ? Number(ride.fare) : 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={56} color={Colors.primary} />
          </View>
          <CustomText fontFamily="Bold" variant="h5" style={styles.title}>
            Ride completed
          </CustomText>
          <CustomText fontSize={14} color="#666" style={styles.subtitle}>
            Total cost for this ride
          </CustomText>
          <View style={styles.fareWrap}>
            <CustomText fontFamily="Bold" fontSize={28} style={styles.fare}>
              {formatCurrency(fare)}
            </CustomText>
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <CustomText fontFamily="SemiBold" fontSize={16} style={styles.buttonText}>
              OK
            </CustomText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrap: {
    marginBottom: 12,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 16,
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
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: Colors.text,
  },
});

export default RideCompletedModal;
