import { View, StyleSheet } from "react-native";
import React from "react";
import CustomText from "../shared/CustomText";
import { Colors } from "@/utils/Constants";
import CircularServiceSelector from "./CircularServiceSelector";
import { useUserStore } from "@/store/userStore";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * First page: personalized header, subheading, and animated service categories.
 */
const ServiceSelectScreen = () => {
  const { user } = useUserStore();
  const name = user?.name?.trim() || "there";
  const greeting = getGreeting();

  return (
    <View style={styles.wrapper}>
      <CustomText fontFamily="SemiBold" fontSize={22} style={styles.heading}>
        {greeting}, {name}.
      </CustomText>
      <CustomText fontFamily="SemiBold" fontSize={18} style={styles.subtitle}>
        What can we help you with?
      </CustomText>
      <CustomText fontFamily="Regular" fontSize={14} style={styles.subheading}>
        Tap a category to get started
      </CustomText>

      <CircularServiceSelector goToHomeOnSelect />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    paddingTop: 36,
  },
  heading: {
    textAlign: "center",
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    textAlign: "center",
    color: Colors.text,
    marginBottom: 8,
  },
  subheading: {
    textAlign: "center",
    color: "#888",
    marginBottom: 16,
  },
});

export default ServiceSelectScreen;
