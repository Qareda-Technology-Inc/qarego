import { Alert } from "react-native";
import { confirmCashPayment } from "@/service/rideService";
import { formatCurrency } from "@/utils/Constants";

/**
 * Rider: ask "did the customer pay you cash?", then record it. Resolves to the updated ride,
 * or null when the rider backs out or it fails (the reason is shown).
 */
export function askCashPayment(rideId: string, fare?: number): Promise<any | null> {
  return new Promise((resolve) => {
    Alert.alert(
      "Customer paid you cash?",
      `Only confirm if you received ${formatCurrency(Number(fare) || 0)} in cash. The trip then counts as a cash trip, so QareGO's commission comes off your balance.`,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        {
          text: "Yes, I got cash",
          onPress: async () => {
            try {
              const result = await confirmCashPayment(rideId);
              if (result?.message) Alert.alert(result.outcome === "already_paid" ? "Already paid" : "Recorded", result.message);
              resolve(result?.ride ?? null);
            } catch (err: any) {
              Alert.alert("Couldn't save", err?.response?.data?.msg || "Please try again.");
              resolve(null);
            }
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}
