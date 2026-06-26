import { StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { MENU_ROW_CARD_GAP, MENU_ROW_H_PAD, MENU_ROW_IMAGE_SIZE, MENU_ROW_TEXT_HEIGHT } from "@/styles/foodStyles";
import { MenuItem } from "@/service/foodService";
import MenuItemCard from "@/components/customer/food/MenuItemCard";

type Props = {
  items: MenuItem[];
  accent: string;
  isClosed: boolean;
  onAdd: (item: MenuItem) => void;
};

/** Horizontal drinks/items row — uses gesture-handler so it scrolls inside the menu. */
export default function MenuItemsHorizontalRow({ items, accent, isClosed, onAdd }: Props) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={styles.content}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        bounces
        scrollEventThrottle={16}
      >
        {items.map((item) => (
          <MenuItemCard
            key={item._id}
            item={item}
            accent={accent}
            isClosed={isClosed}
            layout="row"
            onAdd={() => onAdd(item)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -16,
  },
  list: {
    flexGrow: 0,
    minHeight: MENU_ROW_IMAGE_SIZE + MENU_ROW_TEXT_HEIGHT + 16,
  },
  content: {
    paddingHorizontal: MENU_ROW_H_PAD,
    paddingBottom: 6,
    alignItems: "flex-start",
    gap: MENU_ROW_CARD_GAP,
  },
});
