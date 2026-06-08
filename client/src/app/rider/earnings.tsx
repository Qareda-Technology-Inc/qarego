import {
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import React, { useState, useCallback } from "react";
import { commonStyles } from "@/styles/commonStyles";
import CustomText from "@/components/shared/CustomText";
import { Ionicons } from "@expo/vector-icons";
import { Colors, formatCurrency } from "@/utils/Constants";
import { router } from "expo-router";
import { appAxios } from "@/service/apiInterceptors";
import EarningsBreakdownStrip from "@/components/rider/EarningsBreakdownStrip";

interface EarningsBreakdown {
  grossFare: number;
  commissionRate: number;
  commissionPercent: number;
  commissionAmount: number;
  netEarning: number;
  serviceType?: string;
}

interface Transaction {
  _id: string;
  amount: number;
  type: string;
  note?: string;
  balanceAfter?: number;
  createdAt: string;
  ride?: { fare?: number; status?: string; paymentMethod?: string; serviceType?: "RIDE" | "DELIVERY" | "FOOD" };
  earningsBreakdown?: EarningsBreakdown;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getTxLabel(type: string): string {
  const labels: Record<string, string> = {
    COMMISSION_DEBIT: "Commission",
    DIGITAL_EARNING: "Trip earning",
    TOP_UP: "Top-up",
    MANUAL_CREDIT: "Credit",
    PAYOUT: "Payout",
    MANUAL_DEBIT: "Debit",
  };
  return labels[type] ?? type;
}

function getTxIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === "COMMISSION_DEBIT") return "remove-circle-outline";
  if (type === "DIGITAL_EARNING" || type === "TOP_UP" || type === "MANUAL_CREDIT" || type === "PAYOUT") return "add-circle-outline";
  return "wallet-outline";
}

export default function RiderEarnings() {
  const [balance, setBalance] = useState<number>(0);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [totalCommission, setTotalCommission] = useState<number>(0);
  const [riderAmount, setRiderAmount] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await appAxios.get("/ride/transactions");
      setBalance(Number(res.data.balance ?? 0));
      setTotalEarnings(Number(res.data.totalEarnings ?? 0));
      setTotalCommission(Number(res.data.totalCommission ?? 0));
      setRiderAmount(Number(res.data.riderAmount ?? 0));
      setTransactions(res.data.transactions ?? []);
    } catch (e) {
      console.error("Failed to load earnings:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const isDebt = balance < 0;
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpMessage, setTopUpMessage] = useState<string | null>(null);

  const handleClearDebt = async () => {
    setTopUpMessage(null);
    setTopUpLoading(true);
    try {
      const res = await appAxios.post("/ride/top-up", {
        amount: Math.abs(balance),
      });
      setTopUpMessage(res.data?.message || "Debt cleared successfully.");
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.msg || e?.message || "Failed to clear debt.";
      setTopUpMessage(msg);
    } finally {
      setTopUpLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <SafeAreaView style={styles.safeArea} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <CustomText variant="h5" fontFamily="SemiBold" style={{ flex: 1 }}>
          Earnings
        </CustomText>
        <TouchableOpacity onPress={() => router.push("/rider/analytics")} style={styles.performanceLink}>
          <Ionicons name="stats-chart-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Rider's take-home (earnings minus commission) */}
        <View style={styles.summaryCard}>
          <CustomText fontFamily="SemiBold" fontSize={14} color="#666" style={styles.summaryLabel}>
            Your earnings from trips
          </CustomText>
          <CustomText fontSize={26} fontFamily="Bold" style={styles.riderAmount}>
            {formatCurrency(riderAmount)}
          </CustomText>
          <View style={styles.summaryRow}>
            <CustomText fontSize={13} color="#666">Total from trips</CustomText>
            <CustomText fontSize={13} fontFamily="Medium">{formatCurrency(totalEarnings)}</CustomText>
          </View>
          <View style={styles.summaryRow}>
            <CustomText fontSize={13} color="#666">Commission to company</CustomText>
            <CustomText fontSize={13} fontFamily="Medium" style={{ color: "#dc2626" }}>
              -{formatCurrency(totalCommission)}
            </CustomText>
          </View>
          <CustomText fontSize={11} color="#888" style={{ marginTop: 8 }}>
            Cash trips: you collect the fare and owe commission to the platform. Net shown on each offer is after the service fee.
          </CustomText>
        </View>

        {/* Current balance / Commission owed */}
        <View style={[styles.balanceCard, isDebt && styles.balanceCardDebt]}>
          <View style={styles.balanceHeader}>
            <View style={[styles.balanceIconWrap, isDebt && styles.balanceIconWrapDebt]}>
              <Ionicons
                name={isDebt ? "alert-circle-outline" : "wallet-outline"}
                size={28}
                color={isDebt ? "#fff" : Colors.primary}
              />
            </View>
            <CustomText fontSize={14} color={isDebt ? "rgba(255,255,255,0.9)" : "#666"}>
              {isDebt ? "Commission Owed (Balance)" : "Current Balance"}
            </CustomText>
          </View>
          <CustomText
            fontSize={30}
            fontFamily="Bold"
            style={[styles.balanceAmount, isDebt && styles.balanceAmountDebt]}
          >
            {formatCurrency(balance)}
          </CustomText>
          <CustomText fontSize={12} color={isDebt ? "rgba(255,255,255,0.8)" : "#888"} style={styles.balanceSubtext}>
            {isDebt
              ? "Amount to pay to company. Top up to continue receiving rides."
              : "Your ledger balance (after commission & top-ups)."}
          </CustomText>
          {!isDebt && balance === 0 && transactions.length === 0 && (
            <CustomText fontSize={12} color="#888" style={styles.balanceHint}>
              After you complete cash trips, commission owed will show here when your balance is negative.
            </CustomText>
          )}
          {isDebt && (
            <>
              <CustomText fontSize={12} style={styles.debtHint}>
                Clear debt instantly to continue receiving rides
              </CustomText>
              {topUpMessage && (
                <CustomText fontSize={12} style={styles.topUpMessage}>
                  {topUpMessage}
                </CustomText>
              )}
              <TouchableOpacity
                style={[styles.clearDebtButton, topUpLoading && styles.clearDebtButtonDisabled]}
                onPress={handleClearDebt}
                disabled={topUpLoading}
              >
                <CustomText fontFamily="SemiBold" fontSize={14} style={styles.clearDebtButtonText}>
                  {topUpLoading ? "Clearing..." : "Clear Debt Now"}
                </CustomText>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <CustomText fontFamily="SemiBold" fontSize={16} style={styles.sectionTitle}>
              Recent Activity
            </CustomText>
            {transactions.length > 0 && (
              <CustomText fontSize={12} color="#888">
                {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
              </CustomText>
            )}
          </View>
          {transactions.length === 0 ? (
            <View style={styles.emptyTx}>
              <Ionicons name="receipt-outline" size={40} color="#ccc" />
              <CustomText color="#888" style={styles.emptyTxText}>
                No transactions yet
              </CustomText>
            </View>
          ) : (
            transactions.map((tx) => {
              const isCredit = tx.amount >= 0;
              const breakdown = tx.earningsBreakdown;
              return (
                <View key={tx._id} style={styles.txCard}>
                  <View style={[styles.txAccent, isCredit ? styles.txAccentCredit : styles.txAccentDebit]} />
                  <View style={styles.txBodyColumn}>
                    <View style={styles.txBody}>
                      <View style={styles.txLeft}>
                        <View style={styles.txIconWrap}>
                          <Ionicons
                            name={getTxIcon(tx.type)}
                            size={20}
                            color={isCredit ? "#16a34a" : "#dc2626"}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <CustomText fontFamily="Medium" fontSize={14}>
                            {getTxLabel(tx.type)}
                          </CustomText>
                          <CustomText fontSize={12} color="#888">
                            {formatRelativeTime(tx.createdAt)}
                          </CustomText>
                        </View>
                      </View>
                      <CustomText
                        fontFamily="SemiBold"
                        fontSize={15}
                        style={{ color: isCredit ? "#16a34a" : "#dc2626" }}
                      >
                        {isCredit ? "+" : ""}{formatCurrency(tx.amount)}
                      </CustomText>
                    </View>
                    {breakdown && tx.type === "COMMISSION_DEBIT" ? (
                      <EarningsBreakdownStrip breakdown={breakdown} compact />
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#fff" },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backBtn: { marginRight: 12 },
  performanceLink: { padding: 4 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  balanceCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    padding: 24,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  balanceCardDebt: {
    backgroundColor: "#7f1d1d",
    borderColor: "#991b1b",
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  balanceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  balanceIconWrapDebt: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  balanceAmount: {
    color: Colors.text,
    marginTop: 4,
  },
  balanceAmountDebt: {
    color: "#fff",
  },
  balanceHint: { marginTop: 12 },
  balanceSubtext: { marginTop: 8 },
  summaryCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  summaryLabel: {
    marginBottom: 6,
  },
  riderAmount: {
    color: Colors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  debtHint: {
    color: "rgba(255,255,255,0.9)",
    marginTop: 12,
  },
  topUpMessage: {
    color: "rgba(255,255,255,0.95)",
    marginTop: 8,
  },
  clearDebtButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#fff",
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  clearDebtButtonDisabled: {
    opacity: 0.7,
  },
  clearDebtButtonText: {
    color: "#7f1d1d",
  },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    color: Colors.text,
  },
  emptyTx: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#fafafa",
    borderRadius: 12,
  },
  emptyTxText: {
    marginTop: 12,
  },
  txCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  txAccent: {
    width: 4,
  },
  txAccentCredit: {
    backgroundColor: "#22c55e",
  },
  txAccentDebit: {
    backgroundColor: "#ef4444",
  },
  txBodyColumn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  txBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  txLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  txIconWrap: {
    marginRight: 12,
  },
  commissionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  commissionBadge: {
    backgroundColor: "#FEE2E2",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  commissionBadgeText: {
    color: "#B91C1C",
  },
});
