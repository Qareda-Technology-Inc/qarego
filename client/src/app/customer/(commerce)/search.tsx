import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { fetchRestaurants, Restaurant } from "@/service/foodService";
import RestaurantCard from "@/components/customer/food/RestaurantCard";
import StoreTypeFilterRow, {
  STORE_TYPE_FILTERS,
} from "@/components/customer/food/StoreTypeFilterRow";
import { COMMERCE_SEARCH_HINT, FOOD_THEME, GRID_H_PAD } from "@/styles/foodStyles";
import { DS } from "@/theme/designSystem";
import {
  STORE_VERTICAL_CONFIG,
  StoreTypeFilter,
  StoreVertical,
  matchesStoreTypeFilter,
  normalizeStoreTypeFilter,
  resolveStoreVertical,
} from "@/utils/storeVertical";
import {
  COMMERCE_VERTICAL_TAGS,
  getStoreTags,
  storeBrowseTag,
  storeMatchesSearchQuery,
} from "@/utils/commerceVerticalTags";
import EmptyStateCard from "@/components/shared/EmptyStateCard";

const CustomerSearch = () => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const inputRef = useRef<TextInput>(null);
  const params = useLocalSearchParams<{ type?: string; q?: string }>();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<StoreTypeFilter>("ALL");

  const accent =
    typeFilter === "ALL"
      ? STORE_TYPE_FILTERS[0].accent
      : STORE_VERTICAL_CONFIG[typeFilter as StoreVertical].accent;

  const load = useCallback(async () => {
    try {
      const data = await fetchRestaurants();
      setRestaurants(data);
    } catch {
      setRestaurants([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setTypeFilter(normalizeStoreTypeFilter(params.type));
  }, [params.type]);

  useEffect(() => {
    const initial = Array.isArray(params.q) ? params.q[0] : params.q;
    if (initial?.trim()) setQuery(initial.trim());
  }, [params.q]);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }, [])
  );

  const typeStores = useMemo(
    () => restaurants.filter((r) => matchesStoreTypeFilter(r, typeFilter)),
    [restaurants, typeFilter]
  );

  const catalogTags = useMemo(() => {
    if (typeFilter === "ALL") {
      return [
        ...COMMERCE_VERTICAL_TAGS.FOOD,
        ...COMMERCE_VERTICAL_TAGS.GROCERY,
        ...COMMERCE_VERTICAL_TAGS.PHARMACY,
      ].map((t) => t.name);
    }
    return COMMERCE_VERTICAL_TAGS[typeFilter].map((t) => t.name);
  }, [typeFilter]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const store of typeStores) {
      const name = storeBrowseTag(store);
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    for (const name of catalogTags) {
      if (!counts.has(name)) counts.set(name, 0);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [typeStores, catalogTags]);

  const popularSearches = useMemo(() => {
    const withStores = categoryCounts.filter(([, count]) => count > 0).map(([name]) => name);
    if (withStores.length >= 6) return withStores.slice(0, 6);
    const fill = catalogTags.filter((name) => !withStores.includes(name));
    return [...withStores, ...fill].slice(0, 6);
  }, [categoryCounts, catalogTags]);

  const recommendedCategories = useMemo(() => {
    const popularSet = new Set(popularSearches);
    return catalogTags.filter((name) => !popularSet.has(name));
  }, [catalogTags, popularSearches]);

  const isSearching = query.trim().length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return typeStores.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        storeMatchesSearchQuery(r, q) ||
        getStoreTags(r).some((t) => t.toLowerCase().includes(q)) ||
        (r.description?.toLowerCase().includes(q) ?? false)
    );
  }, [typeStores, query]);

  const applyTypeFilter = (type: StoreTypeFilter) => {
    setTypeFilter(type);
    setQuery("");
    router.replace({
      pathname: "/customer/search",
      params: type === "ALL" ? {} : { type },
    });
  };

  const applySearchTerm = (term: string) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/customer/hub");
  };

  const openStore = (item: Restaurant) => {
    router.push({
      pathname: "/customer/stores/[id]",
      params: { id: item._id, vertical: resolveStoreVertical(item) },
    });
  };

  const TextList = ({ items, onPress }: { items: string[]; onPress: (item: string) => void }) => (
    <View style={styles.textList}>
      {items.map((item) => (
        <TouchableOpacity key={item} style={styles.textListItem} onPress={() => onPress(item)}>
          <Text style={styles.listItemText}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const DiscoveryContent = () => (
    <ScrollView
      contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {popularSearches.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular</Text>
          <TextList items={popularSearches} onPress={applySearchTerm} />
        </View>
      ) : null}

      {recommendedCategories.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TextList items={recommendedCategories} onPress={applySearchTerm} />
        </View>
      ) : null}

      {popularSearches.length === 0 && recommendedCategories.length === 0 ? (
        <View style={styles.empty}>
          <EmptyStateCard
            icon="🔍"
            title="Start searching"
            description="Type a store name or category to find restaurants, groceries and pharmacies."
          />
        </View>
      ) : null}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.headerBlock, { paddingTop: insets.top + 8 }]}>
        <View style={styles.searchRow}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={FOOD_THEME.text} />
          </TouchableOpacity>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={FOOD_THEME.text} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder={COMMERCE_SEARCH_HINT}
              placeholderTextColor={FOOD_THEME.searchHint}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#cbd5e1" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <StoreTypeFilterRow
          value={typeFilter}
          onChange={applyTypeFilter}
          style={styles.typeFilterScroll}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : !isSearching ? (
        <DiscoveryContent />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{
            paddingBottom: tabBarHeight + 16,
            paddingHorizontal: GRID_H_PAD,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={accent}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.resultCardWrap}>
              <RestaurantCard
                restaurant={item}
                variant="fullWidth"
                onPress={() => openStore(item)}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyStateCard
                icon="🔍"
                title="No matches"
                description="Try a different name or switch the store type."
              />
              <TouchableOpacity style={styles.resetBtn} onPress={() => setQuery("")}>
                <Text style={[styles.clearText, { color: accent }]}>Clear search</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.color.bg,
  },
  headerBlock: {
    backgroundColor: FOOD_THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: FOOD_THEME.divider,
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: FOOD_THEME.searchBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: FOOD_THEME.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: FOOD_THEME.text,
  },
  typeFilterScroll: {
    marginTop: 12,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: FOOD_THEME.text,
    marginBottom: 6,
  },
  textList: {
    marginTop: 0,
  },
  textListItem: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FOOD_THEME.divider,
  },
  listItemText: {
    fontSize: 13,
    color: FOOD_THEME.searchHint,
    fontWeight: "400",
  },
  resultCount: {
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 12,
    color: FOOD_THEME.textLight,
  },
  clearText: {
    fontSize: 13,
    fontWeight: "500",
  },
  resultCardWrap: {
    marginBottom: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    paddingTop: 48,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  resetBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
});

export default CustomerSearch;
