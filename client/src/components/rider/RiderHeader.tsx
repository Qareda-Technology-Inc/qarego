import {
  View,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
} from "react-native";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useWS } from "@/service/WSProvider";
import { useRiderStore } from "@/store/riderStore";
import { appAxios } from "@/service/apiInterceptors";
import { getCurrentLocationAsync } from "@/utils/locationUtils";
import { riderStyles } from "@/styles/riderStyles";
import { commonStyles } from "@/styles/commonStyles";
import { MaterialIcons } from "@expo/vector-icons";
import CustomText from "../shared/CustomText";
import { Colors, formatCurrency } from "@/utils/Constants";
import { router } from "expo-router";
import { useRiderDrawer } from "@/context/RiderDrawerContext";
import { tokenStorage } from "@/store/storage";
import { DS } from "@/theme/designSystem";
import { formatActiveModeLabel, getEffectivePreferencesFromUser } from "@/utils/riderServiceSettings";

const TOGGLE_BUSY_MAX_MS = 14_000;

const RiderHeader = () => {
  const { user, onDuty, setOnDuty, setLocation } = useRiderStore();
  const activeModeLabel = formatActiveModeLabel(getEffectivePreferencesFromUser(user));
  const { emit } = useWS();
  const { openDrawer } = useRiderDrawer();
  const [riderAmount, setRiderAmount] = useState<number | null>(null);
  const [restoredDutySynced, setRestoredDutySynced] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const toggleBusyRef = useRef(false);

  const clearToggleBusy = useCallback(() => {
    toggleBusyRef.current = false;
    setToggleBusy(false);
  }, []);

  const fetchEarnings = useCallback(async () => {
    if (!tokenStorage.getString("access_token")) return;
    try {
      const res = await appAxios.get("/ride/transactions");
      setRiderAmount(Number(res.data?.riderAmount ?? 0));
    } catch {
      setRiderAmount(null);
    }
  }, []);

  useEffect(() => {
    if (!onDuty) fetchEarnings();
  }, [onDuty, fetchEarnings]);

  const goOnDutyWithCoords = useCallback(
    (latitude: number, longitude: number, heading?: number) => {
      const h = (heading ?? 0) as number;
      setOnDuty(true);
      setLocation({
        latitude,
        longitude,
        address: "Somewhere",
        heading: h,
      });
      emit("goOnDuty", { latitude, longitude, heading: h });
      appAxios.patch("/ride/rider-status", { isOnline: true }).catch(() => {});
    },
    [emit, setLocation, setOnDuty]
  );

  const toggleOnDuty = async () => {
    if (toggleBusyRef.current) return;

    if (onDuty) {
      setOnDuty(false);
      emit("goOffDuty");
      appAxios.patch("/ride/rider-status", { isOnline: false }).catch(() => {});
      return;
    }

    toggleBusyRef.current = true;
    setToggleBusy(true);
    const safetyTimer = setTimeout(clearToggleBusy, TOGGLE_BUSY_MAX_MS);

    try {
      const result = await getCurrentLocationAsync({
        preferLastKnown: true,
        timeoutMs: 10_000,
      });
      if (!result.ok) {
        Alert.alert(
          "Location unavailable",
          result.message,
          result.canOpenSettings
            ? [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => Linking.openSettings() },
              ]
            : [{ text: "OK" }]
        );
        return;
      }
      goOnDutyWithCoords(result.latitude, result.longitude, result.heading);
    } finally {
      clearTimeout(safetyTimer);
      clearToggleBusy();
    }
  };

  useEffect(() => {
    if (!onDuty || restoredDutySynced) return;
    let cancelled = false;
    (async () => {
      const result = await getCurrentLocationAsync({
        preferLastKnown: true,
        timeoutMs: 10_000,
      });
      if (!result.ok || cancelled) {
        if (!cancelled && !result.ok) {
          setOnDuty(false);
          emit("goOffDuty");
        }
        return;
      }
      const { latitude, longitude, heading } = result;
      emit("goOnDuty", { latitude, longitude, heading: heading ?? 0 });
      appAxios.patch("/ride/rider-status", { isOnline: true }).catch(() => {});
      setLocation({
        latitude,
        longitude,
        address: "Somewhere",
        heading: (heading ?? 0) as number,
      });
      if (!cancelled) setRestoredDutySynced(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [onDuty, restoredDutySynced, emit, setLocation, setOnDuty]);

  useEffect(() => {
    if (!onDuty) setRestoredDutySynced(false);
  }, [onDuty]);

  return (
    <>
      <View style={riderStyles.headerContainer}>
        <SafeAreaView />

        <View style={commonStyles.flexRowBetween}>
          <TouchableOpacity
            onPress={openDrawer}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            activeOpacity={0.7}
          >
            <MaterialIcons name="menu" size={24} color={Colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[riderStyles.toggleContainer, toggleBusy && { opacity: 0.7 }]}
            onPress={toggleOnDuty}
            disabled={toggleBusy}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            accessibilityRole="switch"
            accessibilityState={{ checked: onDuty, disabled: toggleBusy }}
            accessibilityLabel={onDuty ? "On duty, tap to go off duty" : "Off duty, tap to go on duty"}
            activeOpacity={0.75}
          >
            <CustomText
              fontFamily="SemiBold"
              fontSize={12}
              style={{ color: DS.color.textMuted }}
            >
              {toggleBusy ? "…" : onDuty ? "ON-DUTY" : "OFF-DUTY"}
            </CustomText>

            {toggleBusy ? (
              <ActivityIndicator size="small" color={Colors.primary} style={riderStyles.icon} />
            ) : (
              <Image
                source={
                  onDuty
                    ? require("@/assets/icons/switch_on.png")
                    : require("@/assets/icons/switch_off.png")
                }
                style={riderStyles.icon}
              />
            )}
          </TouchableOpacity>

          <View style={{ width: 24 }} />
        </View>
      </View>

      <TouchableOpacity
        style={riderStyles?.earningContainer}
        onPress={() => !onDuty && router.push("/rider/earnings")}
        activeOpacity={onDuty ? 1 : 0.7}
        disabled={onDuty}
        onLongPress={() => router.push("/rider/services")}
      >
        <CustomText fontSize={13} style={{ color: "#fff" }} fontFamily="Medium">
          {onDuty ? "Active Status" : "Total Earnings"}
        </CustomText>

        <View style={commonStyles?.flexRowGap}>
          {onDuty ? (
            <View>
              <CustomText
                fontSize={14}
                style={{ color: "#86EFAC" }}
                fontFamily="SemiBold"
              >
                ● On duty
              </CustomText>
              <CustomText fontSize={11} style={{ color: "rgba(255,255,255,0.85)" }} numberOfLines={1}>
                {activeModeLabel}
              </CustomText>
            </View>
          ) : (
            <>
              <CustomText
                fontSize={14}
                style={{ color: "#fff" }}
                fontFamily="Medium"
              >
                {riderAmount !== null ? formatCurrency(riderAmount) : "—"}
              </CustomText>
              <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.8)" />
            </>
          )}
        </View>
      </TouchableOpacity>
    </>
  );
};

export default RiderHeader;
