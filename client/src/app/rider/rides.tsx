import {
  View,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { commonStyles } from "@/styles/commonStyles";
import RideCard from "@/components/shared/RideCard";
import { fetchRideHistory } from "@/service/rideService";
import CustomText from "@/components/shared/CustomText";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/utils/Constants";

const ACTIVE_STATUSES = ["SEARCHING_FOR_RIDER", "START", "ARRIVED", "IN_PROGRESS"];
type FilterType = "all" | "COMPLETED" | "in_progress";

const RiderRides = () => {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  const loadRides = useCallback(async () => {
    try {
      const data = await fetchRideHistory();
      setRides(data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRides();
  }, [loadRides]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRides();
  };

  const filteredRides = useMemo(() => {
    if (filter === "all") return rides;
    if (filter === "COMPLETED") return rides.filter((r) => r.status === "COMPLETED");
    return rides.filter((r) => ACTIVE_STATUSES.includes(r.status));
  }, [rides, filter]);

  const filterChips: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "COMPLETED", label: "Completed" },
    { key: "in_progress", label: "In progress" },
  ];

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="car-outline" size={48} color={Colors.primary} />
      </View>
      <CustomText fontFamily="SemiBold" fontSize={16} style={styles.emptyTitle}>
        No trips yet
      </CustomText>
      <CustomText fontSize={14} color="#888" style={styles.emptySub}>
        {filter === "all"
          ? "Your completed and active trips will appear here."
          : filter === "COMPLETED"
          ? "No completed trips."
          : "No trips in progress."}
      </CustomText>
    </View>
  );

  return (
    <View style={commonStyles.container}>
      <SafeAreaView style={styles.safeArea} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <CustomText variant="h5" fontFamily="SemiBold">
          Ride History
        </CustomText>
      </View>

      <View style={styles.filterRow}>
        {filterChips.map((chip) => (
          <TouchableOpacity
            key={chip.key}
            onPress={() => setFilter(chip.key)}
            style={[styles.chip, filter === chip.key && styles.chipActive]}
          >
            <CustomText
              fontSize={13}
              fontFamily="Medium"
              style={{ color: filter === chip.key ? "#fff" : Colors.text }}
            >
              {chip.label}
            </CustomText>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredRides.length === 0 ? (
        <View style={styles.emptyWrap}>{renderEmpty()}</View>
      ) : (
        <FlatList
          data={filteredRides}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <RideCard item={item} role="rider" />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListHeaderComponent={
            <CustomText fontSize={12} color="#888" style={styles.listHeader}>
              {filteredRides.length} trip{filteredRides.length !== 1 ? "s" : ""}
            </CustomText>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: "#fff" },
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
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  chipActive: {
    backgroundColor: Colors.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  listHeader: {
    marginBottom: 12,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyContainer: {
    alignItems: "center",
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#fef9e7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 8,
  },
  emptySub: {
    textAlign: "center",
  },
});

export default RiderRides;
