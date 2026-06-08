import React from "react";
import { View, StyleSheet } from "react-native";
import CustomText from "@/components/shared/CustomText";
import {
  EarningsBreakdown,
  formatBreakdownLines,
  serviceCommissionLabel,
} from "@/utils/earningsBreakdown";

type Props = {
  breakdown: EarningsBreakdown;
  compact?: boolean;
  highlightNet?: boolean;
};

export default function EarningsBreakdownStrip({
  breakdown,
  compact = false,
  highlightNet = true,
}: Props) {
  const lines = formatBreakdownLines(breakdown);
  const svc = serviceCommissionLabel(breakdown.serviceType);

  if (compact) {
    return (
      <View style={styles.compactRow}>
        <CustomText fontSize={10} style={styles.muted}>
          Gross {lines.gross}
        </CustomText>
        <CustomText fontSize={10} style={styles.commission}>
          −{lines.commission} ({lines.percent} {svc})
        </CustomText>
        <CustomText fontSize={11} fontFamily="Bold" style={styles.net}>
          You get {lines.net}
        </CustomText>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <CustomText fontSize={11} style={styles.muted}>
          Trip fare (gross)
        </CustomText>
        <CustomText fontSize={13} fontFamily="Medium">
          {lines.gross}
        </CustomText>
      </View>
      <View style={styles.row}>
        <CustomText fontSize={11} style={styles.muted}>
          Platform fee ({lines.percent} · {svc})
        </CustomText>
        <CustomText fontSize={13} fontFamily="Medium" style={styles.commission}>
          −{lines.commission}
        </CustomText>
      </View>
      <View style={[styles.row, styles.netRow]}>
        <CustomText fontSize={12} fontFamily="SemiBold" style={styles.netLabel}>
          You receive
        </CustomText>
        <CustomText
          fontSize={highlightNet ? 16 : 14}
          fontFamily="Bold"
          style={styles.net}
        >
          {lines.net}
        </CustomText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  netRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  muted: { color: "#64748b" },
  commission: { color: "#dc2626" },
  net: { color: "#16a34a" },
  netLabel: { color: "#166534" },
  compactRow: {
    marginTop: 6,
    gap: 2,
  },
});
