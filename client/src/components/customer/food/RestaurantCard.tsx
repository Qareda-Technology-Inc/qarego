import { View, TouchableOpacity, StyleSheet, Text, Image } from "react-native";
import React, { FC } from "react";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "@/components/shared/CustomText";
import { formatCurrency } from "@/utils/Constants";
import { Restaurant } from "@/service/foodService";
import {
  CAROUSEL_CARD_HEIGHT,
  CAROUSEL_CARD_IMAGE_HEIGHT,
  CAROUSEL_CARD_WIDTH,
  FULL_WIDTH_CARD_HEIGHT,
  FULL_WIDTH_CARD_IMAGE_HEIGHT,
  FULL_WIDTH_CARD_WIDTH,
  GRID_CARD_BODY_HEIGHT,
  GRID_CARD_HEIGHT,
  GRID_CARD_IMAGE_HEIGHT,
  GRID_CARD_WIDTH,
  QUICK_CAROUSEL_CARD_HEIGHT,
  QUICK_CAROUSEL_CARD_IMAGE_HEIGHT,
  QUICK_CAROUSEL_CARD_WIDTH,
  FOOD_THEME,
  cuisineHeroBg,
  formatPrepWindow,
} from "@/styles/foodStyles";
import { resolveMediaUrl } from "@/utils/mediaUrl";

type Props = {
  restaurant: Restaurant;
  onPress: () => void;
  variant?: "list" | "carousel" | "carouselQuick" | "grid" | "fullWidth";
  badgeLabel?: string;
  deliveryAmount?: number;
};

/** Compact store tile — fixed height so 2-column rows stay aligned. */
const RestaurantCard: FC<Props> = ({
  restaurant,
  onPress,
  variant = "grid",
  badgeLabel,
  deliveryAmount,
}) => {
  const isCarousel = variant === "carousel";
  const isCarouselQuick = variant === "carouselQuick";
  const isGrid = variant === "grid";
  const isFullWidth = variant === "fullWidth";
  const isTile = isGrid || isCarousel || isCarouselQuick || isFullWidth;
  const rating = restaurant.rating?.toFixed(1) ?? "4.5";
  const reviewCount = restaurant.ratingCount ?? 0;
  const prepWindow = formatPrepWindow(restaurant.estimatedPrepMinutes);
  const isClosed = restaurant.isOpen === false;
  const emoji = restaurant.imageEmoji || "🍽️";
  const coverUrl = resolveMediaUrl(restaurant.imageUrl);
  const heroBg = coverUrl ? "#f3f4f6" : cuisineHeroBg(restaurant.cuisine);
  const deliveryLabel =
    deliveryAmount != null ? formatCurrency(deliveryAmount) : "GH₵--";

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isGrid && styles.cardGrid,
        isCarousel && styles.cardCarousel,
        isCarousel && styles.cardCarouselSize,
        isCarouselQuick && styles.cardCarousel,
        isCarouselQuick && styles.cardCarouselQuickSize,
        isFullWidth && styles.cardFullWidth,
        !isTile && styles.cardList,
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View
        style={[
          styles.hero,
          isGrid && styles.heroGrid,
          isCarousel && styles.heroCarousel,
          isCarouselQuick && styles.heroCarouselQuick,
          isFullWidth && styles.heroFullWidth,
          !isTile && styles.heroList,
          { backgroundColor: heroBg },
          isClosed && styles.heroClosed,
        ]}
      >
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <Text
            style={[
              styles.emoji,
              isTile ? styles.emojiTile : styles.emojiList,
              isClosed && styles.dimmed,
            ]}
          >
            {emoji}
          </Text>
        )}

        {!isClosed ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={9} color="#111827" />
            <CustomText fontFamily="SemiBold" fontSize={10} style={styles.ratingText}>
              {rating}
            </CustomText>
            {reviewCount > 0 ? (
              <CustomText fontSize={9} style={styles.reviewCount}>
                ({reviewCount})
              </CustomText>
            ) : null}
          </View>
        ) : null}

        {isClosed ? (
          <View style={styles.closedOverlay}>
            <View style={styles.closedPill}>
              <CustomText fontFamily="SemiBold" fontSize={10} style={styles.closedPillText}>
                {restaurant.openLabel || "Closed"}
              </CustomText>
            </View>
          </View>
        ) : badgeLabel ? (
          <View style={styles.offerBadge}>
            <CustomText fontFamily="SemiBold" fontSize={9} style={styles.offerText}>
              {badgeLabel}
            </CustomText>
          </View>
        ) : null}
      </View>

      <View style={[styles.body, isTile ? styles.bodyTile : styles.bodyList]}>
        <CustomText fontFamily="SemiBold" fontSize={12} numberOfLines={1} ellipsizeMode="tail" style={styles.name}>
          {restaurant.name}
        </CustomText>
        <View style={styles.metaRow}>
          <View style={styles.metaGroup}>
            <Ionicons name="bicycle-outline" size={11} color={FOOD_THEME.textMuted} />
            <CustomText fontSize={10} style={styles.metaText} numberOfLines={1}>
              {deliveryLabel}
            </CustomText>
          </View>
          <View style={styles.metaGroup}>
            <Ionicons name="time-outline" size={11} color={FOOD_THEME.textMuted} />
            <CustomText fontSize={10} style={styles.metaText} numberOfLines={1}>
              {prepWindow}
            </CustomText>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const LIST_THUMB = 76;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "transparent",
  },
  cardGrid: {
    width: GRID_CARD_WIDTH,
    height: GRID_CARD_HEIGHT,
  },
  cardCarousel: {},
  cardCarouselSize: {
    width: CAROUSEL_CARD_WIDTH,
    height: CAROUSEL_CARD_HEIGHT,
  },
  cardCarouselQuickSize: {
    width: QUICK_CAROUSEL_CARD_WIDTH,
    height: QUICK_CAROUSEL_CARD_HEIGHT,
  },
  cardFullWidth: {
    width: FULL_WIDTH_CARD_WIDTH,
    height: FULL_WIDTH_CARD_HEIGHT,
  },
  cardList: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
    width: "100%",
    minHeight: LIST_THUMB + GRID_CARD_BODY_HEIGHT,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  heroGrid: {
    height: GRID_CARD_IMAGE_HEIGHT,
    borderRadius: 10,
  },
  heroCarousel: {
    height: CAROUSEL_CARD_IMAGE_HEIGHT,
    borderRadius: 10,
  },
  heroCarouselQuick: {
    height: QUICK_CAROUSEL_CARD_IMAGE_HEIGHT,
    borderRadius: 10,
  },
  heroFullWidth: {
    height: FULL_WIDTH_CARD_IMAGE_HEIGHT,
    borderRadius: 10,
  },
  heroList: {
    width: LIST_THUMB,
    height: LIST_THUMB,
    borderRadius: 10,
    flexShrink: 0,
  },
  heroClosed: {
    opacity: 0.9,
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  emoji: {
    textAlign: "center",
  },
  emojiTile: {
    fontSize: 42,
    lineHeight: 48,
  },
  emojiList: {
    fontSize: 30,
    lineHeight: 36,
  },
  ratingBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 3,
    maxWidth: "92%",
  },
  ratingText: {
    color: "#111827",
  },
  reviewCount: {
    color: FOOD_THEME.textMuted,
  },
  offerBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#dc2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
    backgroundColor: "rgba(255,255,255,0.55)",
    zIndex: 4,
  },
  closedPill: {
    backgroundColor: "rgba(17,24,39,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  closedPillText: {
    color: "#fff",
  },
  body: {
    minWidth: 0,
    overflow: "hidden",
    width: "100%",
    alignItems: "flex-start",
  },
  bodyTile: {
    height: GRID_CARD_BODY_HEIGHT,
    paddingTop: 6,
    justifyContent: "space-between",
  },
  bodyList: {
    flex: 1,
    paddingTop: 2,
    height: GRID_CARD_BODY_HEIGHT,
    justifyContent: "space-between",
  },
  name: {
    color: FOOD_THEME.text,
    lineHeight: 15,
    textAlign: "left",
    alignSelf: "stretch",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    alignSelf: "stretch",
  },
  metaGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flexShrink: 1,
    minWidth: 0,
  },
  metaText: {
    color: FOOD_THEME.textMuted,
    flexShrink: 1,
    textAlign: "left",
  },
});

export default RestaurantCard;
