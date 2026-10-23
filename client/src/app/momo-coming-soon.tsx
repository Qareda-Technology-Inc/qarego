import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import CustomButton from "@/components/shared/CustomButton";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";

const COPY = {
  pay: {
    title: "Mobile money isn't available right now",
    body: "Please pay with cash for now. Your courier or driver will collect it.",
    points: ["Choose Cash at checkout", "Pay the exact total shown in the app", "Mobile money will be back here as soon as it's available"],
  },
  topup: {
    title: "MoMo top-up isn't available right now",
    body: "For now, pay the commission you owe to QareGO in cash. Our team records it and your balance updates.",
    points: [
      "Call or WhatsApp QareGO support on +233 50 177 4210 to arrange a cash payment",
      "Your balance updates once the payment is recorded",
      "A debt suspension lifts once you owe nothing",
    ],
  },
  cashout: {
    title: "MoMo cash out isn't available right now",
    body: "Your earnings stay safe in your wallet until you can cash out again.",
    points: ["Your wallet balance is kept", "Cash trips are paid to you by the customer as usual", "You'll be able to cash out as soon as it's available again"],
  },
} as const;

export default function MomoComingSoonScreen() {
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const copy = COPY[(feature as keyof typeof COPY) || "pay"] ?? COPY.pay;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <MaterialIcons name="arrow-back-ios" size={20} color={T.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.iconWrap}>
            <Ionicons name="phone-portrait-outline" size={40} color="#8A6A00" />
            <View style={styles.badge}>
              <CustomText fontFamily="Bold" fontSize={10} color="#0F172A">
                SOON
              </CustomText>
            </View>
          </View>
          <CustomText fontFamily="Bold" fontSize={22} style={styles.title}>
            {copy.title}
          </CustomText>
          <CustomText fontSize={15} color={T.inkMuted} style={styles.text}>
            {copy.body}
          </CustomText>

          <View style={styles.card}>
            {copy.points.map((p) => (
              <View key={p} style={styles.point}>
                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                <CustomText fontSize={14} style={styles.pointText}>
                  {p}
                </CustomText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <CustomButton title={feature === "pay" || !feature ? "Pay with cash" : "OK"} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.surfaceMuted },
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.sheetBg,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, paddingHorizontal: 24, alignItems: "center", paddingTop: 24 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FEF9C3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  badge: {
    position: "absolute",
    bottom: -6,
    backgroundColor: "#EDD228",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  title: { textAlign: "center", color: T.ink },
  text: { textAlign: "center", marginTop: 10, lineHeight: 22 },
  card: {
    alignSelf: "stretch",
    marginTop: 24,
    backgroundColor: T.sheetBg,
    borderRadius: T.radius.card,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    gap: 12,
  },
  point: { flexDirection: "row", alignItems: "center", gap: 10 },
  pointText: { flex: 1, color: T.ink },
  footer: { paddingHorizontal: 16, paddingBottom: 12 },
});
