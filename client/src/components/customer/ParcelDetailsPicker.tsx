import React, { FC } from "react";
import { View, TouchableOpacity, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { ParcelTheme as P } from "@/styles/parcelTheme";
import { formatCurrency } from "@/utils/Constants";
import {
  PARCEL_CATEGORIES,
  PARCEL_SIZES,
  type ParcelCategory,
  type ParcelSize,
} from "@/utils/parcelDetails";

type Props = {
  size: ParcelSize;
  category: ParcelCategory | null;
  fragile: boolean;
  /** Fare per vehicle; a missing or zero price means that vehicle can't be booked now. */
  prices: { motorcycle?: number | null; pragya?: number | null };
  busyVehicles: Set<string>;
  onChangeSize: (s: ParcelSize) => void;
  onChangeCategory: (c: ParcelCategory | null) => void;
  onChangeFragile: (v: boolean) => void;
};

/** Size (which also picks motorbike or tricycle), what's inside, and fragile. */
const ParcelDetailsPicker: FC<Props> = ({
  size,
  category,
  fragile,
  prices,
  busyVehicles,
  onChangeSize,
  onChangeCategory,
  onChangeFragile,
}) => {
  return (
    <View style={styles.card}>
      <CustomText fontFamily="SemiBold" fontSize={15} style={styles.title}>
        Size
      </CustomText>
      <View style={styles.sizes}>
        {PARCEL_SIZES.map((s) => {
          const price = Number(prices[s.vehicle] ?? 0);
          const unavailable = busyVehicles.has(s.vehicle) || !Number.isFinite(price) || price <= 0;
          const on = size === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.size, on && styles.sizeOn, unavailable && styles.sizeOff]}
              onPress={() => !unavailable && onChangeSize(s.key)}
              activeOpacity={unavailable ? 1 : 0.8}
              accessibilityState={{ selected: on, disabled: unavailable }}
            >
              <Ionicons name={s.icon} size={20} color={unavailable ? T.inkSoft : P.accent} />
              <CustomText fontFamily="SemiBold" fontSize={12} style={styles.sizeLabel}>
                {s.label}
              </CustomText>
              <CustomText fontSize={10} style={styles.sizeHint}>
                {s.hint}
              </CustomText>
              <CustomText fontFamily="SemiBold" fontSize={11} style={on ? styles.priceOn : styles.price}>
                {unavailable ? "Busy" : formatCurrency(price)}
              </CustomText>
            </TouchableOpacity>
          );
        })}
      </View>
      <CustomText fontSize={11} style={styles.note}>
        {size === "LARGE"
          ? "Goes by tricycle · up to about 15 kg"
          : "Goes by motorbike · up to about 5 kg"}
      </CustomText>

      <CustomText fontFamily="SemiBold" fontSize={15} style={[styles.title, styles.gap]}>
        {"What's inside"}
      </CustomText>
      <View style={styles.chips}>
        {PARCEL_CATEGORIES.map((c) => {
          const on = category === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              onPress={() => onChangeCategory(on ? null : c.key)}
              style={[styles.chip, on && styles.chipOn]}
              activeOpacity={0.8}
            >
              <CustomText fontSize={12} fontFamily="Medium" style={on ? styles.chipTextOn : styles.chipText}>
                {c.label}
              </CustomText>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.fragileRow}>
        <Ionicons name="wine-outline" size={18} color={P.accent} />
        <View style={styles.fragileText}>
          <CustomText fontFamily="SemiBold" fontSize={14} style={styles.title}>
            Fragile
          </CustomText>
          <CustomText fontSize={11} style={styles.note}>
            The rider is told to handle it with care
          </CustomText>
        </View>
        <Switch
          value={fragile}
          onValueChange={onChangeFragile}
          trackColor={{ true: P.accent, false: "#d1d5db" }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.sheetBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  title: { color: T.ink },
  gap: { marginTop: 16 },
  sizes: { flexDirection: "row", gap: 6, marginTop: 10 },
  size: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    gap: 2,
  },
  sizeOn: { borderColor: P.accent, borderWidth: 1.5, backgroundColor: "#FAF5FF" },
  sizeOff: { opacity: 0.5 },
  sizeLabel: { color: T.ink, marginTop: 2 },
  sizeHint: { color: T.inkMuted },
  price: { color: T.inkMuted, marginTop: 2 },
  priceOn: { color: P.ink, marginTop: 2 },
  note: { color: T.inkMuted, marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: P.accentSoft },
  chipOn: { backgroundColor: P.accent },
  chipText: { color: P.ink },
  chipTextOn: { color: "#fff" },
  fragileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  fragileText: { flex: 1 },
});

export default ParcelDetailsPicker;
