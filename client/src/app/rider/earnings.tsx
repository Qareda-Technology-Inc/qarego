import {
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useState, useCallback } from "react";
import { commonStyles } from "@/styles/commonStyles";
import CustomText from "@/components/shared/CustomText";
import { Ionicons } from "@expo/vector-icons";
import { Colors, formatCurrency } from "@/utils/Constants";
import { router } from "expo-router";
import { appAxios } from "@/service/apiInterceptors";
import EarningsBreakdownStrip from "@/components/rider/EarningsBreakdownStrip";

interface SalesBucket {
  gross: number;
  commission: number;
  net: number;
  trips: number;
}

interface SalesSummary {
  total: SalesBucket;
  cash: SalesBucket;
  momo: SalesBucket;
}

const emptySalesBucket = (): SalesBucket => ({
  gross: 0,
  commission: 0,
  net: 0,
  trips: 0,
});

const emptySalesSummary = (): SalesSummary => ({
  total: emptySalesBucket(),
  cash: emptySalesBucket(),
  momo: emptySalesBucket(),
});

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

function getTxLabel(type: string, note?: string): string {
  const labels: Record<string, string> = {
    COMMISSION_DEBIT: "Commission",
    DIGITAL_EARNING: "Trip earning",
    TOP_UP: "Top-up",
    MANUAL_CREDIT: "Credit",
    PAYOUT: note?.toLowerCase().includes("cash out") ? "Cash out" : "Payout",
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
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [minCashoutAmount, setMinCashoutAmount] = useState<number>(1);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [totalCommission, setTotalCommission] = useState<number>(0);
  const [riderAmount, setRiderAmount] = useState<number>(0);
  const [salesSummary, setSalesSummary] = useState<SalesSummary>(emptySalesSummary());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await appAxios.get("/ride/transactions");
      const currentBalance = Number(res.data.balance ?? 0);
      setBalance(currentBalance);
      setWalletBalance(Number(res.data.walletBalance ?? Math.max(0, currentBalance)));
      setMinCashoutAmount(Number(res.data.minCashoutAmount ?? 1));
      setTotalEarnings(Number(res.data.totalEarnings ?? 0));
      setTotalCommission(Number(res.data.totalCommission ?? 0));
      setRiderAmount(Number(res.data.riderAmount ?? 0));
      setSalesSummary(res.data.salesSummary ?? emptySalesSummary());
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
  const hasWallet = walletBalance > 0;
  const canCashOut = hasWallet && walletBalance >= minCashoutAmount;
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpMessage, setTopUpMessage] = useState<string | null>(null);
  const [cashoutLoading, setCashoutLoading] = useState(false);
  const [cashoutMessage, setCashoutMessage] = useState<string | null>(null);
  const [cashoutModalVisible, setCashoutModalVisible] = useState(false);
  const [cashoutAmountInput, setCashoutAmountInput] = useState("");

  const pollTopUpStatus = useCallback(
    async (clientReference: string) => {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        try {
          const statusRes = await appAxios.get("/ride/top-up/status", {
            params: { ref: clientReference },
          });
          if (statusRes.data?.status === "completed") {
            setTopUpMessage("Debt cleared successfully.");
            load();
            return;
          }
          if (statusRes.data?.status === "failed") {
            setTopUpMessage("Payment failed. Please try again.");
            return;
          }
        } catch {
          // keep polling
        }
      }
      setTopUpMessage("Payment pending — pull down to refresh when complete.");
    },
    [load]
  );

  const handleClearDebt = async () => {
    setTopUpMessage(null);
    setTopUpLoading(true);
    try {
      const res = await appAxios.post("/ride/top-up", {
        amount: Math.abs(balance),
      });
      if (res.data?.paymentRequired) {
        setTopUpMessage(
          res.data?.message || "Approve the MoMo prompt on your phone."
        );
        if (res.data?.clientReference) {
          pollTopUpStatus(res.data.clientReference);
        }
      } else {
        setTopUpMessage(res.data?.message || "Debt cleared successfully.");
        load();
      }
    } catch (e: any) {
      const msg = e?.response?.data?.msg || e?.message || "Failed to clear debt.";
      setTopUpMessage(msg);
    } finally {
      setTopUpLoading(false);
    }
  };

  const openCashOutModal = () => {
    setCashoutAmountInput(walletBalance > 0 ? String(walletBalance) : "");
    setCashoutMessage(null);
    setCashoutModalVisible(true);
  };

  const handleCashOut = async (amount?: number) => {
    setCashoutMessage(null);
    setCashoutLoading(true);
    try {
      const payload =
        amount != null && Number.isFinite(amount) ? { amount } : undefined;
      const res = await appAxios.post("/ride/cashout", payload);
      setCashoutMessage(res.data?.message || "Cash out sent to your MoMo.");
      setCashoutModalVisible(false);
      load();
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        status === 404
          ? "Cash out API not found — restart your local server or redeploy the API."
          : e?.response?.data?.msg || e?.response?.data?.message || e?.message || "Failed to cash out.";
      setCashoutMessage(msg);
    } finally {
      setCashoutLoading(false);
    }
  };

  const submitCashOut = () => {
    const parsed = parseFloat(cashoutAmountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setCashoutMessage("Enter a valid amount.");
      return;
    }
    if (parsed > walletBalance) {
      setCashoutMessage("Amount exceeds wallet balance.");
      return;
    }
    if (parsed < minCashoutAmount) {
      setCashoutMessage(`Minimum cash out is ${formatCurrency(minCashoutAmount)}.`);
      return;
    }
    handleCashOut(parsed);
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
          <CustomText fontFamily="SemiBold" fontSize={14} style={styles.summaryLabel}>
            Your earnings from trips
          </CustomText>
          <CustomText fontSize={26} fontFamily="Bold" style={styles.riderAmount}>
            {formatCurrency(riderAmount)}
          </CustomText>
          <View style={styles.summaryRow}>
            <CustomText fontSize={13} style={styles.summaryMuted}>Total sales (gross)</CustomText>
            <CustomText fontSize={13} fontFamily="Medium">{formatCurrency(totalEarnings)}</CustomText>
          </View>
          <View style={styles.summaryRow}>
            <CustomText fontSize={13} style={styles.summaryMuted}>Commission to company</CustomText>
            <CustomText fontSize={13} fontFamily="Medium" style={{ color: "#dc2626" }}>
              -{formatCurrency(totalCommission)}
            </CustomText>
          </View>
        </View>

        {/* Cash vs MoMo sales breakdown */}
        <View style={styles.salesCard}>
          <CustomText fontFamily="SemiBold" fontSize={16} style={styles.salesTitle}>
            Total sales by payment
          </CustomText>
          <CustomText fontSize={12} style={styles.salesSubtitle}>
            All completed trips — cash collected from customer vs MoMo paid through QareGO.
          </CustomText>

          <View style={styles.salesTotalRow}>
            <View>
              <CustomText fontSize={12} style={styles.summaryMuted}>All trips</CustomText>
              <CustomText fontSize={11} style={styles.salesTripCount}>
                {salesSummary.total.trips} trip{salesSummary.total.trips !== 1 ? "s" : ""}
              </CustomText>
            </View>
            <View style={styles.salesAmountCol}>
              <CustomText fontSize={12} style={styles.summaryMuted}>Gross</CustomText>
              <CustomText fontFamily="SemiBold" fontSize={15}>
                {formatCurrency(salesSummary.total.gross)}
              </CustomText>
            </View>
            <View style={styles.salesAmountCol}>
              <CustomText fontSize={12} style={styles.summaryMuted}>Your net</CustomText>
              <CustomText fontFamily="SemiBold" fontSize={15} style={{ color: "#16a34a" }}>
                {formatCurrency(salesSummary.total.net)}
              </CustomText>
            </View>
          </View>

          <View style={styles.salesDivider} />

          <View style={styles.salesChannelRow}>
            <View style={[styles.salesChannelIcon, styles.salesChannelIconCash]}>
              <Ionicons name="cash-outline" size={18} color="#b45309" />
            </View>
            <View style={{ flex: 1 }}>
              <CustomText fontFamily="Medium" fontSize={14}>Cash trips</CustomText>
              <CustomText fontSize={11} style={styles.salesTripCount}>
                {salesSummary.cash.trips} trip{salesSummary.cash.trips !== 1 ? "s" : ""} · collected from customer
              </CustomText>
            </View>
            <View style={styles.salesAmountCol}>
              <CustomText fontFamily="SemiBold" fontSize={14}>
                {formatCurrency(salesSummary.cash.gross)}
              </CustomText>
              <CustomText fontSize={11} style={{ color: "#16a34a" }}>
                net {formatCurrency(salesSummary.cash.net)}
              </CustomText>
            </View>
          </View>

          <View style={styles.salesChannelRow}>
            <View style={[styles.salesChannelIcon, styles.salesChannelIconMomo]}>
              <Ionicons name="phone-portrait-outline" size={18} color="#1d4ed8" />
            </View>
            <View style={{ flex: 1 }}>
              <CustomText fontFamily="Medium" fontSize={14}>MoMo trips</CustomText>
              <CustomText fontSize={11} style={styles.salesTripCount}>
                {salesSummary.momo.trips} trip{salesSummary.momo.trips !== 1 ? "s" : ""} · paid via mobile money
              </CustomText>
            </View>
            <View style={styles.salesAmountCol}>
              <CustomText fontFamily="SemiBold" fontSize={14}>
                {formatCurrency(salesSummary.momo.gross)}
              </CustomText>
              <CustomText fontSize={11} style={{ color: "#16a34a" }}>
                net {formatCurrency(salesSummary.momo.net)}
              </CustomText>
            </View>
          </View>
        </View>

        {/* Virtual wallet / commission owed */}
        <View style={[styles.balanceCard, isDebt && styles.balanceCardDebt, hasWallet && styles.balanceCardWallet]}>
          <View style={styles.balanceHeader}>
            <View style={[styles.balanceIconWrap, isDebt && styles.balanceIconWrapDebt, hasWallet && styles.balanceIconWrapWallet]}>
              <Ionicons
                name={isDebt ? "alert-circle-outline" : "wallet-outline"}
                size={28}
                color={isDebt ? "#fff" : Colors.primary}
              />
            </View>
            <CustomText fontSize={14} color={isDebt ? "rgba(255,255,255,0.9)" : "#666"}>
              {isDebt ? "Commission Owed" : "Virtual Wallet"}
            </CustomText>
          </View>
          <CustomText
            fontSize={30}
            fontFamily="Bold"
            style={[styles.balanceAmount, isDebt && styles.balanceAmountDebt]}
          >
            {formatCurrency(isDebt ? Math.abs(balance) : walletBalance)}
          </CustomText>
          <CustomText fontSize={12} color={isDebt ? "rgba(255,255,255,0.8)" : "#888"} style={styles.balanceSubtext}>
            {isDebt
              ? "Amount to pay to company. Top up to continue receiving rides."
              : hasWallet
                ? "Earnings from MoMo trips. Cash out to your registered phone anytime."
                : "MoMo trip earnings appear here. Cash out anytime when you have a balance."}
          </CustomText>
          {!isDebt && balance === 0 && transactions.length === 0 && (
            <CustomText fontSize={12} color="#888" style={styles.balanceHint}>
              After cash trips, commission owed shows as a negative balance until you top up.
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
                            {getTxLabel(tx.type, tx.note)}
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

      {(canCashOut || cashoutLoading) && !isDebt ? (
        <View style={styles.stickyFooter}>
          {cashoutMessage && !cashoutModalVisible ? (
            <CustomText fontSize={12} style={styles.stickyCashoutMessage}>
              {cashoutMessage}
            </CustomText>
          ) : null}
          <TouchableOpacity
            style={[styles.stickyCashOutBtn, cashoutLoading && { opacity: 0.7 }]}
            onPress={openCashOutModal}
            disabled={cashoutLoading}
          >
            <Ionicons name="cash-outline" size={20} color="#1a1a1a" style={{ marginRight: 8 }} />
            <CustomText fontFamily="SemiBold" fontSize={15} style={{ color: "#1a1a1a", flex: 1 }}>
              {cashoutLoading ? "Sending..." : `Cash Out ${formatCurrency(walletBalance)}`}
            </CustomText>
            {!cashoutLoading ? (
              <Ionicons name="arrow-forward" size={18} color="#1a1a1a" />
            ) : (
              <ActivityIndicator size="small" color="#1a1a1a" />
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        visible={cashoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !cashoutLoading && setCashoutModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <CustomText fontFamily="SemiBold" fontSize={18} style={styles.modalTitle}>
              Cash Out
            </CustomText>
            <CustomText fontSize={13} style={styles.modalSubtitle}>
              Available: {formatCurrency(walletBalance)} · Min {formatCurrency(minCashoutAmount)}
            </CustomText>
            <TextInput
              style={styles.cashoutInput}
              value={cashoutAmountInput}
              onChangeText={setCashoutAmountInput}
              keyboardType="decimal-pad"
              placeholder="Amount (GHS)"
              editable={!cashoutLoading}
            />
            <TouchableOpacity
              style={styles.cashoutAllLink}
              onPress={() => setCashoutAmountInput(String(walletBalance))}
              disabled={cashoutLoading}
            >
              <CustomText fontSize={13} style={{ color: Colors.primary }} fontFamily="Medium">
                Cash out full balance
              </CustomText>
            </TouchableOpacity>
            {cashoutMessage ? (
              <CustomText fontSize={12} style={styles.modalError}>
                {cashoutMessage}
              </CustomText>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCashoutModalVisible(false)}
                disabled={cashoutLoading}
              >
                <CustomText fontFamily="Medium">Cancel</CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, cashoutLoading && { opacity: 0.7 }]}
                onPress={submitCashOut}
                disabled={cashoutLoading}
              >
                {cashoutLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <CustomText fontFamily="SemiBold" style={{ color: "#fff" }}>
                    Confirm
                  </CustomText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  scrollContent: { padding: 20, paddingBottom: 100 },
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
  balanceCardWallet: {
    backgroundColor: "#ecfdf5",
    borderColor: "#6ee7b7",
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
  balanceIconWrapWallet: {
    backgroundColor: "#d1fae5",
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
    color: "#666",
  },
  summaryMuted: {
    color: "#666",
  },
  summaryNote: {
    marginTop: 8,
    color: "#888",
    lineHeight: 16,
  },
  salesCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  salesTitle: {
    color: Colors.text,
    marginBottom: 4,
  },
  salesSubtitle: {
    color: "#888",
    lineHeight: 16,
    marginBottom: 16,
  },
  salesTotalRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  salesAmountCol: {
    alignItems: "flex-end",
    minWidth: 72,
  },
  salesTripCount: {
    color: "#888",
    marginTop: 2,
  },
  salesDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 14,
  },
  salesChannelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  salesChannelIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  salesChannelIconCash: {
    backgroundColor: "#fef3c7",
  },
  salesChannelIconMomo: {
    backgroundColor: "#dbeafe",
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
  cashoutMessage: {
    color: "#047857",
    marginTop: 12,
  },
  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 28,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  stickyCashOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  stickyCashoutMessage: {
    color: "#dc2626",
    marginBottom: 8,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
  },
  modalTitle: {
    marginBottom: 6,
  },
  modalSubtitle: {
    marginBottom: 16,
    color: "#666",
  },
  cashoutInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    marginBottom: 8,
  },
  cashoutAllLink: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  modalError: {
    color: "#dc2626",
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
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
