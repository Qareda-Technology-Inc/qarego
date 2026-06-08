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
import { Colors } from "@/utils/Constants";
import { fetchRiderReliability } from "@/service/rideService";

type ServiceReliability = {
  serviceType: string;
  label: string;
  strikes: number;
  offersDeclined: number;
  offersAccepted: number;
  completed: number;
  isPaused: boolean;
  pausedReason?: string | null;
  strikesUntilPause: number;
};

export default function RiderReliabilityScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState<ServiceReliability[]>([]);
  const [policy, setPolicy] = useState({ strikesBeforePause: 5, pauseDurationHours: 24 });

  const load = useCallback(async () => {
    try {
      const data = await fetchRiderReliability();
      setServices(data.services || []);
      if (data.policy) setPolicy(data.policy);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
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
          Reliability
        </CustomText>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        <CustomText fontSize={13} color="#666" style={{ marginBottom: 16 }}>
          Missing offers without accepting adds strikes. After {policy.strikesBeforePause} strikes, that service pauses for {policy.pauseDurationHours} hours. Completing trips reduces strikes.
        </CustomText>

        {services.map((svc) => (
          <View
            key={svc.serviceType}
            style={[styles.card, svc.isPaused && styles.cardPaused]}
          >
            <View style={styles.cardHeader}>
              <CustomText fontFamily="SemiBold" fontSize={16}>
                {svc.label}
              </CustomText>
              {svc.isPaused ? (
                <View style={styles.pausedBadge}>
                  <CustomText fontSize={10} fontFamily="Bold" style={{ color: "#fff" }}>
                    PAUSED
                  </CustomText>
                </View>
              ) : (
                <CustomText fontSize={12} color="#16a34a">
                  Active
                </CustomText>
              )}
            </View>
            {svc.isPaused && svc.pausedReason ? (
              <CustomText fontSize={12} color="#b45309" style={{ marginBottom: 8 }}>
                {svc.pausedReason}
              </CustomText>
            ) : null}
            <View style={styles.statGrid}>
              <View style={styles.stat}>
                <CustomText fontSize={18} fontFamily="Bold">{svc.strikes}</CustomText>
                <CustomText fontSize={10} color="#666">Strikes</CustomText>
              </View>
              <View style={styles.stat}>
                <CustomText fontSize={18} fontFamily="Bold">{svc.strikesUntilPause}</CustomText>
                <CustomText fontSize={10} color="#666">Until pause</CustomText>
              </View>
              <View style={styles.stat}>
                <CustomText fontSize={18} fontFamily="Bold">{svc.completed}</CustomText>
                <CustomText fontSize={10} color="#666">Completed</CustomText>
              </View>
              <View style={styles.stat}>
                <CustomText fontSize={18} fontFamily="Bold">{svc.offersDeclined}</CustomText>
                <CustomText fontSize={10} color="#666">Missed</CustomText>
              </View>
            </View>
          </View>
        ))}
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
  scroll: { padding: 16, paddingBottom: 40 },
  centered: { justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardPaused: {
    borderColor: "#fbbf24",
    backgroundColor: "#fffbeb",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  pausedBadge: {
    backgroundColor: "#d97706",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: { alignItems: "center", flex: 1 },
});
