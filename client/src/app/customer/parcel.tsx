import React from "react";
import { View, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { ParcelTheme as P } from "@/styles/parcelTheme";
import type { ParcelMode } from "@/utils/parcelMode";

const MODES: {
  mode: ParcelMode;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    mode: "SEND",
    title: "Send a parcel",
    subtitle: "Courier picks up from you and delivers to someone else",
    icon: "arrow-up-circle-outline",
  },
  {
    mode: "RECEIVE",
    title: "Receive a parcel",
    subtitle: "Courier collects from a shop or sender and brings it to you",
    icon: "arrow-down-circle-outline",
  },
];

const ParcelModeScreen = () => {
  const go = (mode: ParcelMode) => {
    router.navigate({
      pathname: "/customer/selectlocations",
      params: { vehicle: "motorcycle", serviceType: "DELIVERY", parcelMode: mode },
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/customer/home"))}
            style={styles.backBtn}
          >
            <MaterialIcons name="arrow-back-ios" size={20} color={T.ink} />
          </TouchableOpacity>
          <CustomText fontFamily="SemiBold" fontSize={18} style={styles.headerTitle}>
            Parcel
          </CustomText>
          <View style={styles.backBtn} />
        </View>

        <CustomText fontSize={14} style={styles.intro}>
          Choose how you want to use parcel delivery
        </CustomText>

        {MODES.map((item) => (
          <TouchableOpacity
            key={item.mode}
            style={styles.card}
            onPress={() => go(item.mode)}
            activeOpacity={0.88}
          >
            <View style={styles.cardIcon}>
              <Ionicons name={item.icon} size={28} color={P.accent} />
            </View>
            <View style={styles.cardText}>
              <CustomText fontFamily="SemiBold" fontSize={17} style={styles.cardTitle}>
                {item.title}
              </CustomText>
              <CustomText fontSize={13} style={styles.cardSub}>
                {item.subtitle}
              </CustomText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={T.inkSoft} />
          </TouchableOpacity>
        ))}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.surfaceMuted },
  safe: { flex: 1, paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.sheetBg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, textAlign: "center", color: T.ink },
  intro: { color: T.inkMuted, marginBottom: 20, lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.sheetBg,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: T.border,
    ...T.shadow.card,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: P.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { color: T.ink },
  cardSub: { color: T.inkMuted, marginTop: 4, lineHeight: 18 },
});

export default ParcelModeScreen;
