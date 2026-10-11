import React, { FC } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { formatCurrency } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";

/** Server-provided split for FOOD cash orders (see Ride.cashCollection). */
export type RideCashCollection = {
  collectFromCustomer: number;
  payStore: number;
  riderKeeps: number;
  platformShare: number;
};

type Props = {
  cash?: RideCashCollection | null;
  /** Highlights the step the rider is on: paying the store, or collecting from the customer. */
  step?: "offer" | "pickup" | "dropoff";
};

/**
 * Cash order breakdown for riders: collect from the customer, pay the store at pickup,
 * keep the delivery fee. The platform share is the remainder, added to Commission Owed.
 */
const CashCollectionNote: FC<Props> = ({ cash, step = "offer" }) => {
  if (!cash || !(cash.collectFromCustomer > 0)) return null;

  // Offer cards run on a short timer: a single inline line, so "Accept" stays on screen.
  if (step === "offer") {
    return (
      <CustomText fontSize={10} numberOfLines={1} style={styles.compactText}>
        <CustomText fontFamily="SemiBold" fontSize={10} style={styles.headerText}>
          Cash:{" "}
        </CustomText>
        collect {formatCurrency(cash.collectFromCustomer)} · pay store{" "}
        {formatCurrency(cash.payStore)}
      </CustomText>
    );
  }

  const rows = [
    {
      key: "pickup",
      icon: "storefront-outline" as const,
      label: "Pay store at pickup",
      amount: cash.payStore,
    },
    {
      key: "dropoff",
      icon: "cash-outline" as const,
      label: "Collect from customer",
      amount: cash.collectFromCustomer,
    },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="cash" size={14} color="#166534" />
        <CustomText fontFamily="SemiBold" fontSize={12} style={styles.headerText}>
          Cash order
        </CustomText>
      </View>
      {rows.map((row) => {
        const active = step === row.key;
        return (
          <View key={row.key} style={[styles.row, active && styles.rowActive]}>
            <Ionicons name={row.icon} size={14} color={active ? "#166534" : DS.color.textMuted} />
            <CustomText
              fontFamily={active ? "SemiBold" : "Regular"}
              fontSize={12}
              style={[styles.label, active && styles.textActive]}
            >
              {row.label}
            </CustomText>
            <CustomText
              fontFamily="SemiBold"
              fontSize={13}
              style={active ? styles.textActive : undefined}
            >
              {formatCurrency(row.amount)}
            </CustomText>
          </View>
        );
      })}
      <CustomText fontSize={11} color={DS.color.textMuted} style={styles.footnote}>
        You keep {formatCurrency(cash.riderKeeps)}. The other{" "}
        {formatCurrency(cash.platformShare)} is QareGO&apos;s share and is added to Commission
        Owed.
      </CustomText>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  headerText: {
    color: "#166534",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  rowActive: {
    backgroundColor: "#DCFCE7",
  },
  label: {
    flex: 1,
    color: DS.color.textMuted,
  },
  textActive: {
    color: "#166534",
  },
  compactText: {
    marginTop: 3,
    color: "#14532d",
  },
  footnote: {
    marginTop: 6,
    lineHeight: 16,
  },
});

export default CashCollectionNote;
