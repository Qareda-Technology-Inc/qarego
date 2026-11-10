import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { STORE_VERTICAL_CONFIG } from "@/utils/storeVertical";

const ACCENT = STORE_VERTICAL_CONFIG.PHARMACY.accentDark;

/** "Have a prescription?" entry on the pharmacy list (any pharmacy) or one pharmacy's page. */
export default function PrescriptionPromptCard({
  restaurantId,
  style,
}: {
  /** Send to this pharmacy; omit to let the customer pick (nearest first). */
  restaurantId?: string;
  style?: object;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, style]}
      activeOpacity={0.88}
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: "/customer/stores/prescription",
          params: restaurantId ? { restaurantId } : {},
        })
      }
    >
      <View style={styles.icon}>
        <Ionicons name="document-text" size={22} color={ACCENT} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <CustomText fontFamily="SemiBold" fontSize={15} color="#7f1d1d">
          Have a prescription?
        </CustomText>
        <CustomText fontSize={12} color="#991b1b" style={{ marginTop: 2 }}>
          {restaurantId
            ? "Send a photo. The pharmacist prices it, you approve."
            : "Snap it, a pharmacist sends the price, you approve. Free to send."}
        </CustomText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={ACCENT} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 14,
    padding: 14,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
