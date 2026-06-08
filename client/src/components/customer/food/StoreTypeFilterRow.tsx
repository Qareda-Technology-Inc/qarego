import { ScrollView, TouchableOpacity, StyleSheet, Text, ViewStyle } from "react-native";
import React, { FC } from "react";
import { STORE_TYPE_FILTERS, StoreTypeFilter } from "@/utils/storeVertical";
import { FOOD_THEME } from "@/styles/foodStyles";

export { STORE_TYPE_FILTERS };

type Props = {
  value: StoreTypeFilter;
  onChange: (type: StoreTypeFilter) => void;
  style?: ViewStyle;
};

const StoreTypeFilterRow: FC<Props> = ({ value, onChange, style }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={[styles.scroll, style]}
    contentContainerStyle={styles.row}
  >
    {STORE_TYPE_FILTERS.map((f) => {
      const active = value === f.key;
      return (
        <TouchableOpacity
          key={f.key}
          style={[styles.chip, active && { backgroundColor: f.accent, borderColor: f.accent }]}
          onPress={() => onChange(f.key)}
        >
          <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  chip: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: FOOD_THEME.divider,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "500",
    color: FOOD_THEME.textLight,
  },
  chipTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default StoreTypeFilterRow;
