import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
} from "react-native";
import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import AuthSafeScreen from "@/components/shared/AuthSafeScreen";
import PhoneInput from "@/components/shared/PhoneInput";
import CustomButton from "@/components/shared/CustomButton";
import { requestOtp } from "@/service/authService";
import { router } from "expo-router";
import { Colors } from "@/utils/Constants";

interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
}

const Auth = () => {
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
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
          pathname: "/rider/otp-verify",
          params: { phone: fullPhone },
        });
      }
    } catch {
      Alert.alert("Error", "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <View style={styles.footer}>
      <CustomText fontSize={11} color="#999" style={styles.termsText}>
        By continuing, you agree to our Terms of Service and Privacy Policy
      </CustomText>
      <CustomButton
        title="Continue"
        onPress={handleNext}
        loading={loading}
        disabled={loading || !phone || phone.length !== 9}
      />
    </View>
  );

  return (
    <AuthSafeScreen footer={footer}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.helpButton} accessibilityLabel="Help">
            <Ionicons name="help-circle-outline" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/rider_logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <CustomText fontFamily="Bold" fontSize={28} style={styles.title}>
            Welcome, Rider
          </CustomText>

          <CustomText fontSize={16} color="#666" style={styles.subtitle}>
            Sign in to start earning
          </CustomText>

          <View style={styles.inputSection}>
            <PhoneInput
              value={phone}
              onChangeText={setPhone}
              onCountryChange={setSelectedCountry}
              autoDetect={true}
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
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 8,
    paddingBottom: 10,
  },
  helpButton: {
    padding: 8,
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
  inputSection: {
    width: "100%",
  },
  footer: {
    padding: 24,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  termsText: {
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 16,
  },
});

export default Auth;
