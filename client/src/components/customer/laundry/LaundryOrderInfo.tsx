import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import type { FoodOrder } from "@/service/foodService";
import { laundryServiceLabel, returnByLabel } from "@/utils/laundryOptions";
import { laundryStage, LAUNDRY_STAGES } from "@/utils/laundryStage";
import LaundryCountEvidence from "./LaundryCountEvidence";

const ACCENT = "#0e7490";

/** Laundry order: when it's back, the services, and a step list (collected → delivered). */
export default function LaundryOrderInfo({ order }: { order: FoodOrder }) {
  const l = order.laundry;
  if (!l || order.status === "CANCELLED") return null;
  const stage = laundryStage(order);
  const services = (l.services ?? []).map((s) => laundryServiceLabel(s)).filter(Boolean);
  const showEvidence = l.priceStatus !== "awaiting_customer";
  return (
    <View style={styles.card}>
      {l.returnBy && stage.index < 4 ? (
        <CustomText fontFamily="SemiBold" fontSize={15} color="#164e63">
          Back by {returnByLabel(l.returnBy)}
          {l.express ? "  ·  Express" : ""}
        </CustomText>
      ) : null}
      {services.length ? (
        <CustomText fontSize={12} color="#64748b" style={{ marginTop: 2 }}>
          {services.join(", ")}
        </CustomText>
      ) : null}
      <View style={{ marginTop: 10 }}>
        {LAUNDRY_STAGES.map((label, i) => {
          const done = i < stage.index || stage.index === 4;
          const current = i === stage.index && stage.index < 4;
          return (
            <View key={label} style={styles.step}>
              <Ionicons
                name={done ? "checkmark-circle" : current ? "ellipse" : "ellipse-outline"}
                size={18}
                color={done ? "#06b6d4" : current ? ACCENT : "#cbd5e1"}
              />
              <CustomText
                fontFamily={current ? "SemiBold" : "Regular"}
                fontSize={13}
                color={done || current ? "#0f172a" : "#94a3b8"}
                style={{ marginLeft: 8 }}
              >
                {current ? stage.label : label}
              </CustomText>
            </View>
          );
        })}
      </View>
      {showEvidence ? <LaundryCountEvidence order={order} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, marginBottom: 14 },
  step: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
});
