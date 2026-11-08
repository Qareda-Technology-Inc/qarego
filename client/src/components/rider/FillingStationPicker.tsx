import React, { FC, useCallback, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, Linking, Alert, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { DS } from "@/theme/designSystem";
import { chooseFillingStation, fetchFillingStations, type FillingStation } from "@/service/rideService";

type Props = {
  ride: { _id: string; restaurantName?: string; drop?: { address?: string } };
  /** Called with the updated trip after the rider picks another station. */
  onChanged: (ride: any) => void;
};

const ACCENT = "#c2410c";

/** Google Maps search for LPG stations around the rider: the fallback when none is listed nearby. */
function openMapsSearch() {
  Linking.openURL("https://www.google.com/maps/search/?api=1&query=LPG+gas+filling+station").catch(() =>
    Alert.alert("Couldn't open maps", "Search for an LPG station in your maps app.")
  );
}

/**
 * QareGO refill, collection trip: which LPG station the rider is heading to, with a way to pick
 * another nearby (closed, no gas, long queue) or search Google Maps.
 */
const FillingStationPicker: FC<Props> = ({ ride, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [stations, setStations] = useState<FillingStation[]>([]);

  const listed = !!ride.restaurantName && !/^nearest gas filling station$/i.test(ride.restaurantName);

  const showList = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    try {
      setStations(await fetchFillingStations(ride._id));
    } catch {
      setStations([]);
    } finally {
      setLoading(false);
    }
  }, [ride._id]);

  const pick = async (station: FillingStation) => {
    if (station.current) return setOpen(false);
    setSaving(station.id);
    try {
      const updated = await chooseFillingStation(ride._id, station.id);
      if (updated) onChanged(updated);
      setOpen(false);
    } catch (err: any) {
      Alert.alert("Couldn't change station", err?.response?.data?.msg || err?.response?.data?.message || "Try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="flame" size={16} color={ACCENT} />
        <View style={styles.flex}>
          <CustomText fontSize={11} color={DS.color.textMuted}>
            Fill at
          </CustomText>
          <CustomText fontFamily="SemiBold" fontSize={13} numberOfLines={1}>
            {listed ? ride.restaurantName : "Any LPG station near you"}
          </CustomText>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btn} onPress={showList} activeOpacity={0.85}>
          <Ionicons name="swap-horizontal" size={14} color={ACCENT} />
          <CustomText fontFamily="Medium" fontSize={12} style={{ color: ACCENT }}>
            {listed ? "Change station" : "Stations nearby"}
          </CustomText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={openMapsSearch} activeOpacity={0.85}>
          <Ionicons name="search" size={14} color={ACCENT} />
          <CustomText fontFamily="Medium" fontSize={12} style={{ color: ACCENT }}>
            Google Maps
          </CustomText>
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <CustomText fontFamily="Bold" fontSize={16} style={styles.flex}>
                LPG stations near you
              </CustomText>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={DS.color.textMuted} />
              </TouchableOpacity>
            </View>
            {loading ? (
              <ActivityIndicator color={ACCENT} style={{ marginVertical: 24 }} />
            ) : stations.length === 0 ? (
              <CustomText fontSize={13} color={DS.color.textMuted} style={{ marginVertical: 16 }}>
                No listed station near you. Use Google Maps to find one that sells LPG.
              </CustomText>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {stations.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.station, s.current && styles.stationCurrent]}
                    onPress={() => pick(s)}
                    disabled={!!saving}
                    activeOpacity={0.85}
                  >
                    <View style={styles.flex}>
                      <CustomText fontFamily="SemiBold" fontSize={14}>
                        {s.name}
                      </CustomText>
                      {s.address ? (
                        <CustomText fontSize={12} color={DS.color.textMuted} numberOfLines={1}>
                          {s.address}
                        </CustomText>
                      ) : null}
                    </View>
                    {saving === s.id ? (
                      <ActivityIndicator color={ACCENT} />
                    ) : (
                      <CustomText fontFamily="Medium" fontSize={12} style={{ color: s.current ? ACCENT : DS.color.textMuted }}>
                        {s.current ? "Current" : `${s.distanceKm.toFixed(1)} km`}
                      </CustomText>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={[styles.btn, styles.mapsBtn]} onPress={openMapsSearch} activeOpacity={0.85}>
              <Ionicons name="search" size={14} color={ACCENT} />
              <CustomText fontFamily="Medium" fontSize={13} style={{ color: ACCENT }}>
                Search Google Maps instead
              </CustomText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingBottom: 32,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  station: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  stationCurrent: { backgroundColor: "#FFF7ED" },
  mapsBtn: { alignSelf: "center", marginTop: 12 },
});

export default FillingStationPicker;
