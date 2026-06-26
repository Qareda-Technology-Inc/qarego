import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import CustomText from "@/components/shared/CustomText";
import CustomerLogoutButton from "@/components/customer/CustomerLogoutButton";
import { Colors, formatCurrency } from "@/utils/Constants";
import {
  fetchFoodCheckoutSettings,
  fetchRestaurantMenu,
  MenuItem,
  Restaurant,
  MenuCategoryMeta,
} from "@/service/foodService";
import { useFoodCartStore } from "@/store/foodCartStore";
import { useUserStore } from "@/store/userStore";
import { useMessage } from "@/context/MessageContext";
import { DS } from "@/theme/designSystem";
import { resolveMediaUrl } from "@/utils/mediaUrl";
import MenuCategoryTabs from "@/components/customer/food/MenuCategoryTabs";
import MenuItemCard from "@/components/customer/food/MenuItemCard";
import MenuItemsHorizontalRow from "@/components/customer/food/MenuItemsHorizontalRow";
import MenuItemCustomizeModal from "@/components/customer/food/MenuItemCustomizeModal";
import { itemHasModifiers, type CartModifier } from "@/utils/menuModifiers";
import { ScrollView as GHScrollView } from "react-native-gesture-handler";

const AnimatedGHScrollView = Animated.createAnimatedComponent(GHScrollView);
import {
  STORE_VERTICAL_CONFIG,
  normalizeStoreVertical,
  storeHeroBackground,
} from "@/utils/storeVertical";
import { calculateDistance, calculateFoodDeliveryFee } from "@/utils/mapUtils";
import {
  ensureUserDeliveryLocation,
  hasValidDeliveryCoords,
} from "@/utils/ensureDeliveryLocation";

const NAV_H = 48;
const HERO_BODY = 196;
const STICKY_TABS_H = 50;
/** Scroll until hero image is fully gone */
const COLLAPSE = HERO_BODY;
/** Extra scroll before category row appears (after image hidden) */
const TABS_REVEAL = 36;

const RestaurantMenu = () => {
  const { id, vertical: verticalParam } = useLocalSearchParams<{ id: string; vertical?: string }>();
  const insets = useSafeAreaInsets();
  const { showMessage } = useMessage();
  const scrollY = useRef(new Animated.Value(0)).current;
  const wasCollapsed = useRef(false);
  const selectedVertical = useMemo(() => normalizeStoreVertical(verticalParam), [verticalParam]);
  const verticalConfig = STORE_VERTICAL_CONFIG[selectedVertical];
  const accent = verticalConfig.accent;

  const stickyBlockH = STICKY_TABS_H;
  const navTop = insets.top + NAV_H;
  const heroExpandedH = insets.top + HERO_BODY;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<Record<string, MenuItem[]>>({});
  const [menuCategories, setMenuCategories] = useState<MenuCategoryMeta[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [heroLight, setHeroLight] = useState(true);
  const [stickyInteractive, setStickyInteractive] = useState(false);
  const [customizeItem, setCustomizeItem] = useState<MenuItem | null>(null);

  const [serviceFeeConfig, setServiceFeeConfig] = useState<{
    fareRates: Record<string, { baseFare: number; perKmRate: number; minimumFare: number }> | null;
  }>({ fareRates: null });
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const addItem = useFoodCartStore((s) => s.addItem);
  const cartRestaurantId = useFoodCartStore((s) => s.restaurantId);
  const itemCount = useFoodCartStore((s) => s.itemCount());
  const { location, setLocation } = useUserStore();

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y;
        setHeroLight(y < COLLAPSE * 0.4);
        const collapsed = y >= COLLAPSE;
        const sticky = y >= COLLAPSE + TABS_REVEAL * 0.85;
        setStickyInteractive(sticky);
        if (collapsed !== wasCollapsed.current) {
          wasCollapsed.current = collapsed;
          if (!collapsed) setSelectedCategory("all");
        }
      },
    }
  );

  const heroHeight = scrollY.interpolate({
    inputRange: [0, COLLAPSE],
    outputRange: [heroExpandedH, 0],
    extrapolate: "clamp",
  });

  const heroImageOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE * 0.75, COLLAPSE],
    outputRange: [1, 0.35, 0],
    extrapolate: "clamp",
  });

  const heroMetaOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE * 0.5, COLLAPSE * 0.9],
    outputRange: [1, 0.4, 0],
    extrapolate: "clamp",
  });

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE * 0.55, COLLAPSE],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  /** Categories + pinned title only after hero is fully collapsed */
  const stickyReveal = scrollY.interpolate({
    inputRange: [COLLAPSE, COLLAPSE + TABS_REVEAL],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  /** Restaurant name in nav bar (between back and cart) after hero collapses */
  const navTitleOpacity = scrollY.interpolate({
    inputRange: [COLLAPSE * 0.85, COLLAPSE + TABS_REVEAL * 0.5],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const stickySectionHeight = scrollY.interpolate({
    inputRange: [COLLAPSE, COLLAPSE + TABS_REVEAL],
    outputRange: [0, stickyBlockH],
    extrapolate: "clamp",
  });

  const pinnedSpacer = scrollY.interpolate({
    inputRange: [COLLAPSE, COLLAPSE + TABS_REVEAL],
    outputRange: [0, stickyBlockH],
    extrapolate: "clamp",
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchRestaurantMenu(id);
      setRestaurant(data.restaurant);
      setMenu(data.menu || {});
      setMenuCategories(data.categories || []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetchFoodCheckoutSettings()
      .then((cfg) => {
        if (!cancelled) setServiceFeeConfig({ fareRates: cfg.fareRates ?? null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setResolvingLocation(true);
      setLocationError(null);
      const result = await ensureUserDeliveryLocation(location, setLocation);
      if (!active) return;
      if (!result.ok) setLocationError(result.message);
      setResolvingLocation(false);
    })();
    return () => {
      active = false;
    };
  }, [location, setLocation]);

  const categoryList = useMemo(() => {
    const byName = new Map<string, MenuCategoryMeta>();

    for (const c of menuCategories) {
      byName.set(c.name.toLowerCase(), c);
    }
    for (const name of Object.keys(menu)) {
      const key = name.toLowerCase();
      if (!byName.has(key)) {
        const first = menu[name]?.[0];
        byName.set(key, {
          name,
          displayLayout: (first?.displayLayout as "row" | "column") || "column",
        });
      }
    }

    const ordered: MenuCategoryMeta[] = [];
    for (const c of menuCategories) {
      const hit = byName.get(c.name.toLowerCase());
      if (hit) ordered.push(hit);
    }
    for (const meta of byName.values()) {
      if (!ordered.some((o) => o.name.toLowerCase() === meta.name.toLowerCase())) {
        ordered.push(meta);
      }
    }
    return ordered;
  }, [menuCategories, menu]);

  const getItemsForCategory = useCallback(
    (catName: string) => {
      if (menu[catName]?.length) return menu[catName];
      const key = Object.keys(menu).find((k) => k.toLowerCase() === catName.toLowerCase());
      return key ? menu[key] : [];
    },
    [menu]
  );

  const sectionsToShow = useMemo(() => {
    if (selectedCategory === "all") return categoryList;
    return categoryList.filter(
      (c) => c.name.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [categoryList, selectedCategory]);

  const isClosed = restaurant?.isOpen === false;
  const storeCover = resolveMediaUrl(restaurant?.imageUrl);
  const heroBg = storeCover
    ? "#1f2937"
    : storeHeroBackground(selectedVertical, restaurant?.cuisine);
  const displayEmoji = restaurant?.imageEmoji || verticalConfig.defaultEmoji;

  const deliveryEstimate = useMemo(() => {
    if (
      !restaurant ||
      !hasValidDeliveryCoords(location) ||
      typeof restaurant.latitude !== "number" ||
      typeof restaurant.longitude !== "number"
    ) {
      return null;
    }
    const km = calculateDistance(
      restaurant.latitude,
      restaurant.longitude,
      location!.latitude,
      location!.longitude
    );
    const fee = calculateFoodDeliveryFee(km, serviceFeeConfig.fareRates);
    return { km, fee };
  }, [restaurant, location, serviceFeeConfig.fareRates]);

  const pushToCart = (
    item: MenuItem,
    extras?: { price: number; modifiers: CartModifier[] }
  ) => {
    if (!restaurant) return;
    addItem({
      restaurantId: restaurant._id,
      restaurantName: restaurant.name,
      minOrderAmount: restaurant.minOrderAmount ?? 0,
      deliveryFee: 0,
      menuItemId: item._id,
      name: item.name,
      price: extras?.price ?? item.price,
      modifiers: extras?.modifiers ?? [],
    });
  };

  const handleAdd = (item: MenuItem) => {
    if (!restaurant) return;
    if (isClosed) {
      showMessage({
        title: restaurant.openLabel || "Closed",
        message:
          restaurant.openStatus === "closed"
            ? `${restaurant.name} is closed right now${
                restaurant.todayHours ? ` (today ${restaurant.todayHours})` : ""
              }. You can browse and come back when they're open.`
            : `${restaurant.name} isn't accepting orders right now. Please check back soon.`,
        type: "info",
      });
      return;
    }

    const proceed = () => {
      if (itemHasModifiers(item)) {
        setCustomizeItem(item);
        return;
      }
      pushToCart(item);
    };

    if (cartRestaurantId && cartRestaurantId !== restaurant._id) {
      showMessage({
        title: `Different ${verticalConfig.storeLabel}`,
        message: `Your cart has items from another ${verticalConfig.storeLabel}. Adding this will replace your cart.`,
        type: "confirm",
        buttons: [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace cart",
            onPress: proceed,
          },
        ],
      });
      return;
    }
    proceed();
  };

  const goToCart = () => {
    router.push({
      pathname: "/customer/stores/cart",
      params: { vertical: selectedVertical },
    });
  };

  const renderMenuSections = () => {
    if (categoryList.length === 0) {
      return (
        <View style={styles.emptyMenu}>
          <CustomText fontSize={14} color="#828585" style={{ textAlign: "center" }}>
            No items listed yet. Check back soon.
          </CustomText>
        </View>
      );
    }

    return sectionsToShow.map((cat) => {
      const items = getItemsForCategory(cat.name);
      if (!items.length) return null;
      const layout = cat.displayLayout === "row" ? "row" : "column";

      return (
        <View key={`${selectedCategory}-${cat.name}`} style={styles.section}>
          <CustomText fontFamily="Bold" fontSize={18} style={styles.categoryTitle}>
            {cat.name}
          </CustomText>
          {layout === "row" ? (
            <MenuItemsHorizontalRow
              items={items}
              accent={accent}
              isClosed={!!isClosed}
              onAdd={handleAdd}
            />
          ) : (
            <View style={styles.columnList}>
              {items.map((item) => (
                <MenuItemCard
                  key={item._id}
                  item={item}
                  accent={accent}
                  isClosed={!!isClosed}
                  layout="column"
                  onAdd={() => handleAdd(item)}
                />
              ))}
            </View>
          )}
        </View>
      );
    });
  };

  if (loading || !restaurant) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={accent} />
        <CustomText fontSize={14} color={DS.color.textMuted} style={{ marginTop: 12 }}>
          Loading {verticalConfig.storeLabel}…
        </CustomText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={heroLight ? "light" : "dark"} translucent />

      {/* White chrome (status bar + nav + sticky) once scrolled */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.headerBg,
          {
            height: navTop + stickyBlockH,
            opacity: headerBgOpacity,
          },
        ]}
      />

      {/* Nav: back · restaurant name (when scrolled) · logout + cart */}
      <View style={[styles.navOverlay, { paddingTop: insets.top, height: navTop }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <MaterialIcons name="arrow-back-ios" size={20} color="#111827" />
        </TouchableOpacity>

        <Animated.View
          style={[styles.navTitleSlot, { opacity: navTitleOpacity }]}
          pointerEvents="none"
        >
          <CustomText
            fontFamily="Bold"
            fontSize={16}
            numberOfLines={1}
            style={styles.navTitleText}
          >
            {restaurant.name}
          </CustomText>
        </Animated.View>

        <View style={styles.navRight}>
          <CustomerLogoutButton style={styles.navBtn} />
          <TouchableOpacity onPress={goToCart} style={styles.navBtn}>
            <Ionicons name="cart-outline" size={22} color="#111827" />
            {itemCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: accent }]}>
                <CustomText fontFamily="Bold" fontSize={10} style={{ color: "#fff" }}>
                  {itemCount}
                </CustomText>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      {/* Category row — only after hero image has fully collapsed */}
      {categoryList.length > 0 ? (
        <Animated.View
          pointerEvents={stickyInteractive ? "auto" : "none"}
          style={[
            styles.stickyTabs,
            {
              top: navTop,
              opacity: stickyReveal,
              height: stickySectionHeight,
            },
          ]}
        >
          <MenuCategoryTabs
            categories={categoryList}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            accent={accent}
            compact
          />
        </Animated.View>
      ) : null}

      <AnimatedGHScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 16) + (itemCount > 0 ? 72 : 0),
        }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        directionalLockEnabled
        bounces
      >
        {/* Full-bleed hero: image under status bar, details on image */}
        <Animated.View
          style={[
            styles.heroShell,
            { height: heroHeight, backgroundColor: heroBg },
          ]}
        >
          <Animated.View style={[styles.heroMedia, { opacity: heroImageOpacity }]}>
            {storeCover ? (
              <Image source={{ uri: storeCover }} style={styles.heroCover} resizeMode="cover" />
            ) : (
              <CustomText style={styles.heroEmoji}>{displayEmoji}</CustomText>
            )}
            <View style={styles.heroScrim} />
          </Animated.View>

          <Animated.View
            style={[styles.heroMetaOnImage, { opacity: heroMetaOpacity }]}
            pointerEvents="none"
          >
            <CustomText fontFamily="Bold" fontSize={26} style={styles.heroTitleOnImage} numberOfLines={2}>
              {restaurant.name}
            </CustomText>
            <CustomText fontSize={13} style={styles.heroSubtitleOnImage}>
              {restaurant.estimatedPrepMinutes ?? 25} min prep · Delivery by distance
            </CustomText>
            <CustomText fontSize={12} style={styles.heroDeliveryOnImage}>
              {resolvingLocation
                ? "Estimating delivery…"
                : locationError
                  ? "Enable location for delivery estimate"
                  : deliveryEstimate
                    ? `${deliveryEstimate.km.toFixed(1)} km · est. ${formatCurrency(deliveryEstimate.fee)}`
                    : "Set delivery location"}
            </CustomText>
            {(restaurant.cuisine || restaurant.category) && (
              <CustomText fontSize={12} style={styles.heroTaglineOnImage}>
                {[restaurant.category, restaurant.cuisine].filter(Boolean).join(" · ")}
              </CustomText>
            )}
          </Animated.View>
        </Animated.View>

        <Animated.View style={{ height: pinnedSpacer }} />

        <View style={styles.menuBody}>
          {isClosed ? (
            <View style={styles.closedBanner}>
              <Ionicons name="time-outline" size={18} color="#b45309" />
              <View style={{ flex: 1 }}>
                <CustomText fontFamily="SemiBold" fontSize={14} style={{ color: "#92400e" }}>
                  {restaurant.openLabel || "Closed"}
                </CustomText>
                <CustomText fontSize={12} style={{ color: "#b45309", marginTop: 2 }}>
                  {restaurant.openStatus === "closed"
                    ? `Browse the menu${
                        restaurant.todayHours ? ` · today ${restaurant.todayHours}` : ""
                      }, ordering opens when they do.`
                    : "Not accepting orders right now."}
                </CustomText>
              </View>
            </View>
          ) : null}

          {renderMenuSections()}
        </View>
      </AnimatedGHScrollView>

      {itemCount > 0 && cartRestaurantId === restaurant._id ? (
        <SafeAreaView edges={["bottom"]} style={styles.cartWrap} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.viewCartBar, { backgroundColor: accent }]}
            onPress={goToCart}
            activeOpacity={0.9}
          >
            <CustomText fontFamily="SemiBold" fontSize={15} style={{ color: "#fff" }}>
              View cart ({itemCount})
            </CustomText>
          </TouchableOpacity>
        </SafeAreaView>
      ) : null}

      <MenuItemCustomizeModal
        visible={!!customizeItem}
        item={customizeItem}
        accent={accent}
        onClose={() => setCustomizeItem(null)}
        onConfirm={({ modifiers, unitPrice }) => {
          if (!customizeItem) return;
          pushToCart(customizeItem, { price: unitPrice, modifiers });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  headerBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 42,
    backgroundColor: "#fff",
  },
  navOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  navTitleSlot: {
    flex: 1,
    marginHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
  },
  navTitleText: {
    color: "#111827",
    textAlign: "center",
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stickyTabs: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 45,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  scroll: {
    flex: 1,
  },
  heroShell: {
    width: "100%",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  heroMedia: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCover: {
    width: "100%",
    height: "100%",
  },
  heroEmoji: {
    position: "absolute",
    right: -4,
    top: 48,
    fontSize: 96,
    opacity: 0.88,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    // Stronger gradient at bottom so white text reads on the image
    borderBottomWidth: 0,
  },
  heroMetaOnImage: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 48,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  heroTitleOnImage: {
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroSubtitleOnImage: {
    marginTop: 6,
    color: "rgba(255,255,255,0.95)",
  },
  heroDeliveryOnImage: {
    marginTop: 4,
    color: "rgba(255,255,255,0.92)",
  },
  heroTaglineOnImage: {
    marginTop: 4,
    color: "rgba(255,255,255,0.88)",
  },
  menuBody: {
    backgroundColor: "#fff",
    minHeight: 200,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: -12,
    paddingTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  categoryTitle: {
    color: Colors.text,
    paddingTop: 12,
    paddingBottom: 10,
    lineHeight: 22,
  },
  columnList: {},
  emptyMenu: {
    margin: 16,
    padding: 24,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
  },
  closedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
  cartWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: 16,
  },
  viewCartBar: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default RestaurantMenu;
