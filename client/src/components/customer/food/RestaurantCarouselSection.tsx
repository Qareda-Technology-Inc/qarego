import { View, FlatList, StyleSheet } from "react-native";
import React, { FC } from "react";
import CustomText from "@/components/shared/CustomText";
import { Restaurant } from "@/service/foodService";
import RestaurantCard from "./RestaurantCard";
import { CAROUSEL_LIST_PAD, FOOD_THEME } from "@/styles/foodStyles";

type Props = {
  title: string;
  subtitle?: string;
  data: Restaurant[];
  onPressRestaurant: (id: string) => void;
  badge?: (r: Restaurant) => string | null;
  deliveryAmount?: (r: Restaurant) => number | undefined;
  compact?: boolean;
};

const RestaurantCarouselSection: FC<Props> = ({
  title,
  subtitle,
  data,
  onPressRestaurant,
  badge,
  deliveryAmount,
  compact = true,
}) => {
  if (data.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <CustomText fontFamily="SemiBold" fontSize={14} style={styles.title}>
          {title}
        </CustomText>
        {subtitle && !compact ? (
          <CustomText fontSize={11} color={FOOD_THEME.textLight} style={styles.subtitle}>
            {subtitle}
          </CustomText>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(item) => `carousel-${item._id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <RestaurantCard
            restaurant={item}
            variant={compact ? "carouselQuick" : "carousel"}
            onPress={() => onPressRestaurant(item._id)}
            badgeLabel={badge?.(item) ?? undefined}
            deliveryAmount={deliveryAmount?.(item)}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 6,
    marginBottom: 20,
  },
  header: {
    paddingHorizontal: CAROUSEL_LIST_PAD,
    marginBottom: 10,
  },
  title: {
    color: FOOD_THEME.text,
  },
  subtitle: {
    marginTop: 2,
  },
  list: {
    paddingHorizontal: CAROUSEL_LIST_PAD,
    paddingRight: CAROUSEL_LIST_PAD - 4,
    gap: 12,
  },
});

export default RestaurantCarouselSection;
