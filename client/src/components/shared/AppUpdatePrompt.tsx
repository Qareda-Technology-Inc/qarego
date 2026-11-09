import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Modal, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import * as Application from "expo-application";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { appAxios } from "@/service/apiInterceptors";
import { storage } from "@/store/storage";
import { Colors } from "@/utils/Constants";

type VersionInfo = {
  status: "required" | "available" | "none";
  latestBuild: number;
  storeUrl: string;
  message?: string | null;
};

/** Check again when the app comes back to the front, at most this often. */
const RECHECK_MS = 30 * 60 * 1000;
/** "Later" on an optional update hides it for this build until this long has passed. */
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const snoozeKey = (build: number) => `app-update-snoozed-${build}`;

/**
 * Asks people on an old build to update (admin → Settings → App updates). An optional update can
 * be put off for a day; a required one blocks the app until they update. Any failure (offline,
 * old server) shows nothing, so nobody is ever locked out by mistake.
 */
export function AppUpdatePrompt() {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (__DEV__ || (Platform.OS !== "android" && Platform.OS !== "ios")) return;
    const build = Number(Application.nativeBuildVersion);
    if (!Number.isFinite(build) || build <= 0) return;
    lastCheck.current = Date.now();
    try {
      const res = await appAxios.get("/app/version", { params: { platform: Platform.OS, build } });
      const data = res.data as VersionInfo;
      if (data?.status === "available") {
        const snoozedAt = Number(storage.getString(snoozeKey(data.latestBuild)) || 0);
        if (Date.now() - snoozedAt < SNOOZE_MS) return setInfo(null);
      }
      setInfo(data?.status === "required" || data?.status === "available" ? data : null);
    } catch {
      // Offline or the server is older: say nothing.
    }
  }, []);

  useEffect(() => {
    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && Date.now() - lastCheck.current > RECHECK_MS) check();
    });
    return () => sub.remove();
  }, [check]);

  if (!info) return null;
  const required = info.status === "required";

  const openStore = () => {
    Linking.openURL(info.storeUrl).catch(() => {});
  };
  const later = () => {
    storage.set(snoozeKey(info.latestBuild), String(Date.now()));
    setInfo(null);
  };

  return (
    <Modal
      visible
      transparent={!required}
      animationType={required ? "fade" : "slide"}
      onRequestClose={required ? () => {} : later}
    >
      <View style={required ? styles.fullScreen : styles.backdrop}>
        <View style={required ? styles.fullCard : styles.sheet}>
          <View style={styles.icon}>
            <Ionicons name="arrow-up-circle" size={44} color={Colors.theme} />
          </View>
          <CustomText fontFamily="Bold" fontSize={20} style={styles.center}>
            {required ? "Please update QareGO" : "A new version of QareGO is available"}
          </CustomText>
          <CustomText fontSize={14} color="#475569" style={[styles.center, styles.body]}>
            {info.message ||
              (required
                ? "This version is no longer supported. Update to keep using QareGO."
                : "Update for the latest improvements and fixes.")}
          </CustomText>
          <TouchableOpacity style={styles.primary} onPress={openStore} activeOpacity={0.85}>
            <CustomText fontFamily="SemiBold" fontSize={16} style={{ color: "#fff" }}>
              Update now
            </CustomText>
          </TouchableOpacity>
          {required ? null : (
            <TouchableOpacity style={styles.secondary} onPress={later} activeOpacity={0.85}>
              <CustomText fontFamily="Medium" fontSize={15} color="#64748B">
                Later
              </CustomText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
  },
  fullScreen: { flex: 1, backgroundColor: "#F8FAFC", justifyContent: "center", padding: 24 },
  fullCard: { backgroundColor: "#fff", borderRadius: 22, padding: 24 },
  icon: { alignItems: "center", marginBottom: 12 },
  center: { textAlign: "center" },
  body: { marginTop: 8, lineHeight: 20 },
  primary: {
    marginTop: 22,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.theme,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { marginTop: 10, height: 44, alignItems: "center", justifyContent: "center" },
});
