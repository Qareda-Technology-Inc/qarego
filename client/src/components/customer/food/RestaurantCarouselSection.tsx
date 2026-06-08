import { View, FlatList, StyleSheet } from "react-native";
import React, { FC } from "react";
import CustomText from "@/components/shared/CustomText";
import { Restaurant } from "@/service/foodService";
import RestaurantCard from "./RestaurantCard";
import { FOOD_THEME } from "@/styles/foodStyles";

type Props = {
  title: string;
  subtitle?: string;
  data: Restaurant[];
  onPressRestaurant: (id: string) => void;
  badge?: (r: Restaurant) => string | null;
  deliveryAmount?: (r: Restaurant) => number | undefined;
};

const RestaurantCarouselSection: FC<Props> = ({
  title,
  subtitle,
  data,
  onPressRestaurant,
  badge,
  deliveryAmount,
}) => {
  if (data.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <CustomText fontFamily="SemiBold" fontSize={18} style={styles.title}>
            {title}
          </CustomText>
          {subtitle ? (
            <CustomText fontSize={12} color={FOOD_THEME.textLight} style={{ marginTop: 2 }}>
              {subtitle}
            </CustomText>
          ) : null}
        </View>
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
            variant="carousel"
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
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    color: FOOD_THEME.text,
  },
  list: {
    paddingHorizontal: 16,
    paddingRight: 8,
  },
});

export default RestaurantCarouselSection;
