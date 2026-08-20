import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import CustomText from "@/components/shared/CustomText";
import CustomButton from "@/components/shared/CustomButton";
import { verifyOtp, requestOtp } from "@/service/authService";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import { getReviewOtp } from "@/utils/reviewLogin";

type Props = {
  phone: string;
  updateAccessToken: () => void;
  /** When user pastes a 4-digit code (Android SMS), fill boxes and verify */
  autoSubmitOnPaste?: boolean;
};

function maskPhoneDisplay(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 6) return phone || "";
  const tail = digits.slice(-4);
  const head = digits.slice(0, Math.min(5, digits.length - 4));
  return `+${head} •••• ${tail}`;
}

export default function OtpVerifyScreen({
  phone,
  updateAccessToken,
  autoSubmitOnPaste = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputs = useRef<Array<TextInput | null>>([]);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  useEffect(() => {
    const t = setTimeout(() => inputs.current[0]?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const reviewOtp = getReviewOtp(phone);
    if (!reviewOtp) return;
    const t = setTimeout(() => void submitOtp(reviewOtp), 250);
    return () => clearTimeout(t);
    // submitOtp is stable enough for a one-shot review bypass
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      const full = value.replace(/\D/g, "").slice(0, 4);
      if (full.length === 4) {
        setOtp(full.split(""));
        inputs.current[3]?.focus();
        if (autoSubmitOnPaste) {
          setTimeout(() => void submitOtp(full), 280);
        }
        return;
      }
    }
    if (/^\d$/.test(value) || value === "") {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      if (value && index < inputs.current.length - 1) {
        inputs.current[index + 1]?.focus();
      }
      if (!value && index > 0) {
        inputs.current[index - 1]?.focus();
      }
      // Auto-submit when last digit entered
      if (value && index === 3) {
        const code = [...newOtp].join("");
        if (code.length === 4) {
          setTimeout(() => void submitOtp(code), 180);
        }
      }
    }
  };

  const submitOtp = async (code: string) => {
    if (code.length !== 4) {
      Alert.alert("Invalid OTP", "Please enter a complete 4-digit OTP");
      return;
    }
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
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
      submittingRef.current = false;
    }
  };

  const handleVerify = () => void submitOtp(otp.join(""));

  const handleResendOtp = async () => {
    if (timer > 0) return;
    setResendLoading(true);
    try {
      await requestOtp({ phone: phone || "", method: "sms" });
      setTimer(60);
      setOtp(["", "", "", ""]);
      inputs.current[0]?.focus();
      Alert.alert("Code sent", "A new verification code is on the way.");
    } catch {
      Alert.alert("Error", "Failed to resend OTP. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const codeReady = otp.join("").length === 4;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View pointerEvents="none" style={styles.atmosphere}>
        <View style={styles.orbTop} />
        <View style={styles.orbSide} />
        <View style={styles.orbBottom} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 12) + 8,
              paddingBottom: Math.max(insets.bottom, 16) + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(360)} style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.85}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.topBrand}>
              QareGO
            </CustomText>
            <View style={styles.topSpacer} />
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(80).duration(420).springify().damping(18)}
            style={styles.card}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="chatbubble-ellipses" size={28} color={Colors.theme} />
            </View>

            <CustomText fontFamily="Bold" fontSize={26} style={styles.title}>
              Check your SMS
            </CustomText>
            <CustomText fontSize={14} style={styles.subtitle}>
              Enter the 4-digit code we sent to
            </CustomText>
            <CustomText fontFamily="SemiBold" fontSize={15} style={styles.phoneText}>
              {maskPhoneDisplay(phone)}
            </CustomText>

            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.changeNumber}
            >
              <CustomText fontFamily="Medium" fontSize={13} style={styles.changeNumberText}>
                Change number
              </CustomText>
            </TouchableOpacity>

            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputs.current[index] = ref;
                  }}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onFocus={() => setFocusedIndex(index)}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
                      inputs.current[index - 1]?.focus();
                    }
                  }}
                  style={[
                    styles.otpInput,
                    digit ? styles.otpInputFilled : null,
                    focusedIndex === index ? styles.otpInputFocused : null,
                  ]}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  editable={!loading}
                  textContentType={Platform.OS === "ios" ? "oneTimeCode" : "none"}
                  autoComplete={Platform.OS === "android" ? "sms-otp" : "off"}
                />
              ))}
            </View>

            <CustomButton
              title={loading ? "Verifying…" : "Verify"}
              onPress={handleVerify}
              loading={loading}
              disabled={loading || !codeReady}
            />

            <View style={styles.resendWrap}>
              <CustomText fontSize={13} style={styles.resendHint}>
                Didn’t get the code?{" "}
              </CustomText>
              {timer > 0 ? (
                <CustomText fontSize={13} fontFamily="SemiBold" style={styles.resendTimer}>
                  Resend in {timer}s
                </CustomText>
              ) : (
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={resendLoading}
                  activeOpacity={0.7}
                >
                  <CustomText fontSize={13} fontFamily="SemiBold" style={styles.resendAction}>
                    {resendLoading ? "Sending…" : "Resend code"}
                  </CustomText>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

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
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.primary,
    opacity: 0.26,
  },
  orbSide: {
    position: "absolute",
    top: 160,
    left: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.tertiary,
    opacity: 0.11,
  },
  orbBottom: {
    position: "absolute",
    bottom: -30,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.theme,
    opacity: 0.1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    justifyContent: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...DS.shadow.card,
  },
  topBrand: {
    flex: 1,
    textAlign: "center",
    color: Colors.text,
  },
  topSpacer: {
    width: 44,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...DS.shadow.card,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#ffedd5",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 18,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    textAlign: "center",
    color: DS.color.textMuted,
    lineHeight: 20,
  },
  phoneText: {
    textAlign: "center",
    color: Colors.text,
    marginTop: 6,
  },
  changeNumber: {
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 22,
  },
  changeNumberText: {
    color: Colors.tertiary,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
    gap: 10,
  },
  otpInput: {
    flex: 1,
    height: 58,
    borderWidth: 1.5,
    borderColor: DS.color.border,
    borderRadius: 16,
    textAlign: "center",
    fontSize: 24,
    fontFamily: "Bold",
    color: Colors.text,
    backgroundColor: "#F8FAFC",
  },
  otpInputFilled: {
    borderColor: Colors.primary,
    backgroundColor: "#fffef5",
  },
  otpInputFocused: {
    borderColor: Colors.theme,
    backgroundColor: "#fff",
  },
  resendWrap: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
    flexWrap: "wrap",
  },
  resendHint: {
    color: DS.color.textMuted,
  },
  resendTimer: {
    color: DS.color.textSoft,
  },
  resendAction: {
    color: Colors.theme,
  },
});
