import { View, StyleSheet } from "react-native";
import React from "react";
import CustomText from "@/components/shared/CustomText";
import { FOOD_THEME } from "@/styles/foodStyles";
import { ParcelTheme } from "@/styles/parcelTheme";

type Props = {
  code: string;
  compact?: boolean;
  hint?: string;
  title?: string;
  variant?: "food" | "parcel";
};

const DeliveryCodeCard: React.FC<Props> = ({
  code,
  compact,
  title,
  variant = "food",
  hint,
}) => {
  const theme =
    variant === "parcel"
      ? {
          bg: ParcelTheme.accentSoft,
          border: "#DDD6FE",
          title: ParcelTheme.ink,
          digitBorder: ParcelTheme.accentMuted,
        }
      : {
          bg: FOOD_THEME.orangeLight,
          border: FOOD_THEME.orange,
          title: FOOD_THEME.orangeDark,
          digitBorder: FOOD_THEME.orange,
        };

  const defaultHint =
    variant === "parcel"
      ? "Share this code with your courier or recipient to complete the delivery."
      : "Share this code with your courier when they arrive — only then should they hand over your order.";

  const defaultTitle =
    variant === "parcel" ? "Delivery code" : "Your delivery code";

  const digits = code.padStart(4, "0").slice(0, 4).split("");

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        { backgroundColor: theme.bg, borderColor: theme.border },
      ]}
    >
      <CustomText
        fontFamily="SemiBold"
        fontSize={compact ? 13 : 15}
        style={[styles.title, { color: theme.title }]}
      >
        {title ?? defaultTitle}
      </CustomText>
      <CustomText fontSize={compact ? 11 : 12} color={FOOD_THEME.textMuted} style={styles.hint}>
        {hint ?? defaultHint}
      </CustomText>
      <View style={styles.codeRow}>
        {digits.map((d, i) => (
          <View
            key={`${d}-${i}`}
            style={[styles.digitBox, { borderColor: theme.digitBorder }]}
          >
            <CustomText
              fontFamily="Bold"
              fontSize={compact ? 22 : 28}
              style={[styles.digit, { color: theme.title }]}
            >
              {d}
            </CustomText>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  cardCompact: {
    padding: 12,
  },
  title: {},
  hint: {
    marginTop: 6,
    lineHeight: 18,
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
  },
  digitBox: {
    width: 52,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  digit: {
    letterSpacing: 2,
  },
});

export default DeliveryCodeCard;
