import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import CustomButton from "@/components/shared/CustomButton";
import AuthSafeScreen from "@/components/shared/AuthSafeScreen";
import { verifyOtp, requestOtp } from "@/service/authService";
import { Colors } from "@/utils/Constants";

type Props = {
  phone: string;
  updateAccessToken: () => void;
  /** When user pastes a 4-digit code (Android SMS), fill boxes and verify */
  autoSubmitOnPaste?: boolean;
};

export default function OtpVerifyScreen({
  phone,
  updateAccessToken,
  autoSubmitOnPaste = false,
}: Props) {
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      const full = value.replace(/\D/g, "").slice(0, 4);
      if (full.length === 4) {
        setOtp(full.split(""));
        if (autoSubmitOnPaste) {
          setTimeout(() => void submitOtp(full), 300);
        }
        return;
      }
    }
    if (/^\d$/.test(value) || value === "") {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      if (value && index < inputs.current.length - 1) inputs.current[index + 1]?.focus();
      if (!value && index > 0) inputs.current[index - 1]?.focus();
    }
  };

  const submitOtp = async (code: string) => {
    if (code.length !== 4) {
      Alert.alert("Invalid OTP", "Please enter a complete 4-digit OTP");
      return;
    }
    setLoading(true);
    try {
      await verifyOtp({ phone: phone || "", otp: code }, updateAccessToken);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } } };
      Alert.alert(
        "Verification Failed",
        err?.response?.data?.msg || "Invalid OTP. Please try again."
      );
      setOtp(["", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = () => void submitOtp(otp.join(""));

  const handleResendOtp = async () => {
    if (timer > 0) return;
    setResendLoading(true);
    try {
      await requestOtp({ phone: phone || "", method: "sms" });
      setTimer(60);
      Alert.alert("Success", "OTP resent successfully");
    } catch {
      Alert.alert("Error", "Failed to resend OTP. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthSafeScreen backgroundColor="#f5f5f5">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={44} color={Colors.primary} />
          </View>
          <CustomText fontFamily="Bold" fontSize={22} style={styles.title}>
            Verify your number
          </CustomText>
          <CustomText fontSize={15} color="#666" style={styles.subtitle}>
            Enter the 4-digit code sent to
          </CustomText>
          <CustomText
            fontSize={15}
            fontFamily="SemiBold"
            color={Colors.primary}
            style={styles.phoneText}
            numberOfLines={1}
          >
            {phone}
          </CustomText>

          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputs.current[index] = ref;
                }}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                keyboardType="numeric"
                maxLength={1}
                selectTextOnFocus
                textContentType={Platform.OS === "ios" ? "oneTimeCode" : "none"}
                autoComplete={Platform.OS === "android" ? "sms-otp" : "off"}
              />
            ))}
          </View>

          <CustomButton
            title="Verify"
            onPress={handleVerify}
            loading={loading}
            disabled={loading || otp.join("").length !== 4}
          />

          <View style={styles.resendWrap}>
            <CustomText fontSize={14} color="#666">
              Didn't get the code?{" "}
            </CustomText>
            {timer > 0 ? (
              <CustomText fontSize={14} fontFamily="SemiBold" color="#999">
                Resend in {timer}s
              </CustomText>
            ) : (
              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={resendLoading}
                activeOpacity={0.7}
              >
                <CustomText fontSize={14} fontFamily="SemiBold" color={Colors.primary}>
                  {resendLoading ? "Sending…" : "Resend OTP"}
                </CustomText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </AuthSafeScreen>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fef9e7",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 24,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
    color: Colors.text,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 4,
  },
  phoneText: {
    textAlign: "center",
    marginBottom: 28,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
    gap: 10,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderWidth: 2,
    borderColor: "#e5e5e5",
    borderRadius: 14,
    textAlign: "center",
    fontSize: 22,
    fontFamily: "Bold",
    color: Colors.text,
    backgroundColor: "#fafafa",
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: "#fff",
  },
  resendWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    flexWrap: "wrap",
  },
});
