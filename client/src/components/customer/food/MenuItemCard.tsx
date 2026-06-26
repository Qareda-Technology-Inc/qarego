import { View, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { formatCurrency } from "@/utils/Constants";
import { MenuItem } from "@/service/foodService";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import { getDiscountBadgeLabel, getMenuItemPricing } from "@/utils/menuItemPricing";
import { itemHasModifiers } from "@/utils/menuModifiers";
import { getMenuItemTags, MENU_ITEM_TAG_CONFIG } from "@/utils/menuItemTags";
import {
  FOOD_THEME,
  MENU_LIST_IMAGE_RATIO,
  MENU_ROW_CARD_WIDTH,
  MENU_ROW_IMAGE_SIZE,
  MENU_ROW_TEXT_HEIGHT,
} from "@/styles/foodStyles";

type Props = {
  item: MenuItem;
  accent: string;
  isClosed: boolean;
  layout: "row" | "column";
  onAdd: () => void;
};

function PriceLine({
  item,
  accent,
  saleSize = 13,
  wasSize = 12,
}: {
  item: MenuItem;
  accent: string;
  saleSize?: number;
  wasSize?: number;
}) {
  const pricing = getMenuItemPricing(item);
  return (
    <View style={styles.priceRow}>
      <CustomText fontFamily="Bold" fontSize={saleSize} style={{ color: accent }}>
        {formatCurrency(pricing.salePrice)}
      </CustomText>
      {pricing.hasDiscount && pricing.originalPrice != null ? (
        <CustomText fontSize={wasSize} style={styles.wasPrice}>
          {formatCurrency(pricing.originalPrice)}
        </CustomText>
      ) : null}
    </View>
  );
}

function MenuItemTagChips({
  tags,
  size = "sm",
  style,
}: {
  tags?: string[];
  size?: "sm" | "md";
  style?: object;
}) {
  const activeTags = getMenuItemTags(tags);
  if (activeTags.length === 0) return null;

  const fontSize = size === "md" ? 10 : 9;
  const padH = size === "md" ? 8 : 7;
  const padV = size === "md" ? 3 : 3;

  return (
    <View style={[styles.tagRow, style]} pointerEvents="none">
      {activeTags.map((tag) => {
        const cfg = MENU_ITEM_TAG_CONFIG[tag];
        return (
          <View
            key={tag}
            style={[
              styles.badgeChip,
              { backgroundColor: cfg.backgroundColor, paddingHorizontal: padH, paddingVertical: padV },
            ]}
          >
            <CustomText fontFamily="SemiBold" fontSize={fontSize} style={{ color: cfg.color }}>
              {cfg.label}
            </CustomText>
          </View>
        );
      })}
    </View>
  );
}

function ImageBadges({ item }: { item: MenuItem }) {
  const discountBadge = getDiscountBadgeLabel(item);
  const activeTags = getMenuItemTags(item.tags);
  if (!discountBadge && activeTags.length === 0) return null;

  return (
    <View style={styles.imageBadges} pointerEvents="none">
      <MenuItemTagChips tags={item.tags} />
      {discountBadge ? (
        <View style={[styles.badgeChip, styles.badgeDiscount]}>
          <CustomText fontFamily="SemiBold" fontSize={9} style={styles.badgeDiscountText}>
            {discountBadge}
          </CustomText>
        </View>
      ) : null}
    </View>
  );
}

function AddButton({ onAdd, isClosed }: { onAdd: () => void; isClosed: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.addBtn, isClosed && styles.addDisabled]}
      onPress={onAdd}
      activeOpacity={0.85}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="add" size={20} color={isClosed ? "#9ca3af" : "#111827"} />
    </TouchableOpacity>
  );
}

function MenuItemImage({
  item,
  frameStyle,
  imageStyle,
  onAdd,
  isClosed,
  showBadges = true,
}: {
  item: MenuItem;
  frameStyle: object;
  imageStyle: object;
  onAdd: () => void;
  isClosed: boolean;
  showBadges?: boolean;
}) {
  const itemImage = resolveMediaUrl(item.imageUrl);
  return (
    <View style={[frameStyle, styles.imageFrame]}>
      {itemImage ? (
        <Image source={{ uri: itemImage }} style={imageStyle} resizeMode="cover" />
      ) : (
        <View style={[imageStyle, styles.imagePlaceholder]} />
      )}
      {showBadges ? <ImageBadges item={item} /> : null}
      <View style={styles.addBtnWrap}>
        <AddButton onAdd={onAdd} isClosed={isClosed} />
      </View>
    </View>
  );
}

/** Bolt-style row tile: square image, price then name */
function RowTileBody({ item, accent }: { item: MenuItem; accent: string }) {
  return (
    <View style={tileStyles.body}>
      <PriceLine item={item} accent={accent} saleSize={13} wasSize={11} />
      <CustomText fontSize={12} numberOfLines={2} style={tileStyles.name}>
        {item.name}
      </CustomText>
    </View>
  );
}

/** Bolt-style list row: text left, image right */
function ListRowBody({ item, accent }: { item: MenuItem; accent: string }) {
  const description = item.description?.trim();

  return (
    <View style={listStyles.body}>
      <MenuItemTagChips tags={item.tags} size="md" style={listStyles.tagRow} />
      <CustomText fontFamily="SemiBold" fontSize={14} numberOfLines={2} style={listStyles.name}>
        {item.name}
      </CustomText>
      {description ? (
        <CustomText fontSize={12} color={FOOD_THEME.textMuted} numberOfLines={3} style={listStyles.description}>
          {description}
        </CustomText>
      ) : null}
      <View style={listStyles.priceWrap}>
        <PriceLine item={item} accent={accent} saleSize={14} wasSize={12} />
      </View>
      {itemHasModifiers(item) ? (
        <CustomText fontSize={11} color={FOOD_THEME.textLight} style={listStyles.customizable}>
          Customizable
        </CustomText>
      ) : null}
    </View>
  );
}

export default function MenuItemCard({ item, accent, isClosed, layout, onAdd }: Props) {
  if (layout === "column") {
    return (
      <View style={listStyles.card}>
        <ListRowBody item={item} accent={accent} />
        <MenuItemImage
          item={item}
          frameStyle={listStyles.imageFrame}
          imageStyle={listStyles.image}
          onAdd={onAdd}
          isClosed={isClosed}
          showBadges={false}
        />
      </View>
    );
  }

  return (
    <View style={tileStyles.card}>
      <MenuItemImage
        item={item}
        frameStyle={tileStyles.imageFrame}
        imageStyle={tileStyles.image}
        onAdd={onAdd}
        isClosed={isClosed}
        showBadges
      />
      <RowTileBody item={item} accent={accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  imageFrame: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  imagePlaceholder: {
    backgroundColor: "#e5e7eb",
  },
  imageBadges: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 4,
    maxWidth: "88%",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },
  badgeChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeDiscount: {
    backgroundColor: "#ef4444",
  },
  badgeDiscountText: {
    color: "#fff",
  },
  addBtnWrap: {
    position: "absolute",
    right: 6,
    bottom: 6,
    zIndex: 3,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  addDisabled: {
    backgroundColor: "#f3f4f6",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  wasPrice: {
    color: FOOD_THEME.textLight,
    textDecorationLine: "line-through",
  },
});

/** Horizontal carousel — square image, price → name */
const tileStyles = StyleSheet.create({
  card: {
    width: MENU_ROW_CARD_WIDTH,
  },
  imageFrame: {
    width: MENU_ROW_IMAGE_SIZE,
    height: MENU_ROW_IMAGE_SIZE,
  },
  image: {
    width: MENU_ROW_IMAGE_SIZE,
    height: MENU_ROW_IMAGE_SIZE,
  },
  body: {
    marginTop: 8,
    minHeight: MENU_ROW_TEXT_HEIGHT,
    gap: 4,
  },
  name: {
    color: FOOD_THEME.text,
    lineHeight: 16,
  },
});

/** Full-width list — ~62% text left, ~38% image right */
const listStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FOOD_THEME.divider,
    gap: 12,
  },
  body: {
    flex: 62,
    minWidth: 0,
    paddingRight: 4,
  },
  tagRow: {
    marginBottom: 6,
  },
  name: {
    color: FOOD_THEME.text,
    lineHeight: 20,
  },
  description: {
    marginTop: 4,
    lineHeight: 17,
  },
  priceWrap: {
    marginTop: 8,
  },
  customizable: {
    marginTop: 4,
  },
  imageFrame: {
    flex: 38,
    aspectRatio: MENU_LIST_IMAGE_RATIO,
    flexShrink: 0,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
