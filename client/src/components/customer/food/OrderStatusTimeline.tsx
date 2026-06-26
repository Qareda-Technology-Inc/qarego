import { View, StyleSheet } from "react-native";
import React, { FC } from "react";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { TrackingStep } from "@/utils/foodOrderTracking";
import { FOOD_THEME } from "@/styles/foodStyles";

type Props = {
  steps: TrackingStep[];
};

const STEP_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  placed: "receipt-outline",
  accepted: "checkmark-circle-outline",
  preparing: "restaurant-outline",
  ready: "bag-check-outline",
  courier: "bicycle-outline",
  delivery: "navigate-outline",
  done: "home-outline",
  cancelled: "close-circle-outline",
};

const OrderStatusTimeline: FC<Props> = ({ steps }) => (
  <View style={styles.wrap}>
    {steps.map((step, index) => {
      const isLast = index === steps.length - 1;
      const isDone = step.state === "done";
      const isActive = step.state === "active";
      const iconName = STEP_ICONS[step.id] ?? "ellipse-outline";
      const dotColor = isDone || isActive ? FOOD_THEME.accentTeal : "#e2e8f0";
      const lineColor = isDone ? FOOD_THEME.accentTeal : "#e8ebeb";
      const iconColor = isDone || isActive ? "#fff" : FOOD_THEME.textLight;

      return (
        <View key={step.id} style={styles.row}>
          <View style={styles.rail}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isActive || isDone ? dotColor : "#fff", borderColor: dotColor },
                isActive && styles.dotActive,
              ]}
            >
              {isDone ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : (
                <Ionicons name={iconName} size={isActive ? 14 : 12} color={iconColor} />
              )}
            </View>
            {!isLast ? <View style={[styles.line, { backgroundColor: lineColor }]} /> : null}
          </View>
          <View style={[styles.content, isLast && { paddingBottom: 0 }]}>
            <CustomText
              fontFamily={isActive ? "SemiBold" : "Medium"}
              fontSize={14}
              style={{ color: step.state === "pending" ? FOOD_THEME.textLight : FOOD_THEME.text }}
            >
              {step.label}
            </CustomText>
            {step.subtitle ? (
              <CustomText fontSize={12} color={FOOD_THEME.textMuted} style={{ marginTop: 3 }}>
                {step.subtitle}
              </CustomText>
            ) : null}
          </View>
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    minHeight: 56,
  },
  rail: {
    width: 32,
    alignItems: "center",
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  dotActive: {
    shadowColor: FOOD_THEME.accentTeal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: 4,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 18,
    paddingLeft: 10,
    paddingTop: 2,
  },
});

export default OrderStatusTimeline;
