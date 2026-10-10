import React, { useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import CustomText from "../shared/CustomText";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";
import { FoodOrder, Restaurant } from "@/service/foodService";
import { resolveStoreVertical, STORE_VERTICAL_CONFIG } from "@/utils/storeVertical";
import { getCommerceOrderCopy } from "@/utils/commerceOrderCopy";

const MAX_STORES = 6;

type RecentStore = {
  restaurant: Restaurant;
  itemCount: number;
};

/** Most recent delivered order per store, newest first. Orders arrive sorted by date. */
function recentStores(orders: FoodOrder[]): RecentStore[] {
  const seen = new Set<string>();
  const out: RecentStore[] = [];
  for (const order of orders) {
    const restaurant = order.restaurant;
    if (order.status !== "DELIVERED" || !restaurant?._id || seen.has(restaurant._id)) continue;
    seen.add(restaurant._id);
    out.push({
      restaurant,
      itemCount: (order.items ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0),
    });
    if (out.length >= MAX_STORES) break;
  }
  return out;
}

type Props = {
  orders: FoodOrder[];
  /** Horizontal padding of the parent, so the row can scroll edge to edge. */
  bleed: number;
};

/**
 * "Order again" — stores the customer has had delivered from before.
 * Opens the store page; it does not refill the cart, since prices may have changed.
 */
const OrderAgainRow = ({ orders, bleed }: Props) => {
  const stores = useMemo(() => recentStores(orders), [orders]);
  if (!stores.length) return null;

  return (
    <View style={styles.section}>
      <CustomText fontFamily="SemiBold" fontSize={15} style={styles.title}>
        Order again
      </CustomText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -bleed }}
        contentContainerStyle={[styles.list, { paddingHorizontal: bleed }]}
      >
        {stores.map(({ restaurant, itemCount }) => {
          const vertical = resolveStoreVertical(restaurant);
          const config = STORE_VERTICAL_CONFIG[vertical];
          const emoji = restaurant.imageEmoji || getCommerceOrderCopy(vertical).storeEmoji;
          return (
            <Pressable
              key={restaurant._id}
              onPress={() =>
                router.push({
                  pathname: "/customer/stores/[id]",
                  params: { id: restaurant._id, vertical },
                })
              }
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Order again from ${restaurant.name}`}
            >
              <View style={[styles.emojiWell, { backgroundColor: `${config.accent}1A` }]}>
                <CustomText fontSize={22}>{emoji}</CustomText>
              </View>
              <CustomText
                fontFamily="SemiBold"
                fontSize={13}
                numberOfLines={2}
                style={styles.name}
              >
                {restaurant.name}
              </CustomText>
              <CustomText fontSize={11} numberOfLines={1} style={styles.meta}>
                {`${itemCount} item${itemCount === 1 ? "" : "s"} last time`}
              </CustomText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 22,
  },
  title: {
    color: Colors.text,
    marginBottom: 10,
  },
  list: {
    gap: 10,
    paddingVertical: 4,
  },
  card: {
    width: 150,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    ...DS.shadow.card,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  emojiWell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  name: {
    color: Colors.text,
  },
  meta: {
    color: DS.color.textMuted,
    marginTop: 2,
  },
});

export default OrderAgainRow;
