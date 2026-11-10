import React, { useMemo, useState } from "react";
import { View, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";
import { ParcelTheme as P } from "@/styles/parcelTheme";
import type { ParcelPoint, ParcelPointKind } from "@/service/parcelPointService";

const KINDS: { key: ParcelPointKind; label: string; plural: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "BUS_STATION", label: "Bus station", plural: "Bus stations", icon: "bus-outline" },
  { key: "MALL", label: "Mall", plural: "Malls", icon: "bag-handle-outline" },
  { key: "SHOP", label: "Shop", plural: "Shops", icon: "storefront-outline" },
  { key: "OFFICE", label: "Office", plural: "Offices", icon: "business-outline" },
  { key: "OTHER", label: "Other", plural: "Other places", icon: "location-outline" },
];
const kindOf = (k: ParcelPointKind) => KINDS.find((x) => x.key === k) ?? KINDS[KINDS.length - 1];

const COLLAPSED = 5;

const formatKm = (km: number | null) =>
  km == null ? null : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;

const KindIcon = ({ kind }: { kind: ParcelPointKind }) => (
  <View style={styles.icon}>
    <Ionicons name={kindOf(kind).icon} size={17} color={P.accent} />
  </View>
);

/**
 * Admin-added parcel points the customer can tap instead of searching an address:
 * - while typing: matching points, tagged "Point", above the map results;
 * - choosing where to drop a parcel: swipeable cards of the nearest points;
 * - choosing where to collect one: type chips and a list, with the chosen point's meeting spot.
 */
const ParcelPointList: React.FC<{
  points: ParcelPoint[];
  target: "pickup" | "drop";
  query: string;
  onPick: (point: ParcelPoint) => void;
  /** The point already chosen for this field, if any. */
  selectedId?: string | null;
}> = ({ points, target, query, onPick, selectedId }) => {
  const [kind, setKind] = useState<ParcelPointKind | null>(null);
  const [expanded, setExpanded] = useState(false);

  const usable = useMemo(
    () => points.filter((p) => (target === "pickup" ? p.canPickup : p.canDrop)),
    [points, target]
  );
  const kindsPresent = useMemo(() => KINDS.filter((k) => usable.some((p) => p.kind === k.key)), [usable]);
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      q
        ? usable.filter((p) => `${p.name} ${p.address ?? ""} ${p.instructions ?? ""}`.toLowerCase().includes(q)).slice(0, 4)
        : [],
    [usable, q]
  );

  if (!usable.length) return null;

  // Typing: matching points first.
  if (q) {
    if (!matches.length) return null;
    return (
      <View>
        <CustomText fontFamily="Medium" fontSize={12} style={styles.section}>
          QareGO points
        </CustomText>
        {matches.map((p) => (
          <TouchableOpacity key={p._id} style={styles.row} onPress={() => onPick(p)} activeOpacity={0.75}>
            <KindIcon kind={p.kind} />
            <View style={styles.textWrap}>
              <CustomText fontFamily="Medium" fontSize={15} numberOfLines={1} style={{ color: T.ink }}>
                {p.name}
              </CustomText>
              <CustomText fontSize={12} numberOfLines={1} style={styles.sub}>
                {[p.instructions || p.address, formatKm(p.distanceKm)].filter(Boolean).join(" · ")}
              </CustomText>
            </View>
            <View style={styles.tag}>
              <CustomText fontSize={11} fontFamily="Medium" style={{ color: P.ink }}>
                Point
              </CustomText>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // Dropping a parcel off: the nearest points as cards.
  if (target === "drop") {
    return (
      <View>
        <CustomText fontFamily="Medium" fontSize={12} style={styles.section}>
          Drop at a QareGO point
        </CustomText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {usable.slice(0, 10).map((p) => {
            const on = p._id === selectedId;
            return (
              <TouchableOpacity
                key={p._id}
                style={[styles.pointCard, on && { borderColor: P.accent, backgroundColor: P.accentSoft }]}
                onPress={() => onPick(p)}
                activeOpacity={0.85}
              >
                <KindIcon kind={p.kind} />
                <CustomText fontFamily="Medium" fontSize={14} numberOfLines={1} style={{ color: T.ink, marginTop: 8 }}>
                  {p.name}
                </CustomText>
                <CustomText fontSize={11} numberOfLines={1} style={styles.sub}>
                  {[formatKm(p.distanceKm), p.instructions].filter(Boolean).join(" · ") || kindOf(p.kind).label}
                </CustomText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // Collecting a parcel: where is it waiting?
  const activeKind = kind && kindsPresent.some((k) => k.key === kind) ? kind : null;
  const filtered = usable.filter((p) => !activeKind || p.kind === activeKind);
  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED);
  const selected = usable.find((p) => p._id === selectedId) ?? null;
  const listTitle = activeKind ? `${kindOf(activeKind).plural} near you` : "Points near you";

  return (
    <View>
      <View style={styles.askCard}>
        <CustomText fontSize={12} style={{ color: T.inkMuted }}>
          Where&apos;s the parcel waiting?
        </CustomText>
        <View style={styles.chips}>
          {kindsPresent.map((k) => {
            const on = activeKind === k.key;
            return (
              <TouchableOpacity
                key={k.key}
                onPress={() => {
                  setKind(on ? null : k.key);
                  setExpanded(false);
                }}
                style={[styles.chip, on && { backgroundColor: P.accent, borderColor: P.accent }]}
                activeOpacity={0.8}
              >
                <CustomText fontSize={12} fontFamily="Medium" style={{ color: on ? "#fff" : T.ink }}>
                  {k.label}
                </CustomText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <CustomText fontFamily="Medium" fontSize={12} style={styles.section}>
        {listTitle}
      </CustomText>
      {visible.map((p) => {
        const on = p._id === selectedId;
        return (
          <TouchableOpacity key={p._id} style={styles.row} onPress={() => onPick(p)} activeOpacity={0.75}>
            <KindIcon kind={p.kind} />
            <View style={styles.textWrap}>
              <CustomText fontFamily="Medium" fontSize={15} numberOfLines={1} style={{ color: T.ink }}>
                {p.name}
              </CustomText>
              <CustomText fontSize={12} numberOfLines={1} style={styles.sub}>
                {[formatKm(p.distanceKm), p.hours].filter(Boolean).join(" · ") || p.address || kindOf(p.kind).label}
              </CustomText>
            </View>
            <Ionicons
              name={on ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={on ? P.accent : "#cbd5e1"}
            />
          </TouchableOpacity>
        );
      })}
      {filtered.length > COLLAPSED ? (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} style={styles.more} activeOpacity={0.7}>
          <CustomText fontSize={13} fontFamily="SemiBold" style={{ color: P.accent }}>
            {expanded ? "Show fewer" : `Show all ${filtered.length}`}
          </CustomText>
        </TouchableOpacity>
      ) : null}

      {selected && (selected.instructions || selected.hours) ? (
        <View style={styles.meet}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="location" size={15} color={P.ink} />
            <CustomText fontFamily="SemiBold" fontSize={13} style={{ color: P.ink, marginLeft: 6 }}>
              The rider meets the driver at
            </CustomText>
          </View>
          <CustomText fontSize={12} style={{ color: P.ink, marginTop: 3 }}>
            {[selected.instructions || selected.name, selected.hours].filter(Boolean).join(" · ")}
          </CustomText>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  section: { color: T.inkMuted, marginTop: 18, marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(15, 23, 42, 0.10)",
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: P.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { flex: 1, minWidth: 0, marginLeft: 10, marginRight: 8 },
  sub: { color: T.inkMuted, marginTop: 2 },
  tag: { backgroundColor: P.accentSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  pointCard: {
    width: 140,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.10)",
    padding: 12,
  },
  askCard: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.10)",
    padding: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.18)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  more: { paddingVertical: 10, alignItems: "center" },
  meet: {
    marginTop: 12,
    backgroundColor: P.accentSoft,
    borderColor: P.accentMuted,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
});

export default ParcelPointList;
