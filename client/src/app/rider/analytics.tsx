import {
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import React, { useCallback, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { commonStyles } from "@/styles/commonStyles";
import CustomText from "@/components/shared/CustomText";
import { Colors, formatCurrency } from "@/utils/Constants";
import { fetchRiderDispatchAnalytics } from "@/service/rideService";

type ServiceMetric = {
  serviceType: string;
  label: string;
  offersAccepted?: number;
  offersDeclined?: number;
  acceptanceRate?: number | null;
  trips?: number;
  grossFare?: number;
  netEarning?: number;
  lifetimeAcceptanceRate?: number | null;
};

const DAY_OPTIONS = [7, 14, 30];

function pct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${v}%`;
}

export default function RiderAnalyticsScreen() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lifetime, setLifetime] = useState<{ services: ServiceMetric[]; totals: ServiceMetric & { offersSeen?: number } } | null>(null);
  const [period, setPeriod] = useState<{
    services: ServiceMetric[];
    totals: { trips: number; grossFare: number; netEarning: number };
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchRiderDispatchAnalytics(days);
      setLifetime(data.lifetime);
      setPeriod(data.period);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  React.useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={[commonStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <SafeAreaView style={{ backgroundColor: "#fff" }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <CustomText variant="h5" fontFamily="SemiBold">
          Performance
        </CustomText>
      </View>

      <View style={styles.dayRow}>
        {DAY_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.dayChip, days === d && styles.dayChipActive]}
            onPress={() => setDays(d)}
          >
            <CustomText
              fontSize={12}
              fontFamily={days === d ? "SemiBold" : "Regular"}
              style={{ color: days === d ? "#fff" : Colors.text }}
            >
              {d}d
            </CustomText>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={styles.summaryCard}>
          <CustomText fontFamily="SemiBold" fontSize={14}>
            Last {days} days
          </CustomText>
          <CustomText fontSize={28} fontFamily="Bold" style={{ marginTop: 8 }}>
            {period?.totals.trips ?? 0} trips
          </CustomText>
          <CustomText fontSize={13} color="#666" style={{ marginTop: 4 }}>
            Net {formatCurrency(period?.totals.netEarning ?? 0)} · Gross{" "}
            {formatCurrency(period?.totals.grossFare ?? 0)}
          </CustomText>
          <CustomText fontSize={12} color="#888" style={{ marginTop: 8 }}>
            Lifetime offer acceptance: {pct(lifetime?.totals?.acceptanceRate)}
            {lifetime?.totals?.offersSeen
              ? ` (${lifetime.totals.offersSeen} offers)`
              : ""}
          </CustomText>
        </View>

        <CustomText fontSize={13} fontFamily="SemiBold" style={styles.sectionTitle}>
          By service
        </CustomText>

        {(period?.services || []).map((row) => {
          const life = lifetime?.services?.find((s) => s.serviceType === row.serviceType);
          return (
            <View key={row.serviceType} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <CustomText fontFamily="SemiBold" fontSize={15}>
                  {row.label}
                </CustomText>
                <CustomText fontSize={12} color={Colors.primary}>
                  {pct(life?.acceptanceRate)} accept
                </CustomText>
              </View>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <CustomText fontSize={11} color="#888">
                    Trips ({days}d)
                  </CustomText>
                  <CustomText fontFamily="SemiBold" fontSize={16}>
                    {row.trips ?? 0}
                  </CustomText>
                </View>
                <View style={styles.stat}>
                  <CustomText fontSize={11} color="#888">
                    Net earned
                  </CustomText>
                  <CustomText fontFamily="SemiBold" fontSize={16}>
                    {formatCurrency(row.netEarning ?? 0)}
                  </CustomText>
                </View>
                <View style={styles.stat}>
                  <CustomText fontSize={11} color="#888">
                    Missed offers
                  </CustomText>
                  <CustomText fontFamily="SemiBold" fontSize={16}>
                    {life?.offersDeclined ?? 0}
                  </CustomText>
                </View>
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push("/rider/reliability")}
        >
          <Ionicons name="shield-outline" size={20} color={Colors.primary} />
          <CustomText fontSize={13} style={{ flex: 1, marginLeft: 10 }}>
            Strikes & service pauses
          </CustomText>
          <Ionicons name="chevron-forward" size={18} color="#999" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  backBtn: { marginRight: 12 },
  dayRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  dayChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  scroll: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  summaryCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  sectionTitle: { marginBottom: 10 },
  serviceCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  stat: { flex: 1 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
});
