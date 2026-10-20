import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { fetchLaundryPickupSlots, type LaundryPickupSlots } from "@/service/foodService";
import { pickupDayLabel, pickupTimeRange } from "@/utils/laundryPickup";

type Props = {
  restaurantId: string;
  accent: string;
  /** Window start (ISO), or null for "as soon as possible". */
  value: string | null;
  onChange: (value: string | null) => void;
  /** False until a valid choice exists (slots loaded and either ASAP or a window picked). */
  onReadyChange: (ready: boolean) => void;
};

/**
 * When should the rider collect the laundry? "As soon as possible" while the shop is open,
 * or a 2-hour window from the shop's opening hours over the next few days.
 */
export default function LaundryPickupPicker({ restaurantId, accent, value, onChange, onReadyChange }: Props) {
  const [data, setData] = useState<LaundryPickupSlots | null>(null);
  const [error, setError] = useState(false);
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLaundryPickupSlots(restaurantId)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(false);
        // Closed now: ASAP isn't possible, so start on the first window.
        if (!d.asapAvailable && d.slots[0]) onChange(d.slots[0].start);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
    // onChange is a state setter from the cart; reload only when the shop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const days = useMemo(() => {
    const map = new Map<string, { key: string; label: string; slots: { start: string; end: string }[] }>();
    for (const s of data?.slots ?? []) {
      const d = new Date(s.start);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, { key, label: pickupDayLabel(d), slots: [] });
      map.get(key)!.slots.push(s);
    }
    return [...map.values()];
  }, [data]);

  const selectedDayKey = useMemo(() => {
    if (value) {
      const d = new Date(value);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }
    return day ?? days[0]?.key ?? null;
  }, [value, day, days]);

  const ready = !!data && (value ? data.slots.some((s) => s.start === value) : data.asapAvailable);
  useEffect(() => onReadyChange(ready), [ready, onReadyChange]);

  if (error) {
    return (
      <CustomText fontSize={13} color="#b91c1c">
        Couldn&apos;t load pickup times. Pull down to refresh or try again.
      </CustomText>
    );
  }
  if (!data) return <ActivityIndicator color={accent} style={{ alignSelf: "flex-start" }} />;
  if (!data.asapAvailable && !data.slots.length) {
    return (
      <CustomText fontSize={13} color="#b45309">
        No pickup times available in the next few days. Please check back later.
      </CustomText>
    );
  }

  const activeDay = days.find((d) => d.key === selectedDayKey) ?? days[0];

  return (
    <View>
      {data.asapAvailable ? (
        <TouchableOpacity
          style={[styles.asap, value === null && { borderColor: accent, backgroundColor: `${accent}12` }]}
          onPress={() => onChange(null)}
          activeOpacity={0.8}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === null }}
        >
          <Ionicons name="flash-outline" size={18} color={value === null ? accent : "#64748b"} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <CustomText fontFamily="SemiBold" fontSize={14}>
              As soon as possible
            </CustomText>
            <CustomText fontSize={12} color="#64748b">
              A rider is sent once the laundry accepts
            </CustomText>
          </View>
          {value === null ? <Ionicons name="checkmark-circle" size={20} color={accent} /> : null}
        </TouchableOpacity>
      ) : null}

      {days.length ? (
        <>
          <CustomText fontSize={12} color="#64748b" style={{ marginTop: data.asapAvailable ? 12 : 0, marginBottom: 8 }}>
            {data.asapAvailable ? "Or book a time" : "The laundry is closed now. Book a pickup time:"}
          </CustomText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {days.map((d) => {
              const on = d.key === activeDay?.key && value !== null;
              return (
                <TouchableOpacity
                  key={d.key}
                  onPress={() => {
                    setDay(d.key);
                    // Picking a day picks its first window, so there's always a time chosen.
                    onChange(d.slots[0].start);
                  }}
                  style={[styles.dayChip, on && { backgroundColor: accent, borderColor: accent }]}
                  activeOpacity={0.8}
                >
                  <CustomText fontFamily="SemiBold" fontSize={13} color={on ? "#fff" : "#334155"}>
                    {d.label}
                  </CustomText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {value !== null && activeDay ? (
            <View style={styles.slotGrid}>
              {activeDay.slots.map((s) => {
                const on = s.start === value;
                return (
                  <TouchableOpacity
                    key={s.start}
                    onPress={() => onChange(s.start)}
                    style={[styles.slot, on && { borderColor: accent, backgroundColor: `${accent}12` }]}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                  >
                    <CustomText fontFamily="Medium" fontSize={13} color={on ? accent : "#334155"} numberOfLines={1}>
                      {pickupTimeRange(s.start, data.windowMinutes)}
                    </CustomText>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  asap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
  },
  dayRow: { gap: 8, paddingBottom: 4 },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  slot: {
    width: "31%",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
});
