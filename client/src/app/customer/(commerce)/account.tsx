import { View, ScrollView, TouchableOpacity, StyleSheet, Alert, Image } from "react-native";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import CustomText from "@/components/shared/CustomText";
import { useUserStore } from "@/store/userStore";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import { logout, confirmDeleteAccount } from "@/service/authService";
import { onboardingUserId, useOnboardingStore } from "@/store/onboardingStore";
import { useWS } from "@/service/WSProvider";
import { router, useLocalSearchParams } from "expo-router";
import Constants from "expo-constants";
import { resolveMediaUrl } from "@/service/mediaUpload";
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

const CustomerAccount = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useUserStore();
  const { disconnect } = useWS();
  const avatarUri = resolveMediaUrl((user as { profileImage?: string })?.profileImage);
  // Opened from the ride map's menu (no tab bar there), so offer a way back to it.
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromRideMap = from === "ride";
  // Back steps through the tabs, not off them, so jump to the map that is still underneath.
  const backToRideMap = () => router.dismissTo("/customer/home");

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout(disconnect) },
    ]);
  };

  const resetOnboarding = useOnboardingStore((s) => s.reset);
  const showMeAround = () => {
    resetOnboarding(onboardingUserId(user as { _id?: string; id?: string }));
    router.navigate("/customer");
  };

  const ratingCount = user?.totalRatings || 0;
  const initials = initialsOf(user?.name || "");

  const accountRows: Row[] = [
    {
      icon: "person-outline",
      label: "Personal info",
      sub: "Name, photo and email",
      onPress: () => router.push("/customer/profile"),
    },
  ];
  const helpRows: Row[] = [
    { icon: "compass-outline", label: "Show me around", sub: "Replay the app tour", onPress: showMeAround },
    { icon: "document-text-outline", label: "Privacy policy", onPress: () => openLegalPage() },
  ];

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {fromRideMap ? (
          <TouchableOpacity onPress={backToRideMap} style={styles.backButton} hitSlop={10} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
        <CustomText fontFamily="SemiBold" fontSize={17}>
          My account
        </CustomText>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 24 }]}>
        <TouchableOpacity
          style={[styles.card, styles.profileCard]}
          activeOpacity={0.8}
          onPress={() => router.push("/customer/profile")}
          accessibilityRole="button"
          accessibilityLabel="Open personal info"
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              {initials ? (
                <CustomText fontFamily="Bold" fontSize={22} color={Colors.primaryText}>
                  {initials}
                </CustomText>
              ) : (
                <Ionicons name="person" size={28} color={Colors.primaryText} />
              )}
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 14 }}>
            <CustomText fontFamily="Bold" fontSize={17} numberOfLines={1}>
              {user?.name || "Add your name"}
            </CustomText>
            <CustomText fontSize={13} color={DS.color.textMuted} style={{ marginTop: 2 }} numberOfLines={1}>
              {user?.phone}
            </CustomText>
            {ratingCount > 0 && user?.averageRating ? (
              <View style={styles.pill}>
                <Ionicons name="star" size={11} color="#F5B301" />
                <CustomText fontFamily="SemiBold" fontSize={11} style={{ marginLeft: 3 }}>
                  {user.averageRating.toFixed(1)}
                </CustomText>
                <CustomText fontSize={11} color={DS.color.textMuted} style={{ marginLeft: 3 }}>
                  from riders
                </CustomText>
              </View>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={DS.color.textSoft} />
        </TouchableOpacity>

        {user && !user.name ? (
          <TouchableOpacity style={styles.notice} onPress={() => router.push("/customer/profile")} activeOpacity={0.85}>
            <Ionicons name="sparkles-outline" size={18} color={Colors.primaryText} />
            <CustomText fontSize={13} color="#5c4a00" style={{ flex: 1, marginLeft: 10 }}>
              Add your name so riders and stores know who they&apos;re serving.
            </CustomText>
            <Ionicons name="chevron-forward" size={18} color="#b08900" />
          </TouchableOpacity>
        ) : null}

        <Section title="ACCOUNT" rows={accountRows} />
        <Section title="HELP" rows={helpRows} />
        <Section rows={[{ icon: "log-out-outline", label: "Log out", onPress: handleLogout, danger: true }]} />

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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: DS.spacing.md,
    paddingBottom: DS.spacing.sm,
    backgroundColor: DS.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.color.border,
  },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  content: { padding: DS.spacing.lg },
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
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: DS.radius.pill,
    borderWidth: 1,
    borderColor: DS.color.border,
  },
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

export default CustomerAccount;
