import {
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import React, { memo, useRef, useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import CustomButton from "@/components/shared/CustomButton";
import { Colors } from "@/utils/Constants";

interface OtpInputModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  onConfirm: (otp: string) => void;
}

const OtpInputModal: React.FC<OtpInputModalProps> = ({
  visible,
  onClose,
  title,
  subtitle = "Ask the customer for the 4-digit OTP shown on their screen to confirm you've arrived.",
  confirmLabel = "Confirm",
  onConfirm,
}) => {
  const [otp, setOtp] = useState(["", "", "", ""]);
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (!visible) setOtp(["", "", "", ""]);
  }, [visible]);

  const handleOtpChange = (value: string, index: number) => {
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
    }
  };

  const handleConfirm = () => {
    const otpValue = otp.join("");
    if (otpValue.length === 4) {
      onConfirm(otpValue);
    }
  };

  return (
    <Modal
      animationType="slide"
      visible={visible}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Ionicons name="keypad" size={40} color={Colors.primary} />
          </View>

          <CustomText fontFamily="Bold" fontSize={20} style={styles.title}>
            {title}
          </CustomText>
          <CustomText fontSize={14} color="#666" style={styles.subtitle}>
            {subtitle}
          </CustomText>

          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputs.current[index] = ref)}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                keyboardType="numeric"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          <CustomButton
            title={confirmLabel}
            onPress={handleConfirm}
            disabled={otp.join("").length !== 4}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 28,
    paddingTop: 44,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 20,
    zIndex: 10,
    padding: 4,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#fef9e7",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
    color: Colors.text,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 10,
  },
  otpInput: {
    flex: 1,
    height: 54,
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
});

export default memo(OtpInputModal);
