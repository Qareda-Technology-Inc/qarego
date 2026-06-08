import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FoodPromoBanner } from "@/service/foodService";
import { resolveMediaUrl } from "@/utils/mediaUrl";
const { width: SCREEN_W } = Dimensions.get("window");
const H_PAD = 16;
const CARD_GAP = 14;
const CARD_W = SCREEN_W - H_PAD * 2 - CARD_GAP;
const SNAP_STEP = CARD_W + CARD_GAP;
/** ~2.4:1 — keep in sync with admin upload guidance (1080×450) */
const CARD_H = Math.round(CARD_W / 2.4);
/** Time each slide stays visible before auto-advance */
const AUTO_MS = 5500;

type Props = {
  banners: FoodPromoBanner[];
  accent: string;
};

export default function FoodPromoCarousel({ banners, accent }: Props) {
  const listRef = useRef<FlatList<FoodPromoBanner>>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / SNAP_STEP);
    if (i !== indexRef.current) {
      indexRef.current = i;
      setIndex(i);
    }
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % banners.length;
      indexRef.current = next;
      setIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    }, AUTO_MS);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (!banners.length) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={banners}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_STEP}
        snapToAlignment="start"
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => `promo-${i}`}
        getItemLayout={(_, i) => ({ length: SNAP_STEP, offset: SNAP_STEP * i, index: i })}
        contentContainerStyle={styles.list}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item }) => {
          const uri = resolveMediaUrl(item.imageUrl);
          return (
            <View style={styles.slide}>
              <View style={styles.card}>
                {uri ? (
                  <Image source={{ uri }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={[styles.image, styles.placeholder]} />
                )}
              </View>
            </View>
          );
        }}
      />
      {banners.length > 1 ? (
        <View style={styles.dots}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && [styles.dotActive, { backgroundColor: accent }]]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    marginBottom: 10,
  },
  list: {
    paddingHorizontal: H_PAD,
    paddingVertical: 4,
  },
  slide: {
    width: SNAP_STEP,
    paddingRight: CARD_GAP,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#d8dee6",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    backgroundColor: "#e5e7eb",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingBottom: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#d1d5db",
  },
  dotActive: {
    width: 18,
    borderRadius: 4,
  },
});
