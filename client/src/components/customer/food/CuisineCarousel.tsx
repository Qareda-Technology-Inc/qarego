import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import React, { FC } from "react";
import CustomText from "@/components/shared/CustomText";
import { FOOD_THEME } from "@/styles/foodStyles";
import { verticalTagEmoji } from "@/utils/commerceVerticalTags";
import type { StoreVertical } from "@/utils/storeVertical";

type Props = {
  cuisines: string[];
  selected: string;
  onSelect: (cuisine: string) => void;
  vertical?: StoreVertical;
};

const CuisineCarousel: FC<Props> = ({ cuisines, selected, onSelect, vertical = "FOOD" }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.row}
    style={styles.scroll}
  >
    {cuisines.map((c) => {
      const active = selected === c;
      return (
        <TouchableOpacity
          key={c}
          style={styles.item}
          onPress={() => onSelect(c)}
          activeOpacity={0.8}
        >
          <View style={[styles.circle, active && styles.circleActive]}>
            <CustomText fontSize={26}>{verticalTagEmoji(c, vertical)}</CustomText>
          </View>
          <CustomText
            fontFamily={active ? "SemiBold" : "Regular"}
            fontSize={10}
            numberOfLines={2}
            style={[styles.label, active && styles.labelActive]}
          >
            {c}
          </CustomText>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  scroll: {
    marginBottom: 8,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 4,
  },
  item: {
    alignItems: "center",
    width: 80,
    marginRight: 4,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: FOOD_THEME.searchBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  circleActive: {
    backgroundColor: FOOD_THEME.orangeLight,
    borderColor: FOOD_THEME.orange,
  },
  label: {
    marginTop: 6,
    color: FOOD_THEME.textMuted,
    textAlign: "center",
  },
  labelActive: {
    color: FOOD_THEME.orangeDark,
  },
});

export default CuisineCarousel;
