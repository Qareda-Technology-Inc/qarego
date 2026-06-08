import { View, Image, Alert, StyleSheet, ScrollView } from "react-native";
import React, { useState } from "react";
import { router } from "expo-router";
import CustomText from "@/components/shared/CustomText";
import AuthSafeScreen from "@/components/shared/AuthSafeScreen";
import PhoneInput from "@/components/shared/PhoneInput";
import CustomButton from "@/components/shared/CustomButton";
import { requestOtp } from "@/service/authService";
import { Colors } from "@/utils/Constants";

interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
}

const Role = () => {
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || phone.length !== 9) {
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
    <AuthSafeScreen backgroundColor={Colors.background}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/logo_t.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <CustomText fontFamily="Bold" fontSize={28} style={styles.title}>
            Get Started
          </CustomText>

          <CustomText fontSize={16} color="#666" style={styles.subtitle}>
            Sign in to continue
          </CustomText>

          <View style={styles.inputContainer}>
            <PhoneInput
              value={phone}
              onChangeText={setPhone}
              onCountryChange={setSelectedCountry}
              autoDetect={true}
            />
          </View>

          <View style={styles.footer}>
            <CustomText fontSize={11} color="#999" style={styles.termsText}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </CustomText>

            <CustomButton
              title="Continue"
              onPress={handleLogin}
              loading={loading}
              disabled={loading || !phone || phone.length !== 9}
            />
          </View>
        </View>
      </ScrollView>
    </AuthSafeScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
    color: Colors.text,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 40,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 30,
  },
  footer: {
    width: "100%",
    alignItems: "center",
    paddingTop: 20,
  },
  termsText: {
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 16,
  },
});

export default Role;
