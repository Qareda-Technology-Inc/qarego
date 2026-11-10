import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { formatCurrency } from "@/utils/Constants";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import { answerPharmacyPrice, type FoodOrder } from "@/service/foodService";

const ACCENT = "#047857";

type Props = {
  order: FoodOrder;
  onAnswered: (order: FoodOrder) => void;
  /** Approved a mobile money order: open the payment next. */
  onApprovedPayNow: () => void;
  onError: (message: string) => void;
};

/**
 * Prescription request on the order screen: what the customer sent, then the pharmacist's
 * price to approve (or decline, which cancels it; nothing has been paid yet).
 */
export default function PharmacyPriceCard({ order, onAnswered, onApprovedPayNow, onError }: Props) {
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const quote = order.pharmacyQuote;
  if (!quote) return null;

  const photos = (order.prescriptionUrls ?? []).map((u) => resolveMediaUrl(u)).filter(Boolean) as string[];
  const toAnswer = quote.priceStatus === "awaiting_customer" && order.status === "PLACED";
  const isMomo = order.paymentMethod === "MOBILE_MONEY";

  const answer = async (decision: "approve" | "decline") => {
    setBusy(decision);
    try {
      const updated = await answerPharmacyPrice(order._id, decision);
      if (updated) onAnswered(updated);
      if (decision === "approve" && isMomo) onApprovedPayNow();
    } catch (err: any) {
      onError(err?.response?.data?.msg || err?.response?.data?.message || "Couldn't send your answer. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const confirmDecline = () =>
    Alert.alert("Decline this price?", "Your order will be cancelled. You haven't paid anything.", [
      { text: "Go back", style: "cancel" },
      { text: "Decline", style: "destructive", onPress: () => answer("decline") },
    ]);

  return (
    <View style={[styles.card, toAnswer && styles.cardActive]}>
      <View style={styles.headRow}>
        <Ionicons name={toAnswer ? "pricetag-outline" : "document-text-outline"} size={18} color={ACCENT} />
        <CustomText fontFamily="SemiBold" fontSize={15} style={styles.title}>
          {toAnswer ? "Your price" : "Your prescription"}
        </CustomText>
      </View>

      {photos.length || quote.request ? (
        <View style={styles.sentRow}>
          {photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.thumb} />
          ))}
          {quote.request ? (
            <CustomText fontSize={13} color="#334155" style={styles.request} numberOfLines={3}>
              “{quote.request}”
            </CustomText>
          ) : null}
        </View>
      ) : null}

      {quote.priceStatus === "awaiting_pharmacy" ? (
        <View style={styles.waiting}>
          <ActivityIndicator size="small" color={ACCENT} />
          <CustomText fontSize={13} color="#065f46" style={{ marginLeft: 8, flex: 1 }}>
            The pharmacist is checking what&apos;s in stock. We&apos;ll notify you with the price.
          </CustomText>
        </View>
      ) : null}

      {quote.priceStatus !== "awaiting_pharmacy" && order.items.length ? (
        <View style={styles.lines}>
          {order.items.map((line, i) => (
            <View key={`${line.name}-${i}`} style={styles.line}>
              <CustomText fontSize={13} color="#0f172a" style={{ flex: 1, marginRight: 8 }}>
                {line.quantity}× {line.name}
              </CustomText>
              <CustomText fontSize={13} color="#0f172a">
                {formatCurrency(line.price * line.quantity)}
              </CustomText>
            </View>
          ))}
          {quote.unavailable?.length ? (
            <View style={styles.unavailable}>
              <Ionicons name="close-circle-outline" size={15} color="#b91c1c" />
              <CustomText fontSize={12} color="#b91c1c" style={{ marginLeft: 6, flex: 1 }}>
                Not in stock: {quote.unavailable.join(", ")}
              </CustomText>
            </View>
          ) : null}
          {quote.pharmacistNote ? (
            <View style={styles.note}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color="#475569" />
              <CustomText fontSize={12} color="#475569" style={{ marginLeft: 6, flex: 1 }}>
                Pharmacist: {quote.pharmacistNote}
              </CustomText>
            </View>
          ) : null}
          {toAnswer ? (
            <>
              <View style={[styles.line, styles.feeLine]}>
                <CustomText fontSize={12} color="#64748b">Service fee</CustomText>
                <CustomText fontSize={12} color="#64748b">{formatCurrency(order.serviceFee ?? 0)}</CustomText>
              </View>
              <View style={styles.line}>
                <CustomText fontSize={12} color="#64748b">
                  {order.fulfillmentType === "PICKUP" ? "Pickup" : "Delivery"}
                </CustomText>
                <CustomText fontSize={12} color="#64748b">{formatCurrency(order.deliveryFee)}</CustomText>
              </View>
              <View style={[styles.line, styles.totalLine]}>
                <CustomText fontFamily="SemiBold" fontSize={14}>Total</CustomText>
                <CustomText fontFamily="Bold" fontSize={16} color={ACCENT}>
                  {formatCurrency(order.total)}
                </CustomText>
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      {toAnswer ? (
        <>
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
                {isMomo ? `Approve and pay ${formatCurrency(order.total)}` : `Approve ${formatCurrency(order.total)}`}
              </CustomText>
            )}
          </TouchableOpacity>
          <CustomText fontSize={11} color="#64748b" style={{ textAlign: "center", marginTop: 6 }}>
            {isMomo ? "You pay by MoMo, then the pharmacy packs it." : "You pay cash when it arrives."}
          </CustomText>
          <TouchableOpacity style={styles.secondary} disabled={!!busy} onPress={confirmDecline} accessibilityRole="button">
            {busy === "decline" ? (
              <ActivityIndicator color={ACCENT} />
            ) : (
              <CustomText fontFamily="Medium" fontSize={14} color="#b91c1c">
                Decline
              </CustomText>
            )}
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardActive: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  headRow: { flexDirection: "row", alignItems: "center" },
  title: { marginLeft: 8, color: "#064e3b" },
  sentRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  thumb: { width: 52, height: 64, borderRadius: 8, backgroundColor: "#e2e8f0" },
  request: { flex: 1, fontStyle: "italic" },
  waiting: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d1fae5",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  lines: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginTop: 12 },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  feeLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e2e8f0", marginTop: 6, paddingTop: 8 },
  totalLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e2e8f0", marginTop: 6, paddingTop: 8 },
  unavailable: { flexDirection: "row", alignItems: "flex-start", marginTop: 8 },
  note: { flexDirection: "row", alignItems: "flex-start", marginTop: 6 },
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
