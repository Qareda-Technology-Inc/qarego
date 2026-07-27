import { View, StyleSheet, Image } from "react-native";
import React from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import CustomText from "../shared/CustomText";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import CircularServiceSelector from "./CircularServiceSelector";
import { useUserStore } from "@/store/userStore";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Customer module greeting — brand + personalized hello + service list.
 */
const ServiceSelectScreen = () => {
  const { user } = useUserStore();
  const name = user?.name?.trim() || "there";
  const greeting = getGreeting();

  return (
    <View style={styles.wrapper}>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.brandRow}>
        <Image
          source={require("@/assets/images/logo_t.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <CustomText fontFamily="Bold" fontSize={18} style={styles.brand}>
          QareGO
        </CustomText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(420)} style={styles.hero}>
        <CustomText fontFamily="Bold" fontSize={28} style={styles.heading}>
          {greeting}, {name}
        </CustomText>
        <CustomText fontFamily="Medium" fontSize={16} style={styles.subtitle}>
          What do you need today?
        </CustomText>
      </Animated.View>

      <CircularServiceSelector goToHomeOnSelect />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    paddingTop: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 36,
    height: 36,
    marginRight: 8,
  },
  brand: {
    color: Colors.text,
    letterSpacing: -0.3,
  },
  hero: {
    marginBottom: 22,
  },
  heading: {
    color: Colors.text,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    color: DS.color.textMuted,
    lineHeight: 22,
  },
});

export default ServiceSelectScreen;
