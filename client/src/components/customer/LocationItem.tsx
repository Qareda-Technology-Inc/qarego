import { View, TouchableOpacity, StyleSheet } from "react-native";
import React, { FC } from "react";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "../shared/CustomText";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";

const LocationItem: FC<{
  item: any;
  onPress: () => void;
}> = ({ item, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.75}>
      <View style={styles.iconWrap}>
        <Ionicons name="location-outline" size={20} color={T.ink} />
      </View>
      <View style={styles.textWrap}>
        <CustomText fontFamily="SemiBold" fontSize={15} numberOfLines={1} style={styles.title}>
          {item?.title}
        </CustomText>
        {item?.description ? (
          <CustomText
            fontFamily="Regular"
            numberOfLines={2}
            fontSize={13}
            style={styles.desc}
          >
            {item.description}
          </CustomText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={T.inkSoft} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.sheetBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: T.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: T.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textWrap: { flex: 1, minWidth: 0 },
  title: { color: T.ink },
  desc: { marginTop: 3, color: T.inkMuted },
});

export default LocationItem;
