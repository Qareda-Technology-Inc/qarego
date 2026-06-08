import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/utils/Constants";
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

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setFullName(initialName || "");
    setEmail(initialEmail || "");
  }, [visible, initialName, initialEmail]);

  const canSubmit = useMemo(() => fullName.trim().length > 0 && !submitting, [fullName, submitting]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: fullName.trim(),
        // Email is optional: if empty, don't send it.
        email: trimOrUndefined(email),
      };
      await updateUserProfile(userId, payload);
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
        {/* Backdrop that consumes touches (prevents interacting with the app). */}
        <Pressable style={styles.backdrop} onPress={() => {}} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalWrap}
        >
          <View style={styles.card}>
            <View style={styles.headerIcon}>
              <Ionicons name="person-circle" size={48} color={Colors.theme} />
            </View>

            <CustomText fontFamily="SemiBold" fontSize={18} style={styles.title}>
              Complete your account
            </CustomText>
            <CustomText fontSize={13} color="#666" style={styles.subtitle}>
              Add your full name to continue. Email is optional.
            </CustomText>

            <View style={styles.field}>
              <CustomText fontSize={12} color="#666" style={styles.label}>
                Full Name
              </CustomText>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                style={styles.input}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>

            <View style={styles.field}>
              <CustomText fontSize={12} color="#666" style={styles.label}>
                Email (optional)
              </CustomText>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="done"
              />
            </View>

            {error ? (
              <CustomText fontSize={12} color="#b91c1c" style={{ marginTop: 8 }}>
                {error}
              </CustomText>
            ) : null}

            <View style={{ width: "100%", marginTop: 14 }}>
              <CustomButton
                title={submitting ? "Saving..." : "Save & Continue"}
                onPress={handleSave}
                disabled={!canSubmit}
                loading={submitting}
              />
            </View>

            {submitting ? (
              <View style={{ marginTop: 8 }}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  backdrop: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  modalWrap: {
    width: "100%",
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
    maxWidth: 420,
    alignSelf: "center",
  },
  headerIcon: {
    alignSelf: "center",
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(237, 210, 40, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { marginTop: 10, textAlign: "center" },
  subtitle: { marginTop: 6, textAlign: "center", marginBottom: 10 },
  field: { marginTop: 12 },
  label: { marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: "#fff",
  },
});

