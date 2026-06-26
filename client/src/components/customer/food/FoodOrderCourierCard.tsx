import React, { FC } from "react";
import { View, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { FOOD_THEME } from "@/styles/foodStyles";
import { getVehicleIconSource, getVehicleLabel } from "@/utils/mapUtils";

type Props = {
  name: string;
  vehicle?: string;
  rating?: number | null;
  statusLabel?: string;
};

const FoodOrderCourierCard: FC<Props> = ({ name, vehicle = "motorcycle", rating, statusLabel }) => (
  <View style={styles.card}>
    <View style={styles.avatar}>
      <Ionicons name="person" size={22} color={FOOD_THEME.textMuted} />
    </View>
    <View style={styles.body}>
      <CustomText fontFamily="SemiBold" fontSize={15}>
        {name}
      </CustomText>
      <View style={styles.metaRow}>
        <Image source={getVehicleIconSource(vehicle)} style={styles.vehicleIcon} />
        <CustomText fontSize={12} color={FOOD_THEME.textMuted}>
          {getVehicleLabel(vehicle)}
        </CustomText>
        {rating != null && rating > 0 ? (
          <>
            <CustomText fontSize={12} color={FOOD_THEME.textLight}>
              ·
            </CustomText>
            <Ionicons name="star" size={12} color="#f59e0b" />
            <CustomText fontSize={12} color={FOOD_THEME.textMuted}>
              {rating.toFixed(1)}
            </CustomText>
          </>
        ) : null}
      </View>
      {statusLabel ? (
        <CustomText fontSize={12} color={FOOD_THEME.accentTeal} style={{ marginTop: 4 }}>
          {statusLabel}
        </CustomText>
      ) : null}
    </View>
    <View style={styles.liveDot}>
      <View style={styles.liveInner} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: FOOD_THEME.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: FOOD_THEME.divider,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: FOOD_THEME.searchBg,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  vehicleIcon: {
    width: 18,
    height: 18,
    resizeMode: "contain",
  },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  liveInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
});

export default FoodOrderCourierCard;
