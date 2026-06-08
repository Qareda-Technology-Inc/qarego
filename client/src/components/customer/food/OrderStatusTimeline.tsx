import { View, StyleSheet } from "react-native";
import React, { FC } from "react";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { TrackingStep } from "@/utils/foodOrderTracking";
import { FOOD_THEME } from "@/styles/foodStyles";

type Props = {
  steps: TrackingStep[];
};

const OrderStatusTimeline: FC<Props> = ({ steps }) => (
  <View style={styles.wrap}>
    {steps.map((step, index) => {
      const isLast = index === steps.length - 1;
      const dotColor =
        step.state === "done"
          ? FOOD_THEME.orange
          : step.state === "active"
            ? FOOD_THEME.orange
            : "#e2e8f0";
      const lineColor = step.state === "done" ? FOOD_THEME.orange : "#e2e8f0";

      return (
        <View key={step.id} style={styles.row}>
          <View style={styles.rail}>
            <View
              style={[
                styles.dot,
                { backgroundColor: dotColor, borderColor: dotColor },
                step.state === "active" && styles.dotActive,
              ]}
            >
              {step.state === "done" ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : step.state === "active" ? (
                <View style={styles.dotPulse} />
              ) : null}
            </View>
            {!isLast ? <View style={[styles.line, { backgroundColor: lineColor }]} /> : null}
          </View>
          <View style={[styles.content, isLast && { paddingBottom: 0 }]}>
            <CustomText
              fontFamily={step.state === "active" ? "SemiBold" : "Medium"}
              fontSize={14}
              style={{
                color: step.state === "pending" ? FOOD_THEME.textLight : FOOD_THEME.text,
              }}
            >
              {step.label}
            </CustomText>
            {step.subtitle ? (
              <CustomText fontSize={12} color={FOOD_THEME.textMuted} style={{ marginTop: 2 }}>
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
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    minHeight: 52,
  },
  rail: {
    width: 28,
    alignItems: "center",
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  dotActive: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: FOOD_THEME.orangeLight,
  },
  dotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: 4,
  },
  content: {
    flex: 1,
    paddingBottom: 16,
    paddingLeft: 8,
  },
});

export default OrderStatusTimeline;
