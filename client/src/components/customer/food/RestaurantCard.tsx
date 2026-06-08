import { View, TouchableOpacity, StyleSheet, Text, Image } from "react-native";
import React, { FC } from "react";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { formatCurrency } from "@/utils/Constants";
import { Restaurant } from "@/service/foodService";
import { CAROUSEL_CARD_WIDTH, FOOD_THEME, cuisineHeroBg } from "@/styles/foodStyles";
import { resolveMediaUrl } from "@/utils/mediaUrl";

type Props = {
  restaurant: Restaurant;
  onPress: () => void;
  variant?: "list" | "carousel" | "grid";
  badgeLabel?: string;
  deliveryAmount?: number;
};

const RestaurantCard: FC<Props> = ({
  restaurant,
  onPress,
  variant = "list",
  badgeLabel,
  deliveryAmount,
}) => {
  const isCarousel = variant === "carousel";
  const isGrid = variant === "grid";
  const isVertical = isCarousel || isGrid;
  const rating = restaurant.rating?.toFixed(1) ?? "4.5";
  const prep = restaurant.estimatedPrepMinutes ?? 25;
  const isClosed = restaurant.isOpen === false;
  const emoji = restaurant.imageEmoji || "🍽️";
  const coverUrl = resolveMediaUrl(restaurant.imageUrl);
  const heroBg = coverUrl ? "#f3f4f6" : cuisineHeroBg(restaurant.cuisine);

  const heroOverlay = isClosed ? (
    <View style={styles.closedOverlay}>
      <View style={styles.closedPill}>
        <CustomText fontFamily="SemiBold" fontSize={12} style={styles.closedPillText}>
          {restaurant.openLabel || "Closed"}
        </CustomText>
      </View>
    </View>
  ) : badgeLabel ? (
    <View style={styles.offerBadge}>
      <CustomText fontFamily="SemiBold" fontSize={10} style={styles.offerText}>
        {badgeLabel}
      </CustomText>
    </View>
  ) : null;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isGrid ? styles.cardGrid : isCarousel ? styles.cardCarousel : styles.cardList,
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View
        style={[
          styles.hero,
          isGrid ? styles.heroGrid : isCarousel ? styles.heroCarousel : styles.heroList,
          { backgroundColor: heroBg },
          isClosed && styles.heroClosed,
        ]}
      >
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={[
              styles.coverImage,
              isGrid ? styles.coverGrid : isCarousel ? styles.coverCarousel : styles.coverList,
            ]}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={[
              isGrid ? styles.emojiGrid : isCarousel ? styles.emojiCarousel : styles.emojiList,
              isClosed && styles.dimmed,
            ]}
          >
            {emoji}
          </Text>
        )}
        {heroOverlay}
      </View>

      <View style={[styles.body, isVertical && styles.bodyCarousel, isGrid && styles.bodyGrid]}>
        <CustomText
          fontFamily="SemiBold"
          fontSize={isGrid ? 14 : isCarousel ? 15 : 16}
          numberOfLines={2}
          style={styles.name}
        >
          {restaurant.name}
        </CustomText>

        <View style={styles.metaLine}>
          <View style={styles.metaItem}>
            <Ionicons name="star" size={isGrid ? 11 : 13} color={FOOD_THEME.orange} />
            <CustomText fontFamily="Medium" fontSize={isGrid ? 11 : 12} style={styles.metaText}>
              {rating}
            </CustomText>
          </View>
          <CustomText fontSize={isGrid ? 11 : 12} style={styles.metaDot}>
            ·
          </CustomText>
          <CustomText fontSize={isGrid ? 11 : 12} style={styles.metaText}>
            {prep} min
          </CustomText>
        </View>

        <View style={styles.deliveryRow}>
          <Ionicons name="bicycle-outline" size={isGrid ? 11 : 13} color={FOOD_THEME.textMuted} />
          <CustomText fontSize={isGrid ? 11 : 12} style={styles.metaText}>
            {deliveryAmount != null ? formatCurrency(deliveryAmount) : "GH₵--"}
          </CustomText>
        </View>

        {!isVertical && (restaurant.minOrderAmount ?? 0) > 0 ? (
          <CustomText fontSize={11} color={FOOD_THEME.textLight} style={{ marginTop: 4 }}>
            Min {formatCurrency(restaurant.minOrderAmount)}
          </CustomText>
        ) : null}

        {isClosed && restaurant.openStatus === "closed" && restaurant.todayHours ? (
          <CustomText fontSize={11} color={FOOD_THEME.orange} style={{ marginTop: 4 }} numberOfLines={1}>
            Today {restaurant.todayHours}
          </CustomText>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const LIST_HERO_WIDTH = 118;

const styles = StyleSheet.create({
  card: {
    backgroundColor: FOOD_THEME.card,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: FOOD_THEME.border,
  },
  cardList: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 112,
    marginBottom: 12,
  },
  cardCarousel: {
    width: CAROUSEL_CARD_WIDTH,
    marginRight: 12,
    flexDirection: "column",
  },
  cardGrid: {
    flex: 1,
    flexDirection: "column",
    marginBottom: 12,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroList: {
    width: LIST_HERO_WIDTH,
    alignSelf: "stretch",
    minHeight: 112,
  },
  heroCarousel: {
    width: "100%",
    height: 156,
  },
  heroGrid: {
    width: "100%",
    height: 108,
  },
  heroClosed: {
    opacity: 0.92,
  },
  emojiList: {
    fontSize: 64,
    lineHeight: 72,
    textAlign: "center",
  },
  emojiCarousel: {
    fontSize: 88,
    lineHeight: 96,
    textAlign: "center",
  },
  emojiGrid: {
    fontSize: 52,
    lineHeight: 60,
    textAlign: "center",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverList: {
    width: LIST_HERO_WIDTH,
    minHeight: 112,
  },
  coverCarousel: {
    width: "100%",
    height: 156,
  },
  coverGrid: {
    width: "100%",
    height: 108,
  },
  offerBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: FOOD_THEME.orange,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 2,
  },
  offerText: {
    color: "#fff",
  },
  dimmed: {
    opacity: 0.35,
  },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
    zIndex: 1,
  },
  closedPill: {
    backgroundColor: "rgba(17,24,39,0.88)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  closedPillText: {
    color: "#fff",
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: "center",
    minWidth: 0,
  },
  bodyCarousel: {
    paddingVertical: 10,
    justifyContent: "flex-start",
  },
  bodyGrid: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  name: {
    color: FOOD_THEME.text,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 6,
    gap: 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    color: FOOD_THEME.textMuted,
  },
  metaDot: {
    color: FOOD_THEME.textLight,
    marginHorizontal: 2,
  },
  deliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
});

export default RestaurantCard;
