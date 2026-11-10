import { View, TouchableOpacity, StyleSheet } from "react-native";
import React, { FC } from "react";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "../shared/CustomText";
import { RideHomeTheme as T } from "@/styles/rideHomeTheme";

/** Bold the part of `text` that matches what the customer typed. */
function Highlighted({ text, query }: { text: string; query?: string }) {
  const q = query?.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (!q || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <CustomText fontFamily="Bold" fontSize={15} style={{ color: T.ink }}>
        {text.slice(i, i + q.length)}
      </CustomText>
      {text.slice(i + q.length)}
    </>
  );
}

const LocationItem: FC<{
  item: any;
  onPress: () => void;
  /** What the customer typed, to highlight in the result. */
  query?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}> = ({ item, onPress, query, icon = "location-outline" }) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row} activeOpacity={0.7}>
      <Ionicons name={icon} size={19} color={T.inkMuted} style={styles.icon} />
      <View style={styles.textWrap}>
        <CustomText fontFamily="Medium" fontSize={15} numberOfLines={1} style={styles.title}>
          <Highlighted text={String(item?.title ?? "")} query={query} />
        </CustomText>
        {item?.description ? (
          <CustomText numberOfLines={1} fontSize={12} style={styles.desc}>
            {item.description}
          </CustomText>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(15, 23, 42, 0.10)",
  },
  icon: { width: 28 },
  textWrap: { flex: 1, minWidth: 0 },
  title: { color: T.ink },
  desc: { marginTop: 2, color: T.inkMuted },
});

export default LocationItem;
