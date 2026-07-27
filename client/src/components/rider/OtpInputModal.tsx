import {
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import React, { memo, useRef, useState, useEffect, useCallback } from "react";
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
  onConfirm: (otp: string) => void | Promise<void>;
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
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<Array<TextInput | null>>([]);
  const onConfirmRef = useRef(onConfirm);
  const submittedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    if (!visible) {
      setOtp(["", "", "", ""]);
      setSubmitting(false);
      submittedCodeRef.current = null;
      return;
    }
    const t = setTimeout(() => inputs.current[0]?.focus(), 300);
    return () => clearTimeout(t);
  }, [visible]);

  const submitCode = useCallback(async (code: string) => {
    if (code.length !== 4) return;
    // Guard against re-fire from parent re-renders (GPS ticks) while modal stays open.
    if (submitting || submittedCodeRef.current === code) return;
    submittedCodeRef.current = code;
    setSubmitting(true);
    Keyboard.dismiss();
    try {
      await onConfirmRef.current(code);
    } finally {
      setSubmitting(false);
      // Keep submittedCodeRef until digits change — prevents auto-retry storm on wrong OTP.
    }
  }, [submitting]);

  useEffect(() => {
    const code = otp.join("");
    if (!visible || code.length !== 4 || submitting) return;
    if (submittedCodeRef.current === code) return;
    const t = setTimeout(() => {
      void submitCode(code);
    }, 180);
    return () => clearTimeout(t);
  }, [otp, visible, submitting, submitCode]);

  const handleOtpChange = (value: string, index: number) => {
    if (/^\d$/.test(value) || value === "") {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      // User edited — allow a fresh submit attempt.
      submittedCodeRef.current = null;
      if (value && index < inputs.current.length - 1) {
        inputs.current[index + 1]?.focus();
      }
      if (!value && index > 0) {
        inputs.current[index - 1]?.focus();
      }
    }
  };

  const handleConfirm = () => {
    submittedCodeRef.current = null;
    void submitCode(otp.join(""));
  };

  return (
    <Modal
      animationType="slide"
      visible={visible}
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={onClose} accessible={false}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>

          <CustomText fontFamily="Bold" fontSize={20} style={styles.title}>
            {title}
          </CustomText>
          <CustomText fontSize={14} color="#64748b" style={styles.subtitle}>
            {subtitle}
          </CustomText>

          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputs.current[index] = ref)}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
                    inputs.current[index - 1]?.focus();
                  }
                }}
                style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!submitting}
                returnKeyType="done"
              />
            ))}
          </View>

          <CustomButton
            title={submitting ? "Checking…" : confirmLabel}
            onPress={handleConfirm}
            disabled={otp.join("").length !== 4 || submitting}
          />

          <TouchableOpacity
            style={styles.dismissRow}
            onPress={Keyboard.dismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-down" size={16} color="#999" />
            <CustomText fontSize={12} color="#999" style={{ marginLeft: 4 }}>
              Hide keypad
            </CustomText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 24,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    marginBottom: 16,
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 20,
    zIndex: 10,
    padding: 4,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
    color: Colors.text,
    paddingHorizontal: 24,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
    paddingHorizontal: 8,
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
  dismissRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
});

export default memo(OtpInputModal);
