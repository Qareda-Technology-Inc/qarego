import React, { useMemo, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { ParcelTheme as P } from "@/styles/parcelTheme";
import type { ParcelPoint, ParcelPointKind } from "@/service/parcelPointService";

const KINDS: { key: ParcelPointKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "BUS_STATION", label: "Bus stations", icon: "bus-outline" },
  { key: "MALL", label: "Malls", icon: "bag-handle-outline" },
  { key: "SHOP", label: "Shops", icon: "storefront-outline" },
  { key: "OFFICE", label: "Offices", icon: "business-outline" },
  { key: "OTHER", label: "Other", icon: "location-outline" },
];
const iconFor = (k: ParcelPointKind) => KINDS.find((x) => x.key === k)?.icon ?? "location-outline";

const COLLAPSED = 6;

const formatKm = (km: number | null) =>
  km == null ? null : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;

/**
 * Admin-added parcel points the customer can tap instead of searching an address.
 * `query` is what they are typing: when set, only matching points show (no chips).
 */
const ParcelPointList: React.FC<{
  points: ParcelPoint[];
  target: "pickup" | "drop";
  query: string;
  onPick: (point: ParcelPoint) => void;
}> = ({ points, target, query, onPick }) => {
  const [kind, setKind] = useState<ParcelPointKind | "ALL">("ALL");
  const [expanded, setExpanded] = useState(false);

  const usable = useMemo(
    () => points.filter((p) => (target === "pickup" ? p.canPickup : p.canDrop)),
    [points, target]
  );
  const kindsPresent = useMemo(
    () => KINDS.filter((k) => usable.some((p) => p.kind === k.key)),
    [usable]
  );

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    if (q) {
      return usable
        .filter((p) => `${p.name} ${p.address ?? ""} ${p.instructions ?? ""}`.toLowerCase().includes(q))
        .slice(0, 5);
    }
    return usable.filter((p) => kind === "ALL" || p.kind === kind);
  }, [usable, q, kind]);

  if (usable.length === 0 || (q && shown.length === 0)) return null;

  const visible = q || expanded ? shown : shown.slice(0, COLLAPSED);
  const title = target === "pickup" ? "Pickup points" : "Drop-off points";

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <CustomText fontFamily="SemiBold" fontSize={13} style={styles.sectionTitle}>
          {q ? `Matching ${title.toLowerCase()}` : `${title} near you`}
        </CustomText>
      </View>

      {!q && kindsPresent.length > 1 ? (
        <View style={styles.chips}>
          {[{ key: "ALL" as const, label: "All", icon: "apps-outline" as const }, ...kindsPresent].map(
            (k) => {
              const on = kind === k.key;
              return (
                <TouchableOpacity
                  key={k.key}
                  onPress={() => {
                    setKind(k.key);
                    setExpanded(false);
                  }}
                  style={[styles.chip, on && styles.chipOn]}
                  activeOpacity={0.8}
                >
                  <Ionicons name={k.icon} size={14} color={on ? "#fff" : P.ink} />
                  <CustomText fontSize={12} fontFamily="Medium" style={on ? styles.chipTextOn : styles.chipText}>
                    {k.label}
                  </CustomText>
                </TouchableOpacity>
              );
            }
          )}
        </View>
      ) : null}

      {visible.map((p) => {
        const km = formatKm(p.distanceKm);
        const sub = p.instructions || p.address;
        return (
          <TouchableOpacity key={p._id} style={styles.card} onPress={() => onPick(p)} activeOpacity={0.8}>
            <View style={styles.iconWrap}>
              <Ionicons name={iconFor(p.kind)} size={20} color={P.accent} />
            </View>
            <View style={styles.textWrap}>
              <CustomText fontFamily="SemiBold" fontSize={15} numberOfLines={1} style={styles.name}>
                {p.name}
              </CustomText>
              {sub ? (
                <CustomText fontSize={12} numberOfLines={1} style={styles.sub}>
                  {sub}
                </CustomText>
              ) : null}
              {p.hours ? (
                <CustomText fontSize={12} numberOfLines={1} style={styles.hours}>
                  {p.hours}
                </CustomText>
              ) : null}
            </View>
            {km ? (
              <CustomText fontSize={12} fontFamily="Medium" style={styles.km}>
                {km}
              </CustomText>
            ) : null}
          </TouchableOpacity>
        );
      })}

      {!q && shown.length > COLLAPSED ? (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={styles.more} activeOpacity={0.7}>
          <CustomText fontSize={13} fontFamily="SemiBold" style={styles.moreText}>
            {expanded ? "Show fewer" : `Show all ${shown.length}`}
          </CustomText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingTop: 18 },
  headerRow: { paddingBottom: 10 },
  sectionTitle: { color: T.inkMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: P.accentSoft,
  },
  chipOn: { backgroundColor: P.accent },
  chipText: { color: P.ink },
  chipTextOn: { color: "#fff" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.sheetBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: T.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: P.accentSoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textWrap: { flex: 1, minWidth: 0 },
  name: { color: T.ink },
  sub: { marginTop: 2, color: T.inkMuted },
  hours: { marginTop: 2, color: T.inkSoft },
  km: { color: P.ink, marginLeft: 8 },
  more: { alignItems: "center", paddingVertical: 10 },
  moreText: { color: P.accent },
});

export default ParcelPointList;
