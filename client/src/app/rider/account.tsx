import { View, ScrollView, TouchableOpacity, StyleSheet, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState } from "react";
import Constants from "expo-constants";
import CustomText from "@/components/shared/CustomText";
import { useRiderStore } from "@/store/riderStore";
import { onboardingUserId, useOnboardingStore } from "@/store/onboardingStore";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import { logout, confirmDeleteAccount } from "@/service/authService";
import { useWS } from "@/service/WSProvider";
import { resolveMediaUrl } from "@/service/mediaUpload";
import { router } from "expo-router";
import {
  refreshPushRegistration,
  isNativePushModuleAvailable,
  getPushRebuildInstructions,
} from "@/service/pushNotifications";
import { sendTestPushNotification } from "@/service/testPush";
import { formatActiveModeLabel, getEffectivePreferencesFromUser } from "@/utils/riderServiceSettings";
import {
  canCourierGoOnDuty,
  driverStatusLabel,
  driverStatusColors,
  getDriverAccountStatus,
  isDriverPendingApproval,
} from "@/utils/driverProfileAccess";
import { openLegalPage } from "@/utils/legalLinks";

const appVersion = Constants.expoConfig?.version ?? "";

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

/** A titled card of tappable rows. */
const Section = ({ title, rows }: { title?: string; rows: Row[] }) => (
  <View style={{ marginBottom: DS.spacing.md }}>
    {title ? (
      <CustomText fontFamily="SemiBold" fontSize={12} color={DS.color.textMuted} style={styles.sectionLabel}>
        {title}
      </CustomText>
    ) : null}
    <View style={styles.card}>
      {rows.map((row, i) => (
        <TouchableOpacity
          key={row.label}
          onPress={row.onPress}
          activeOpacity={0.7}
          style={[styles.row, i < rows.length - 1 && styles.rowDivider]}
          accessibilityRole="button"
        >
          <View style={[styles.rowIcon, row.danger && styles.rowIconDanger]}>
            <Ionicons name={row.icon} size={18} color={row.danger ? DS.color.danger : Colors.primaryText} />
          </View>
          <View style={{ flex: 1 }}>
            <CustomText fontFamily="Medium" fontSize={15} color={row.danger ? DS.color.danger : Colors.text}>
              {row.label}
            </CustomText>
            {row.sub ? (
              <CustomText fontSize={12} color={DS.color.textMuted} style={{ marginTop: 2 }} numberOfLines={1}>
                {row.sub}
              </CustomText>
            ) : null}
          </View>
          {row.danger ? null : <Ionicons name="chevron-forward" size={18} color={DS.color.textSoft} />}
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const RiderAccount = () => {
  const { user } = useRiderStore();
  const { disconnect } = useWS();
  const resetOnboarding = useOnboardingStore((s) => s.reset);
  const [pushBusy, setPushBusy] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/rider/home"));

  const handleTestPush = async () => {
    if (!isNativePushModuleAvailable()) {
      Alert.alert("Rebuild app for push", getPushRebuildInstructions());
      return;
    }
    setPushBusy(true);
    try {
      await refreshPushRegistration();
      const data = await sendTestPushNotification();
      Alert.alert("Push test", data.message || "Sent");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { msg?: string } } })?.response?.data?.msg ||
        (e instanceof Error ? e.message : "Test failed");
      Alert.alert("Push test failed", msg);
    } finally {
      setPushBusy(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout(disconnect) },
    ]);
  };

  const showMeAround = () => {
    resetOnboarding(onboardingUserId(user));
    router.navigate("/rider/home");
  };

  const driverStatus = getDriverAccountStatus(user);
  const statusColors = driverStatusColors(driverStatus);
  const isPending = isDriverPendingApproval(user);
  const review = (user as { driverDetails?: { review?: { decision?: string; note?: string } } } | null)
    ?.driverDetails?.review;
  const changesRequested = isPending && review?.decision === "changes_requested";
  const reviewNote = review?.note ?? "";
  const canGoOnDuty = canCourierGoOnDuty(user);

  const avatarUri = resolveMediaUrl(user?.driverDetails?.profileImage);
  const initials = initialsOf(user?.name || "");
  const ratingCount = user?.totalRatings || 0;
  const plate = user?.driverDetails?.vehicle?.plateNumber;

  const accountRows: Row[] = [
    {
      icon: "person-outline",
      label: "Profile & documents",
      sub: isPending ? "Finish these to get approved" : "Name, photo, vehicle and papers",
      onPress: () => router.push("/rider/profile"),
    },
    {
      icon: "options-outline",
      label: "Work mode",
      sub: formatActiveModeLabel(getEffectivePreferencesFromUser(user)),
      onPress: () => router.push("/rider/services"),
    },
  ];
  const workRows: Row[] = [
    {
      icon: "shield-outline",
      label: "Reliability",
      sub: "Strikes and service pauses",
      onPress: () => router.push("/rider/reliability"),
    },
    {
      icon: "stats-chart-outline",
      label: "Performance",
      sub: "Trips, earnings and acceptance",
      onPress: () => router.push("/rider/analytics"),
    },
  ];
  const helpRows: Row[] = [
    { icon: "compass-outline", label: "Show me around", sub: "Replay the app tour", onPress: showMeAround },
    { icon: "document-text-outline", label: "Privacy policy", onPress: () => openLegalPage() },
    // Developer check only; riders don't need it in store builds.
    ...(__DEV__
      ? [
          {
            icon: "notifications-outline" as const,
            label: pushBusy ? "Sending test push…" : "Test push notification",
            onPress: handleTestPush,
          },
        ]
      : []),
  ];

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.topSafe} />

      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <CustomText fontFamily="SemiBold" fontSize={17}>
          My account
        </CustomText>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={[styles.card, styles.profileCard]}
          activeOpacity={0.8}
          onPress={() => router.push("/rider/profile")}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <CustomText fontFamily="Bold" fontSize={22} color={Colors.primaryText}>
                {initials || "?"}
              </CustomText>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 14 }}>
            <CustomText fontFamily="Bold" fontSize={17} numberOfLines={1}>
              {user?.name || "Add your name"}
            </CustomText>
            <CustomText fontSize={13} color={DS.color.textMuted} style={{ marginTop: 2 }} numberOfLines={1}>
              {[user?.phone, plate].filter(Boolean).join(" · ")}
            </CustomText>
            <View style={styles.pillRow}>
              <View style={[styles.pill, { backgroundColor: statusColors.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColors.text }]} />
                <CustomText fontFamily="SemiBold" fontSize={11} color={statusColors.text}>
                  {driverStatusLabel(driverStatus)}
                </CustomText>
              </View>
              {ratingCount > 0 && user?.averageRating ? (
                <View style={[styles.pill, styles.pillOutline]}>
                  <Ionicons name="star" size={11} color="#F5B301" />
                  <CustomText fontFamily="SemiBold" fontSize={11} style={{ marginLeft: 3 }}>
                    {user.averageRating.toFixed(1)}
                  </CustomText>
                </View>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={DS.color.textSoft} />
        </TouchableOpacity>

        {isPending ? (
          <TouchableOpacity style={styles.notice} onPress={() => router.push("/rider/profile")} activeOpacity={0.85}>
            <Ionicons name="time-outline" size={18} color={Colors.primaryText} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <CustomText fontFamily="SemiBold" fontSize={14} style={{ marginBottom: 2 }}>
                {changesRequested ? "Action needed on your documents" : "Account pending approval"}
              </CustomText>
              <CustomText fontSize={12} color="#5c4a00">
                {changesRequested
                  ? `${reviewNote} Tap to update your documents.`
                  : review?.decision === "resubmitted"
                    ? "Thanks, we're checking your updated documents."
                    : "Add your vehicle and documents. You can go on duty once an admin approves them."}
              </CustomText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#b08900" />
          </TouchableOpacity>
        ) : !canGoOnDuty ? (
          <View style={[styles.notice, styles.warningNotice]}>
            <Ionicons name="alert-circle-outline" size={18} color="#b45309" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <CustomText fontFamily="SemiBold" fontSize={14} style={{ marginBottom: 2 }}>
                {driverStatusLabel(driverStatus)}
              </CustomText>
              <CustomText fontSize={12} color="#7c2d12">
                {driverStatus === "suspended_debt"
                  ? "Clear your commission balance in Earnings before going on duty."
                  : "Contact support to restore your account."}
              </CustomText>
            </View>
          </View>
        ) : null}

        <Section title="ACCOUNT" rows={accountRows} />
        <Section title="HOW YOU'RE DOING" rows={workRows} />
        <Section title="HELP" rows={helpRows} />
        <Section
          rows={[
            { icon: "log-out-outline", label: "Log out", onPress: handleLogout, danger: true },
          ]}
        />

        <TouchableOpacity onPress={() => confirmDeleteAccount(disconnect)} style={styles.deleteLink} hitSlop={8}>
          <CustomText fontSize={13} color={DS.color.textSoft}>
            Delete my account
          </CustomText>
        </TouchableOpacity>
        <CustomText fontSize={12} color={DS.color.textSoft} style={{ textAlign: "center", marginTop: 6 }}>
          QareGO {appVersion ? `v${appVersion}` : ""}
        </CustomText>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: DS.color.bg },
  topSafe: { backgroundColor: DS.color.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: DS.spacing.md,
    paddingVertical: DS.spacing.sm,
    backgroundColor: DS.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.border,
  },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  content: { padding: DS.spacing.lg, paddingBottom: 48 },
  card: {
    backgroundColor: DS.color.surface,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
    borderColor: DS.color.border,
    ...DS.shadow.card,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: DS.spacing.md,
    marginBottom: DS.spacing.md,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: DS.color.border },
  avatarEmpty: {
    backgroundColor: "#FDF6C8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#F6E88A",
  },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: DS.radius.pill,
  },
  pillOutline: { borderWidth: 1, borderColor: DS.color.border, backgroundColor: DS.color.surface },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEA",
    borderColor: "#F6E88A",
    borderWidth: 1,
    borderRadius: DS.radius.md,
    padding: DS.spacing.sm,
    marginBottom: DS.spacing.md,
  },
  warningNotice: { backgroundColor: "#FFF7ED", borderColor: "#FDBA74" },
  sectionLabel: { letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: DS.spacing.md, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DS.color.border },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FDF6C8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowIconDanger: { backgroundColor: "#FEE2E2" },
  deleteLink: { alignSelf: "center", paddingVertical: 8, marginTop: 4 },
});

export default RiderAccount;
