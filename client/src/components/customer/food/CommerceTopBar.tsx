import React, { FC, ReactNode } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import CustomText from "@/components/shared/CustomText";
import CustomerLogoutButton from "@/components/customer/CustomerLogoutButton";
import { FOOD_THEME } from "@/styles/foodStyles";

type Props = {
  title: string;
  accent: string;
  itemCount?: number;
  leftAction?: ReactNode;
  showServicesButton?: boolean;
};

const CommerceTopBar: FC<Props> = ({
  title,
  accent,
  itemCount = 0,
  leftAction,
  showServicesButton = true,
}) => (
  <View style={styles.topBar}>
    {leftAction ?? (
      showServicesButton ? (
        <TouchableOpacity
          onPress={() => router.replace("/customer")}
          style={styles.iconBtn}
          hitSlop={12}
          accessibilityLabel="All services"
        >
          <Ionicons name="grid-outline" size={22} color={FOOD_THEME.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )
    )}
    <CustomText fontFamily="SemiBold" fontSize={17} style={styles.topTitle}>
      {title}
    </CustomText>
    <View style={styles.topBarRight}>
      <CustomerLogoutButton iconColor={FOOD_THEME.text} style={styles.iconBtn} />
      <TouchableOpacity
        onPress={() => router.push("/customer/stores/cart")}
        style={styles.iconBtn}
        hitSlop={8}
      >
        <Ionicons name="bag-outline" size={24} color={FOOD_THEME.text} />
        {itemCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <CustomText fontFamily="Bold" fontSize={9} style={{ color: "#fff" }}>
              {itemCount > 9 ? "9+" : itemCount}
            </CustomText>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { flex: 1, textAlign: "center", color: FOOD_THEME.text },
  topBarRight: { flexDirection: "row", alignItems: "center" },
  badge: {
    position: "absolute",
    top: 6,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
});

export default CommerceTopBar;
