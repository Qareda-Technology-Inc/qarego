import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import React, { useCallback, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lifetime, setLifetime] = useState<{
    services: ServiceMetric[];
    totals: ServiceMetric & { offersSeen?: number };
  } | null>(null);
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
      <View style={[commonStyles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <CustomText variant="h5" fontFamily="SemiBold" style={styles.headerTitle}>
          Performance
        </CustomText>
        <View style={styles.headerSide} />
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
        style={styles.scrollView}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
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
          <CustomText fontSize={28} fontFamily="Bold" style={styles.summaryTrips}>
            {period?.totals.trips ?? 0} trips
          </CustomText>
          <CustomText fontSize={13} color="#666">
            Net {formatCurrency(period?.totals.netEarning ?? 0)} · Gross{" "}
            {formatCurrency(period?.totals.grossFare ?? 0)}
          </CustomText>
          <CustomText fontSize={12} color="#888" style={styles.summaryMeta}>
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
                <CustomText fontFamily="SemiBold" fontSize={15} style={styles.serviceLabel}>
                  {row.label}
                </CustomText>
                <CustomText fontSize={12} color={Colors.primary}>
                  {pct(life?.acceptanceRate)} accept
                </CustomText>
              </View>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <CustomText fontSize={11} color="#888" numberOfLines={1}>
                    Trips ({days}d)
                  </CustomText>
                  <CustomText fontFamily="SemiBold" fontSize={16} style={styles.statValue}>
                    {row.trips ?? 0}
                  </CustomText>
                </View>
                <View style={styles.stat}>
                  <CustomText fontSize={11} color="#888" numberOfLines={1}>
                    Net earned
                  </CustomText>
                  <CustomText fontFamily="SemiBold" fontSize={16} style={styles.statValue} numberOfLines={1}>
                    {formatCurrency(row.netEarning ?? 0)}
                  </CustomText>
                </View>
                <View style={styles.stat}>
                  <CustomText fontSize={11} color="#888" numberOfLines={1}>
                    Missed
                  </CustomText>
                  <CustomText fontFamily="SemiBold" fontSize={16} style={styles.statValue}>
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
          activeOpacity={0.85}
        >
          <Ionicons name="shield-outline" size={20} color={Colors.primary} />
          <CustomText fontSize={13} style={styles.linkText}>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerSide: {
    width: 40,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  dayRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    marginRight: 8,
  },
  dayChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  summaryTrips: {
    marginTop: 8,
    marginBottom: 4,
  },
  summaryMeta: {
    marginTop: 8,
  },
  sectionTitle: {
    marginBottom: 10,
  },
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
    gap: 8,
  },
  serviceLabel: {
    flex: 1,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stat: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
  },
  statValue: {
    marginTop: 4,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  linkText: {
    flex: 1,
    marginLeft: 10,
  },
});
