import { View, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { formatCurrency } from "@/utils/Constants";
import { MenuItem } from "@/service/foodService";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import { getDiscountBadgeLabel, getMenuItemPricing } from "@/utils/menuItemPricing";
import { itemHasModifiers } from "@/utils/menuModifiers";

type Props = {
  item: MenuItem;
  accent: string;
  isClosed: boolean;
  layout: "row" | "column";
  onAdd: () => void;
};

function MenuItemTagsOverlay({ item }: { item: MenuItem }) {
  const tags = item.tags || [];
  const discountBadge = getDiscountBadgeLabel(item);
  if (!discountBadge && tags.length === 0) return null;

  const chips: { key: string; label: string; style: object; textColor: string }[] = [];
  if (discountBadge) {
    chips.push({
      key: "discount",
      label: discountBadge,
      style: tagStyles.discount,
      textColor: "#fff",
    });
  }
  if (tags.includes("popular")) {
    chips.push({ key: "popular", label: "Popular", style: tagStyles.popular, textColor: "#b45309" });
  }
  if (tags.includes("new")) {
    chips.push({ key: "new", label: "New", style: tagStyles.new, textColor: "#1d4ed8" });
  }
  if (tags.includes("spicy")) {
    chips.push({ key: "spicy", label: "Spicy", style: tagStyles.spicy, textColor: "#b91c1c" });
  }

  return (
    <View style={tagStyles.overlay} pointerEvents="none">
      {chips.map((chip) => (
        <View key={chip.key} style={[tagStyles.chip, chip.style]}>
          <CustomText fontFamily="SemiBold" fontSize={9} style={{ color: chip.textColor }}>
            {chip.label}
          </CustomText>
        </View>
      ))}
    </View>
  );
}

function MenuItemAddButton({ onAdd, isClosed }: { onAdd: () => void; isClosed: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.addBtn, isClosed && styles.addDisabled]}
      onPress={onAdd}
      activeOpacity={0.85}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons name="add" size={22} color={isClosed ? "#9ca3af" : "#111827"} />
    </TouchableOpacity>
  );
}

function MenuItemImage({
  item,
  frameStyle,
  imageStyle,
  onAdd,
  isClosed,
}: {
  item: MenuItem;
  frameStyle: object;
  imageStyle: object;
  onAdd: () => void;
  isClosed: boolean;
}) {
  const itemImage = resolveMediaUrl(item.imageUrl);
  return (
    <View style={[frameStyle, styles.imageFrame]}>
      {itemImage ? (
        <Image source={{ uri: itemImage }} style={imageStyle} resizeMode="cover" />
      ) : (
        <View style={[imageStyle, styles.imagePlaceholder]} />
      )}
      <MenuItemTagsOverlay item={item} />
      <MenuItemAddButton onAdd={onAdd} isClosed={isClosed} />
    </View>
  );
}

function MenuItemDetails({
  item,
  accent,
  nameLines = 2,
}: {
  item: MenuItem;
  accent: string;
  nameLines?: number;
}) {
  const pricing = getMenuItemPricing(item);
  const description = item.description?.trim();

  return (
    <>
      <CustomText fontFamily="Medium" fontSize={14} numberOfLines={nameLines} style={styles.name}>
        {item.name}
      </CustomText>
      {description ? (
        <CustomText fontSize={12} color="#6b7280" numberOfLines={2} style={styles.description}>
          {description}
        </CustomText>
      ) : null}
      <View style={styles.priceRow}>
        {pricing.hasDiscount && pricing.originalPrice != null ? (
          <CustomText fontSize={10} style={styles.wasPrice}>
            {formatCurrency(pricing.originalPrice)}
          </CustomText>
        ) : null}
        <CustomText fontFamily="SemiBold" fontSize={11} style={{ color: accent }}>
          {formatCurrency(pricing.salePrice)}
        </CustomText>
      </View>
      {itemHasModifiers(item) ? (
        <CustomText fontSize={10} color="#6b7280" style={styles.customizable}>
          Customizable
        </CustomText>
      ) : null}
    </>
  );
}

export default function MenuItemCard({ item, accent, isClosed, layout, onAdd }: Props) {
  if (layout === "column") {
    return (
      <View style={colStyles.card}>
        <MenuItemImage
          item={item}
          frameStyle={colStyles.imageFrame}
          imageStyle={colStyles.image}
          onAdd={onAdd}
          isClosed={isClosed}
        />
        <MenuItemDetails item={item} accent={accent} />
      </View>
    );
  }

  return (
    <View style={rowStyles.card}>
      <MenuItemImage
        item={item}
        frameStyle={rowStyles.imageFrame}
        imageStyle={rowStyles.image}
        onAdd={onAdd}
        isClosed={isClosed}
      />
      <View style={rowStyles.body}>
        <MenuItemDetails item={item} accent={accent} nameLines={2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageFrame: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 8,
  },
  imagePlaceholder: {
    backgroundColor: "#e5e7eb",
  },
  addBtn: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 3,
  },
  addDisabled: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
  },
  name: { marginTop: 8 },
  description: { marginTop: 4, lineHeight: 17 },
  priceRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  wasPrice: {
    color: "#9ca3af",
    textDecorationLine: "line-through",
  },
  customizable: {
    marginTop: 4,
  },
});

const tagStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 4,
    maxWidth: "78%",
  },
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  discount: { backgroundColor: "#16a34a" },
  popular: { backgroundColor: "#fef3c7" },
  new: { backgroundColor: "#dbeafe" },
  spicy: { backgroundColor: "#fee2e2" },
});

const colStyles = StyleSheet.create({
  card: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  imageFrame: { width: "100%" },
  image: { width: "100%", height: 100 },
});

const rowStyles = StyleSheet.create({
  card: {
    width: 148,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  imageFrame: { width: "100%" },
  image: { width: "100%", height: 88 },
  body: { marginTop: 8 },
});
