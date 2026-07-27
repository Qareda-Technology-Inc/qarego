import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import CustomText from "./CustomText";
import CustomButton from "./CustomButton";
import { updateUserProfile } from "@/service/userService";

type Props = {
  visible: boolean;
  userId: string;
  initialName?: string;
  initialEmail?: string;
  onSaved?: () => void;
};

const trimOrUndefined = (value: string) => {
  const v = value.trim();
  return v.length ? v : undefined;
};

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function AccountRegistrationModal({
  visible,
  userId,
  initialName,
  initialEmail,
  onSaved,
}: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<"name" | "email" | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setFullName(initialName || "");
    setEmail(initialEmail || "");
    setFocusedField(null);
  }, [visible, initialName, initialEmail]);

  const canSubmit = useMemo(
    () => fullName.trim().length > 0 && !submitting,
    [fullName, submitting]
  );

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    const emailTrimmed = email.trim();
    if (emailTrimmed && !isValidEmail(emailTrimmed)) {
      setError("Enter a valid email, or leave it blank.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await updateUserProfile(userId, {
        name: fullName.trim(),
        email: trimOrUndefined(email),
      });
      onSaved?.();
    } catch (e: any) {
      const msg = e?.response?.data?.msg || e?.message || "Failed to update your account.";
      setError(msg);
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      // Blocking modal: onRequestClose should not dismiss it.
      onRequestClose={() => {}}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={() => {}} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            <Animated.View entering={FadeIn.duration(280)} style={styles.cardShell}>
              <View pointerEvents="none" style={styles.cardGlow} />

              <Animated.View
                entering={FadeInUp.delay(60).duration(380).springify().damping(18)}
                style={styles.card}
              >
                <CustomText fontFamily="SemiBold" fontSize={12} style={styles.brandMark}>
                  QareGO
                </CustomText>

                <View style={styles.iconWrap}>
                  <Ionicons name="person" size={26} color={Colors.theme} />
                </View>

                <CustomText fontFamily="Bold" fontSize={24} style={styles.title}>
                  Complete your account
                </CustomText>
                <CustomText fontSize={14} style={styles.subtitle}>
                  Add your name to personalize rides and orders. Email is optional.
                </CustomText>

                <View style={styles.field}>
                  <CustomText fontFamily="Medium" fontSize={12} style={styles.label}>
                    Full name
                  </CustomText>
                  <TextInput
                    value={fullName}
                    onChangeText={(v) => {
                      setFullName(v);
                      if (error) setError(null);
                    }}
                    onFocus={() => setFocusedField("name")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="e.g. Ama Mensah"
                    placeholderTextColor={DS.color.textSoft}
                    style={[
                      styles.input,
                      focusedField === "name" ? styles.inputFocused : null,
                      fullName.trim() ? styles.inputFilled : null,
                    ]}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="next"
                    editable={!submitting}
                  />
                </View>

                <View style={styles.field}>
                  <CustomText fontFamily="Medium" fontSize={12} style={styles.label}>
                    Email{" "}
                    <CustomText fontSize={12} style={styles.optional}>
                      (optional)
                    </CustomText>
                  </CustomText>
                  <TextInput
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      if (error) setError(null);
                    }}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="you@example.com"
                    placeholderTextColor={DS.color.textSoft}
                    style={[
                      styles.input,
                      focusedField === "email" ? styles.inputFocused : null,
                      email.trim() ? styles.inputFilled : null,
                    ]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (canSubmit) void handleSave();
                    }}
                    editable={!submitting}
                  />
                </View>

                {error ? (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle" size={16} color={DS.color.danger} />
                    <CustomText fontSize={12} style={styles.errorText}>
                      {error}
                    </CustomText>
                  </View>
                ) : null}

                <View style={styles.ctaWrap}>
                  <CustomButton
                    title={submitting ? "Saving…" : "Save & Continue"}
                    onPress={handleSave}
                    disabled={!canSubmit}
                    loading={submitting}
                  />
                </View>

                <CustomText fontSize={11} style={styles.footerHint}>
                  You can update these details later in Profile.
                </CustomText>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    justifyContent: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalWrap: {
    flex: 1,
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  cardShell: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  cardGlow: {
    position: "absolute",
    top: -24,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    opacity: 0.35,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...DS.shadow.card,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  brandMark: {
    textAlign: "center",
    color: Colors.text,
    letterSpacing: 1.2,
    marginBottom: 14,
    opacity: 0.85,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#ffedd5",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    textAlign: "center",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    textAlign: "center",
    color: DS.color.textMuted,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 6,
  },
  field: {
    marginTop: 14,
  },
  label: {
    marginBottom: 8,
    color: Colors.text,
  },
  optional: {
    color: DS.color.textSoft,
  },
  input: {
    borderWidth: 1.5,
    borderColor: DS.color.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    fontSize: 15,
    fontFamily: "Medium",
    color: Colors.text,
    backgroundColor: "#F8FAFC",
  },
  inputFocused: {
    borderColor: Colors.theme,
    backgroundColor: "#fff",
  },
  inputFilled: {
    borderColor: Colors.primary,
    backgroundColor: "#fffef5",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  errorText: {
    flex: 1,
    color: DS.color.danger,
  },
  ctaWrap: {
    marginTop: 18,
  },
  footerHint: {
    textAlign: "center",
    color: DS.color.textSoft,
    marginTop: 14,
    lineHeight: 16,
  },
});
