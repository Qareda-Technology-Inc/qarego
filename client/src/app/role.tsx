import {
  View,
  Image,
  Alert,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useState } from "react";
import { router } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import CustomText from "@/components/shared/CustomText";
import PhoneInput from "@/components/shared/PhoneInput";
import CustomButton from "@/components/shared/CustomButton";
import { requestOtp } from "@/service/authService";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";

interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
}

const Role = () => {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [loading, setLoading] = useState(false);

  const phoneReady = phone.length === 9;

  const handleLogin = async () => {
    if (!phoneReady) {
      Alert.alert("Invalid Phone Number", "Please enter a valid 9-digit phone number");
      return;
    }

    const countryCode = selectedCountry?.dialCode || "+233";
    const fullPhone = countryCode + phone;

    setLoading(true);
    try {
      const response = await requestOtp({ phone: fullPhone, method: "sms" });
      if (response) {
        router.push({
          pathname: "/otp-verify",
          params: { phone: fullPhone },
        });
      }
    } catch (error) {
      console.log("Login Error", error);
      Alert.alert("Error", "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {/* Soft brand atmosphere — no flat white void */}
      <View pointerEvents="none" style={styles.atmosphere}>
        <View style={styles.orbTop} />
        <View style={styles.orbSide} />
        <View style={styles.orbBottom} />
        <View style={styles.horizon} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 16) + 12,
              paddingBottom: Math.max(insets.bottom, 16) + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.duration(520).springify().damping(18)}
            style={styles.brandBlock}
          >
            <View style={styles.logoBadge}>
              <Image
                source={require("@/assets/images/logo_t.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <CustomText fontFamily="Bold" fontSize={36} style={styles.brandName}>
              QareGO
            </CustomText>
            <CustomText fontFamily="Medium" fontSize={15} style={styles.tagline}>
              Rides, food & parcels across Ghana
            </CustomText>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(120).duration(480).springify().damping(18)}
            style={styles.card}
          >
            <CustomText fontFamily="SemiBold" fontSize={20} style={styles.cardTitle}>
              Welcome
            </CustomText>
            <CustomText fontSize={14} style={styles.cardSubtitle}>
              Enter your phone number to continue. We’ll text you a one-time code.
            </CustomText>

            <CustomText fontFamily="Medium" fontSize={12} style={styles.fieldLabel}>
              Phone number
            </CustomText>
            <PhoneInput
              value={phone}
              onChangeText={setPhone}
              onCountryChange={setSelectedCountry}
              autoDetect={true}
            />

            <View style={styles.ctaWrap}>
              <CustomButton
                title={loading ? "Sending code…" : "Continue"}
                onPress={handleLogin}
                loading={loading}
                disabled={loading || !phoneReady}
              />
            </View>

            <CustomText fontSize={11} style={styles.termsText}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </CustomText>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(220).duration(420)}
            style={styles.sponsorRow}
          >
            <CustomText fontSize={11} style={styles.sponsorText}>
              Sponsored by Qaretech
            </CustomText>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },
  flex: {
    flex: 1,
  },
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  orbTop: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: Colors.primary,
    opacity: 0.28,
  },
  orbSide: {
    position: "absolute",
    top: 120,
    left: -100,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.tertiary,
    opacity: 0.12,
  },
  orbBottom: {
    position: "absolute",
    bottom: -40,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.theme,
    opacity: 0.1,
  },
  horizon: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "42%",
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    justifyContent: "center",
  },
  brandBlock: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    ...DS.shadow.card,
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  logo: {
    width: 72,
    height: 72,
  },
  brandName: {
    color: Colors.text,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  tagline: {
    marginTop: 8,
    color: DS.color.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...DS.shadow.card,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  cardTitle: {
    color: Colors.text,
    marginBottom: 6,
  },
  cardSubtitle: {
    color: DS.color.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  fieldLabel: {
    color: DS.color.textMuted,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  ctaWrap: {
    marginTop: 8,
  },
  termsText: {
    textAlign: "center",
    color: DS.color.textSoft,
    lineHeight: 16,
    marginTop: 8,
  },
  sponsorRow: {
    alignItems: "center",
    marginTop: 22,
  },
  sponsorText: {
    color: DS.color.textSoft,
  },
});

export default Role;
