import {
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import React, { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { commonStyles } from "@/styles/commonStyles";
import CustomText from "@/components/shared/CustomText";
import CustomButton from "@/components/shared/CustomButton";
import { Colors } from "@/utils/Constants";
import {
  fetchRiderServiceSettings,
  updateRiderServicePreferences,
} from "@/service/rideService";
import {
  PRESET_OPTIONS,
  SERVICE_ROWS,
  ServiceKey,
  ServicePresetId,
  ServicePreferenceEntry,
  RiderServiceSettingsResponse,
  vehicleLabel,
  formatActiveModeLabel,
  isServiceAllowedByVehicle,
} from "@/utils/riderServiceSettings";

const RiderServices = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState<ServicePresetId>("all");
  const [prefs, setPrefs] = useState<Record<ServiceKey, ServicePreferenceEntry>>({
    RIDE: { enabled: true },
    DELIVERY: { enabled: true },
    FOOD: { enabled: true },
  });
  const [supported, setSupported] = useState<ServiceKey[]>(["RIDE", "DELIVERY", "FOOD"]);
  const [vehicleCategory, setVehicleCategory] = useState("motorcycle");
  const [effective, setEffective] = useState<Record<ServiceKey, boolean>>({
    RIDE: true,
    DELIVERY: true,
    FOOD: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: RiderServiceSettingsResponse = await fetchRiderServiceSettings();
      setPreset((data.servicePreset as ServicePresetId) || "all");
      setSupported(data.vehicleSupportedServices || ["RIDE", "DELIVERY", "FOOD"]);
      setVehicleCategory(data.vehicleCategory || "motorcycle");
      setEffective(data.effectivePreferences || { RIDE: true, DELIVERY: true, FOOD: true });
      const sp = data.servicePreferences || {};
      setPrefs({
        RIDE: sp.RIDE || { enabled: true },
        DELIVERY: sp.DELIVERY || { enabled: true },
        FOOD: sp.FOOD || { enabled: true },
      });
    } catch {
      Alert.alert("Error", "Could not load service settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyPresetLocal = (id: ServicePresetId) => {
    setPreset(id);
    const map: Record<ServicePresetId, Record<ServiceKey, boolean>> = {
      all: { RIDE: true, DELIVERY: true, FOOD: true },
      ride_only: { RIDE: true, DELIVERY: false, FOOD: false },
      delivery_only: { RIDE: false, DELIVERY: true, FOOD: true },
      parcel_only: { RIDE: false, DELIVERY: true, FOOD: false },
      food_only: { RIDE: false, DELIVERY: false, FOOD: true },
      custom: {
        RIDE: prefs.RIDE?.enabled !== false,
        DELIVERY: prefs.DELIVERY?.enabled !== false,
        FOOD: prefs.FOOD?.enabled !== false,
      },
    };
    const next = map[id];
    setPrefs((p) => ({
      RIDE: { ...p.RIDE, enabled: next.RIDE },
      DELIVERY: { ...p.DELIVERY, enabled: next.DELIVERY },
      FOOD: { ...p.FOOD, enabled: next.FOOD },
    }));
  };

  const setServiceEnabled = (key: ServiceKey, enabled: boolean) => {
    setPreset("custom");
    setPrefs((p) => ({ ...p, [key]: { ...p[key], enabled } }));
  };

  const setSchedule = (key: ServiceKey, patch: Partial<ServicePreferenceEntry["schedule"]>) => {
    setPreset("custom");
    setPrefs((p) => ({
      ...p,
      [key]: {
        ...p[key],
        schedule: { ...(p[key]?.schedule || {}), ...patch },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await updateRiderServicePreferences({
        preset: preset === "custom" ? undefined : preset,
        servicePreferences: prefs,
      });
      if (data?.effectivePreferences) setEffective(data.effectivePreferences);
      if (data?.servicePreset) setPreset(data.servicePreset);
      Alert.alert("Saved", "Your work mode is updated. Offers will match these settings.");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.msg || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={commonStyles.container}>
      <SafeAreaView style={{ backgroundColor: "#fff" }} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/rider/account"))}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <CustomText variant="h5" fontFamily="SemiBold">
          Work mode
        </CustomText>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.banner}>
            <Ionicons name="car-sport" size={22} color={Colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <CustomText fontFamily="SemiBold" fontSize={14}>
                {vehicleLabel(vehicleCategory)} · {formatActiveModeLabel(effective)}
              </CustomText>
              <CustomText fontSize={11} color="#666" style={{ marginTop: 4 }}>
                Active now based on your toggles and hours. Platform may limit food on some vehicles.
              </CustomText>
            </View>
          </View>

          <TouchableOpacity
            style={styles.reliabilityLink}
            onPress={() => router.push("/rider/reliability")}
            activeOpacity={0.85}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <CustomText fontFamily="SemiBold" fontSize={14}>
                Reliability & strikes
              </CustomText>
              <CustomText fontSize={11} color="#666">
                Missed offers can pause a service — view status and policy
              </CustomText>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <CustomText fontSize={13} fontFamily="SemiBold" style={styles.sectionTitle}>
            Quick presets
          </CustomText>
          {PRESET_OPTIONS.map((opt) => {
            const selected = preset === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.presetCard, selected && styles.presetCardSelected]}
                onPress={() => applyPresetLocal(opt.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.presetIcon, selected && styles.presetIconSelected]}>
                  <Ionicons
                    name={opt.icon as any}
                    size={22}
                    color={selected ? "#fff" : Colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <CustomText fontFamily="SemiBold" fontSize={15}>
                    {opt.title}
                  </CustomText>
                  <CustomText fontSize={12} color="#666" style={{ marginTop: 2 }}>
                    {opt.description}
                  </CustomText>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                ) : null}
              </TouchableOpacity>
            );
          })}

          <CustomText fontSize={13} fontFamily="SemiBold" style={styles.sectionTitle}>
            Custom services
          </CustomText>
          <CustomText fontSize={11} color="#888" style={{ marginBottom: 10 }}>
            Turn individual services on or off. Food requires a motorcycle unless admin enables your vehicle type.
          </CustomText>

          {SERVICE_ROWS.map((row) => {
            const allowed = isServiceAllowedByVehicle(row.key, supported);
            const enabled = prefs[row.key]?.enabled !== false;
            const sched = prefs[row.key]?.schedule;
            const effectiveOn = effective[row.key];

            return (
              <View
                key={row.key}
                style={[styles.serviceCard, !allowed && styles.serviceCardDisabled]}
              >
                <View style={styles.serviceRow}>
                  <View style={{ flex: 1 }}>
                    <CustomText fontFamily="SemiBold" fontSize={15}>
                      {row.label}
                    </CustomText>
                    <CustomText fontSize={11} color="#666">
                      {row.description}
                    </CustomText>
                    {!allowed ? (
                      <CustomText fontSize={10} color="#c2410c" style={{ marginTop: 4 }}>
                        Not available for {vehicleLabel(vehicleCategory)}
                      </CustomText>
                    ) : effectiveOn !== enabled ? (
                      <CustomText fontSize={10} color="#ca8a04" style={{ marginTop: 4 }}>
                        Off now (outside scheduled hours)
                      </CustomText>
                    ) : null}
                  </View>
                  <Switch
                    value={enabled && allowed}
                    onValueChange={(v) => setServiceEnabled(row.key, v)}
                    disabled={!allowed}
                    trackColor={{ false: "#ccc", true: Colors.primary }}
                  />
                </View>

                {allowed && enabled ? (
                  <View style={styles.scheduleBlock}>
                    <View style={styles.serviceRow}>
                      <CustomText fontSize={12}>Only during hours</CustomText>
                      <Switch
                        value={!!sched?.useSchedule}
                        onValueChange={(v) =>
                          setSchedule(row.key, {
                            useSchedule: v,
                            start: sched?.start || "08:00",
                            end: sched?.end || "22:00",
                          })
                        }
                        trackColor={{ false: "#ccc", true: Colors.primary }}
                      />
                    </View>
                    {sched?.useSchedule ? (
                      <View style={styles.timeRow}>
                        <View style={{ flex: 1 }}>
                          <CustomText fontSize={10} color="#666">
                            From
                          </CustomText>
                          <TextInput
                            style={styles.timeInput}
                            value={sched.start || "08:00"}
                            onChangeText={(t) => setSchedule(row.key, { start: t })}
                            placeholder="08:00"
                            maxLength={5}
                          />
                        </View>
                        <CustomText style={{ marginHorizontal: 8 }}>–</CustomText>
                        <View style={{ flex: 1 }}>
                          <CustomText fontSize={10} color="#666">
                            To
                          </CustomText>
                          <TextInput
                            style={styles.timeInput}
                            value={sched.end || "22:00"}
                            onChangeText={(t) => setSchedule(row.key, { end: t })}
                            placeholder="22:00"
                            maxLength={5}
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}

          <CustomButton
            title={saving ? "Saving…" : "Save work mode"}
            onPress={handleSave}
            disabled={saving}
            style={{ marginTop: 8, marginBottom: 32 }}
          />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  backButton: { marginRight: 12 },
  scroll: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  reliabilityLink: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fafafa",
  },
  sectionTitle: { marginBottom: 10, marginTop: 4 },
  presetCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  presetCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#fff7ed",
  },
  presetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff7ed",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  presetIconSelected: {
    backgroundColor: Colors.primary,
  },
  serviceCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  serviceCardDisabled: {
    opacity: 0.65,
    backgroundColor: "#f9fafb",
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scheduleBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 8,
  },
  timeInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    fontSize: 14,
  },
});

export default RiderServices;
