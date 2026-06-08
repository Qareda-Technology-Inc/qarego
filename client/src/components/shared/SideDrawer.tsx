import React, { FC, useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Pressable,
  Dimensions,
  StyleSheet,
  Alert,
  ScrollView,
  InteractionManager,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomText from "./CustomText";
import { Colors } from "@/utils/Constants";
import { router, type Href } from "expo-router";
import { logout } from "@/service/authService";
import { useWS } from "@/service/WSProvider";
import { useUserStore } from "@/store/userStore";
import { useRiderStore } from "@/store/riderStore";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { appAxios } from "@/service/apiInterceptors";

const width = Dimensions.get("window").width;
const DRAWER_WIDTH = width * 0.78;

interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
  role: "customer" | "rider";
}

interface DrawerMenuItem {
  icon: string;
  label: string;
  library: typeof Ionicons | typeof MaterialIcons;
  href: Href;
  badgeText?: string | null;
  badgeTone?: "danger" | "warning" | "neutral";
  comingSoon?: string;
}

const SideDrawer: FC<SideDrawerProps> = ({ visible, onClose, role }) => {
  const insets = useSafeAreaInsets();
  const { disconnect } = useWS();
  const userStore = useUserStore();
  const riderStore = useRiderStore();

  const user = role === "customer" ? userStore.user : riderStore.user;
  const [activeTripCount, setActiveTripCount] = useState(0);
  const [pendingOfferCount, setPendingOfferCount] = useState(0);
  const [hasDebt, setHasDebt] = useState(false);

  const navigate = (href: Href) => {
    onClose();
    InteractionManager.runAfterInteractions(() => {
      router.push(href);
    });
  };

  const handleLogout = () => {
    onClose();
    InteractionManager.runAfterInteractions(() => {
      logout(disconnect);
    });
  };

  const showComingSoon = (feature: string) => {
    Alert.alert("Coming soon", `${feature} will be available in an upcoming update.`);
  };

  useEffect(() => {
    if (!visible || role !== "rider") return;
    let cancelled = false;
    (async () => {
      try {
        const [offersRes, ridesRes, txRes] = await Promise.all([
          appAxios.get("/ride/offers/pending").catch(() => ({ data: { rides: [] } })),
          appAxios.get("/ride/rides").catch(() => ({ data: { rides: [] } })),
          appAxios.get("/ride/transactions").catch(() => ({ data: { balance: 0 } })),
        ]);

        if (cancelled) return;
        const offers = Array.isArray(offersRes.data?.rides) ? offersRes.data.rides : [];
        const rides = Array.isArray(ridesRes.data?.rides) ? ridesRes.data.rides : [];
        const active = rides.filter((r: { status?: string }) =>
          ["SEARCHING_FOR_RIDER", "START", "ARRIVED", "IN_PROGRESS"].includes(r?.status ?? "")
        ).length;

        setPendingOfferCount(offers.length);
        setActiveTripCount(active);
        setHasDebt(Number(txRes.data?.balance ?? 0) < 0);
      } catch {
        if (!cancelled) {
          setPendingOfferCount(0);
          setActiveTripCount(0);
          setHasDebt(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, role]);

  const riderMenuItems: DrawerMenuItem[] = [
    {
      icon: "speedometer-outline",
      label: "Dashboard",
      library: Ionicons,
      href: "/rider/home",
    },
    {
      icon: "history",
      label: "Trip History",
      library: MaterialIcons,
      href: "/rider/rides",
      badgeText: activeTripCount > 0 ? `${activeTripCount} active` : null,
      badgeTone: "neutral",
    },
    {
      icon: "wallet-outline",
      label: "Earnings",
      library: Ionicons,
      href: "/rider/earnings",
      badgeText: hasDebt ? "Debt" : null,
      badgeTone: "warning",
    },
    {
      icon: "person-outline",
      label: "Profile & Documents",
      library: Ionicons,
      href: "/rider/profile",
    },
    {
      icon: "notifications-outline",
      label: "Pending Offers",
      library: Ionicons,
      href: "/rider/home",
      badgeText: pendingOfferCount > 0 ? String(pendingOfferCount) : null,
      badgeTone: pendingOfferCount > 0 ? "danger" : "neutral",
    },
    {
      icon: "shield-checkmark-outline",
      label: "Safety",
      library: Ionicons,
      href: "/rider/home",
      comingSoon: "Safety center",
    },
    {
      icon: "help-circle-outline",
      label: "Support",
      library: Ionicons,
      href: "/rider/home",
      comingSoon: "Support chat",
    },
  ];

  const customerMenuItems: DrawerMenuItem[] = [
    {
      icon: "receipt-outline",
      label: "Orders",
      library: Ionicons,
      href: "/customer/orders",
    },
    {
      icon: "shield-checkmark-outline",
      label: "Safety",
      library: Ionicons,
      href: "/customer/home",
      comingSoon: "Safety center",
    },
    {
      icon: "help-circle-outline",
      label: "Support",
      library: Ionicons,
      href: "/customer/home",
      comingSoon: "Support chat",
    },
    {
      icon: "information-circle-outline",
      label: "About",
      library: Ionicons,
      href: "/customer/home",
      comingSoon: "About",
    },
  ];

  const menuItems = useMemo(
    () => (role === "rider" ? riderMenuItems : customerMenuItems),
    [role, activeTripCount, pendingOfferCount, hasDebt]
  );

  const accountHref: Href =
    role === "customer" ? "/customer/account" : "/rider/account";

  const onMenuPress = (item: DrawerMenuItem) => {
    if (item.comingSoon) {
      showComingSoon(item.comingSoon);
      return;
    }
    navigate(item.href);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />

        <View
          style={[
            styles.drawerPanel,
            {
              width: DRAWER_WIDTH,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
            >
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>

            <View style={styles.userInfo}>
              <View style={styles.avatarContainer}>
                <Ionicons name="person" size={30} color={Colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <CustomText fontFamily="Bold" fontSize={18} numberOfLines={1}>
                  {user?.name?.split(" ")[0] || "User"}
                </CustomText>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <CustomText fontFamily="Medium" fontSize={12} style={{ marginLeft: 4 }}>
                    {user?.averageRating?.toFixed(1) || "5.0"}
                  </CustomText>
                </View>
              </View>
            </View>

            <Pressable style={styles.accountBtn} onPress={() => navigate(accountHref)}>
              <CustomText fontFamily="Medium" fontSize={12} style={{ color: Colors.text }}>
                My Account
              </CustomText>
              <Ionicons name="chevron-forward" size={16} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {menuItems.map((item) => {
              const IconLib = item.library;
              return (
                <Pressable
                  key={item.label}
                  onPress={() => onMenuPress(item)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <View style={styles.menuLeft}>
                    <IconLib name={item.icon as any} size={22} color={Colors.text} />
                    <CustomText fontSize={15} fontFamily="Medium" style={styles.menuLabel}>
                      {item.label}
                    </CustomText>
                  </View>
                  <View style={styles.menuRight}>
                    {item.badgeText ? (
                      <View
                        style={[
                          styles.badge,
                          item.badgeTone === "danger" && styles.badgeDanger,
                          item.badgeTone === "warning" && styles.badgeWarning,
                        ]}
                      >
                        <CustomText
                          fontFamily="SemiBold"
                          fontSize={10}
                          style={[
                            styles.badgeText,
                            item.badgeTone === "warning" && styles.badgeTextWarning,
                          ]}
                        >
                          {item.badgeText}
                        </CustomText>
                      </View>
                    ) : null}
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.footerDivider} />
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.menuItem,
                pressed && styles.menuItemPressed,
              ]}
            >
              <MaterialIcons name="logout" size={22} color={Colors.danger || "red"} />
              <CustomText
                fontSize={15}
                fontFamily="SemiBold"
                style={{ color: Colors.danger || "red", marginLeft: 15 }}
              >
                Log out
              </CustomText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  drawerPanel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#fff",
    elevation: 24,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  closeBtn: {
    alignSelf: "flex-end",
    marginBottom: 8,
    padding: 4,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    elevation: 1,
  },
  accountBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuItemPressed: {
    backgroundColor: "#f1f5f9",
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 14,
  },
  menuLabel: {
    flex: 1,
  },
  menuRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: "#64748B",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDanger: {
    backgroundColor: "#EF4444",
  },
  badgeWarning: {
    backgroundColor: "#FEF3C7",
  },
  badgeText: {
    color: "#fff",
    lineHeight: 12,
  },
  badgeTextWarning: {
    color: "#92400E",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  footerDivider: {
    height: 0,
  },
});

export default SideDrawer;
