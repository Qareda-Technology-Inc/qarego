import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { formatCurrency } from "@/utils/Constants";
import { answerLaundryPrice, type FoodOrder } from "@/service/foodService";

const ACCENT = "#0e7490";

type Props = {
  order: FoodOrder;
  onAnswered: (order: FoodOrder) => void;
  onError: (message: string) => void;
};

/**
 * The laundry counted more than the customer's estimate. Nothing is washed until they answer:
 * approve the new price, or have everything brought back unwashed (they pay the delivery only).
 */
export default function LaundryPriceCard({ order, onAnswered, onError }: Props) {
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const laundry = order.laundry;
  if (!laundry || laundry.priceStatus !== "awaiting_customer") return null;

  const estimate = laundry.estimatedSubtotal;
  const counted = order.subtotal;

  const answer = async (decision: "approve" | "decline") => {
    setBusy(decision);
    try {
      const updated = await answerLaundryPrice(order._id, decision);
      if (updated) onAnswered(updated);
    } catch (err: any) {
      onError(err?.response?.data?.msg || err?.response?.data?.message || "Couldn't send your answer. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const confirmDecline = () =>
    Alert.alert(
      "Return it unwashed?",
      `${order.restaurantName} won't wash anything. A rider brings your laundry back and you pay only the delivery fee (${formatCurrency(order.deliveryFee)}).`,
      [
        { text: "Go back", style: "cancel" },
        { text: "Return unwashed", style: "destructive", onPress: () => answer("decline") },
      ]
    );

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Ionicons name="pricetag-outline" size={18} color={ACCENT} />
        <CustomText fontFamily="SemiBold" fontSize={15} style={styles.title}>
          Approve the new price
        </CustomText>
      </View>
      <CustomText fontSize={13} color="#334155" style={{ marginTop: 6 }}>
        {order.restaurantName} counted {laundry.countedItemCount ?? "your"} items. It comes to more than your estimate,
        so they&apos;ll wait for your answer before washing.
      </CustomText>

      <View style={styles.compare}>
        <View style={styles.compareCol}>
          <CustomText fontSize={11} color="#64748b">
            Your estimate
          </CustomText>
          <CustomText fontSize={15} color="#64748b" style={styles.strike}>
            {formatCurrency(estimate)}
          </CustomText>
        </View>
        <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
        <View style={styles.compareCol}>
          <CustomText fontSize={11} color="#64748b">
            After counting
          </CustomText>
          <CustomText fontFamily="Bold" fontSize={17} color={ACCENT}>
            {formatCurrency(counted)}
          </CustomText>
        </View>
      </View>
      {order.items.map((line, i) => (
        <View key={`${line.name}-${i}`} style={styles.line}>
          <CustomText fontSize={13} color="#334155">
            {line.quantity}× {line.name}
          </CustomText>
          <CustomText fontSize={13} color="#334155">
            {formatCurrency(line.price * line.quantity)}
          </CustomText>
        </View>
      ))}
      <View style={[styles.line, styles.totalLine]}>
        <CustomText fontFamily="SemiBold" fontSize={13}>
          New total with fees
        </CustomText>
        <CustomText fontFamily="SemiBold" fontSize={13}>
          {formatCurrency(order.total)}
        </CustomText>
      </View>

      <TouchableOpacity
        style={[styles.primary, busy && styles.disabled]}
        disabled={!!busy}
        onPress={() => answer("approve")}
        accessibilityRole="button"
      >
        {busy === "approve" ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <CustomText fontFamily="SemiBold" fontSize={15} color="#fff">
            Approve {formatCurrency(order.total)}
          </CustomText>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondary}
        disabled={!!busy}
        onPress={confirmDecline}
        accessibilityRole="button"
      >
        {busy === "decline" ? (
          <ActivityIndicator color={ACCENT} />
        ) : (
          <CustomText fontFamily="Medium" fontSize={14} color="#b91c1c">
            No, return it unwashed
          </CustomText>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ecfeff",
    borderColor: "#a5f3fc",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  headRow: { flexDirection: "row", alignItems: "center" },
  title: { marginLeft: 8, color: "#164e63" },
  compare: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginVertical: 12,
  },
  compareCol: { alignItems: "center", flex: 1 },
  strike: { textDecorationLine: "line-through" },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#a5f3fc", marginTop: 6, paddingTop: 8 },
  primary: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  secondary: { paddingVertical: 12, alignItems: "center" },
  disabled: { opacity: 0.6 },
});
