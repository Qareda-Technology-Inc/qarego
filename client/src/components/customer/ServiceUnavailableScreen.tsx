import React from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";

type Props = {
  loading?: boolean;
  message?: string | null;
  onRetry?: () => void;
  onOpenSettings?: () => void;
};

/**
 * Shown when the customer is outside all active service zones.
 */
export default function ServiceUnavailableScreen({
  loading,
  message,
  onRetry,
  onOpenSettings,
}: Props) {
  if (loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <CustomText fontFamily="Medium" fontSize={15} style={styles.loadingText}>
          Checking service availability…
        </CustomText>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWell}>
        <Ionicons name="location-outline" size={36} color={Colors.primary} />
      </View>
      <CustomText fontFamily="Bold" fontSize={22} style={styles.title}>
        Service not available in your area
      </CustomText>
      <CustomText fontSize={15} style={styles.body}>
        {message ||
          "QareGO is not active at your current location yet. Move closer to a coverage zone or try again later."}
      </CustomText>

      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="refresh" size={18} color="#fff" />
          <CustomText fontFamily="SemiBold" fontSize={15} style={styles.primaryLabel}>
            Check again
          </CustomText>
        </Pressable>
      ) : null}

      {onOpenSettings ? (
        <Pressable onPress={onOpenSettings} style={styles.secondaryBtn}>
          <CustomText fontFamily="Medium" fontSize={14} style={styles.secondaryLabel}>
            Open location settings
          </CustomText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    color: DS.color.textMuted,
    textAlign: "center",
  },
  iconWell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    color: Colors.text,
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  body: {
    color: DS.color.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryLabel: {
    color: "#fff",
  },
  secondaryBtn: {
    marginTop: 14,
    padding: 8,
  },
  secondaryLabel: {
    color: Colors.primary,
  },
});
