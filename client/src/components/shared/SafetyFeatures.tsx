import React, { FC, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "./CustomText";
import { Colors } from "@/utils/Constants";

interface SafetyFeaturesProps {
  rideId: string;
  pickup: { address: string; latitude: number; longitude: number };
  drop: { address: string; latitude: number; longitude: number };
  riderInfo?: { name?: string; phone?: string; maskedPhone?: string };
  status: string;
}

const SafetyFeatures: FC<SafetyFeaturesProps> = ({
  rideId,
  pickup,
  drop,
  riderInfo,
  status,
}) => {
  const [sosPressed, setSosPressed] = useState(false);

  const handleSOS = () => {
    Alert.alert(
      "Emergency Services",
      "Choose an emergency service:",
      [
        {
          text: "Police (191)",
          onPress: () => Linking.openURL("tel:191"),
        },
        {
          text: "Ambulance (193)",
          onPress: () => Linking.openURL("tel:193"),
        },
        {
          text: "Fire Service (192)",
          onPress: () => Linking.openURL("tel:192"),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      { cancelable: true }
    );
  };

  const handleShareTrip = async () => {
    try {
      const displayPhone = riderInfo?.maskedPhone || riderInfo?.phone;
      const rideDetails = `
🚗 Trip Details

📍 Pickup: ${pickup.address}
📍 Drop: ${drop.address}
${riderInfo?.name ? `👤 Rider: ${riderInfo.name}` : ""}
${displayPhone ? `📞 Phone: ${displayPhone}` : ""}

Track my ride: Ride ID #${rideId.slice(0, 8).toUpperCase()}
      `.trim();

      if (Platform.OS === "ios") {
        await Share.share({
          message: rideDetails,
        });
      } else {
        // For Android, try WhatsApp first, then fallback to Share
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(rideDetails)}`;
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        
        if (canOpen) {
          Alert.alert(
            "Share Trip",
            "Choose sharing method:",
            [
              {
                text: "WhatsApp",
                onPress: () => Linking.openURL(whatsappUrl),
              },
              {
                text: "SMS",
                onPress: () =>
                  Linking.openURL(
                    `sms:?body=${encodeURIComponent(rideDetails)}`
                  ),
              },
              {
                text: "Other",
                onPress: () =>
                  Share.share({
                    message: rideDetails,
                  }),
              },
              {
                text: "Cancel",
                style: "cancel",
              },
            ],
            { cancelable: true }
          );
        } else {
          await Share.share({
            message: rideDetails,
          });
        }
      }
    } catch (error) {
      console.log("Error sharing trip:", error);
      Alert.alert("Error", "Failed to share trip details");
    }
  };

  // Only show safety features during active rides
  const isActiveRide =
    status === "SEARCHING_FOR_RIDER" ||
    status === "START" ||
    status === "ARRIVED" ||
    status === "IN_PROGRESS";

  if (!isActiveRide) return null;

  return (
    <View style={styles.container}>
      {/* Safety Shield Icon */}
      <View style={styles.shieldContainer}>
        <View style={styles.shield}>
          <Ionicons name="shield-checkmark" size={32} color={Colors.primary} />
        </View>
        <CustomText fontSize={10} fontFamily="Medium" style={styles.shieldText}>
          Safety Active
        </CustomText>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.shareButton]}
          onPress={handleShareTrip}
        >
          <Ionicons name="share-outline" size={20} color="#fff" />
          <CustomText fontSize={11} fontFamily="Medium" style={styles.buttonText}>
            Share Trip
          </CustomText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.sosButton]}
          onPress={handleSOS}
          onPressIn={() => setSosPressed(true)}
          onPressOut={() => setSosPressed(false)}
        >
          <Ionicons
            name="warning"
            size={20}
            color="#fff"
            style={sosPressed && styles.sosIcon}
          />
          <CustomText fontSize={11} fontFamily="Bold" style={styles.buttonText}>
            SOS
          </CustomText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    right: 15,
    zIndex: 10,
    alignItems: "flex-end",
  },
  shieldContainer: {
    alignItems: "center",
    marginBottom: 10,
  },
  shield: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  shieldText: {
    marginTop: 4,
    color: Colors.primary,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  shareButton: {
    backgroundColor: Colors.primary,
  },
  sosButton: {
    backgroundColor: "#ff4444",
  },
  buttonText: {
    color: "#fff",
    marginLeft: 6,
  },
  sosIcon: {
    transform: [{ scale: 1.2 }],
  },
});

export default SafetyFeatures;
