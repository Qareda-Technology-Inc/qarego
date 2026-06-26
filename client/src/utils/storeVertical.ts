import type { Restaurant } from "@/service/foodService";
import { cuisineHeroBg } from "@/styles/foodStyles";

export type StoreVertical = "FOOD" | "GROCERY" | "PHARMACY";

/** Store type filter on the Stores tab. ALL = every type. */
export type StoreTypeFilter = "ALL" | StoreVertical;

/** @deprecated use StoreTypeFilter */
export type RetailVerticalFilter = "ALL" | "GROCERY" | "PHARMACY";

export const RETAIL_VERTICALS: StoreVertical[] = ["GROCERY", "PHARMACY"];

export type StoreVerticalConfig = {
  /** Customer-facing module name */
  title: string;
  /** Label on Stores / Search type chips */
  filterLabel: string;
  allTitle: string;
  searchPlaceholder: string;
  subtitle: string;
  emptyDescription: string;
  discoverTitle: string;
  discoverSubtitle: string;
  quickTitle: string;
  newTitle: string;
  accent: string;
  accentDark: string;
  heroBg: string;
  defaultEmoji: string;
  storeLabel: string;
  menuSectionLabel: string;
};

export const STORE_VERTICAL_CONFIG: Record<StoreVertical, StoreVerticalConfig> = {
  FOOD: {
    title: "Food & Restaurants",
    filterLabel: "Food & Restaurants",
    allTitle: "Explore all stores",
    searchPlaceholder: "Search food and restaurants",
    subtitle: "Meals from restaurants near you",
    emptyDescription: "No restaurants are available yet. Check back shortly.",
    discoverTitle: "Top picks for you",
    discoverSubtitle: "Highest rated near you",
    quickTitle: "Quick delivery",
    newTitle: "New on QareGO",
    accent: "#f97316",
    accentDark: "#ea580c",
    heroBg: "#c2410c",
    defaultEmoji: "🍽️",
    storeLabel: "restaurant",
    menuSectionLabel: "Menu",
  },
  GROCERY: {
    title: "Groceries & Supermarket",
    filterLabel: "Groceries & Supermarket",
    allTitle: "Explore all supermarkets",
    searchPlaceholder: "Search groceries and supermarkets",
    subtitle: "Daily essentials delivered to your door",
    emptyDescription: "No grocery or supermarket stores are available yet in your area.",
    discoverTitle: "Popular supermarkets",
    discoverSubtitle: "Top rated stores near you",
    quickTitle: "Fast grocery delivery",
    newTitle: "New on QareGO",
    accent: "#0ea5e9",
    accentDark: "#0284c7",
    heroBg: "#0369a1",
    defaultEmoji: "🛒",
    storeLabel: "store",
    menuSectionLabel: "Products",
  },
  PHARMACY: {
    title: "Pharmacy",
    filterLabel: "Pharmacy",
    allTitle: "Explore all pharmacies",
    searchPlaceholder: "Search pharmacies and health products",
    subtitle: "Health products and medicine nearby",
    emptyDescription: "No pharmacies are available yet in your area.",
    discoverTitle: "Trusted pharmacies",
    discoverSubtitle: "Top rated pharmacies near you",
    quickTitle: "Fast pharmacy delivery",
    newTitle: "New on QareGO",
    accent: "#ef4444",
    accentDark: "#dc2626",
    heroBg: "#b91c1c",
    defaultEmoji: "💊",
    storeLabel: "pharmacy",
    menuSectionLabel: "Health products",
  },
};

/** Type chips for Stores / Search (horizontal row). */
export const STORE_TYPE_FILTERS: {
  key: StoreTypeFilter;
  label: string;
  accent: string;
}[] = [
  { key: "ALL", label: "All stores", accent: "#6366f1" },
  ...(["FOOD", "GROCERY", "PHARMACY"] as StoreVertical[]).map((key) => ({
    key,
    label: STORE_VERTICAL_CONFIG[key].filterLabel,
    accent: STORE_VERTICAL_CONFIG[key].accent,
  })),
];

export const normalizeStoreVertical = (value?: string | string[]): StoreVertical => {
  const raw = Array.isArray(value) ? value[0] : value;
  const upper = String(raw ?? "FOOD").toUpperCase();
  if (upper === "GROCERY" || upper === "PHARMACY" || upper === "FOOD") return upper;
  return "FOOD";
};

export const normalizeStoreTypeFilter = (value?: string | string[]): StoreTypeFilter => {
  const raw = Array.isArray(value) ? value[0] : value;
  const upper = String(raw ?? "ALL").toUpperCase();
  if (upper === "FOOD" || upper === "GROCERY" || upper === "PHARMACY") return upper;
  return "ALL";
};

/** @deprecated use normalizeStoreTypeFilter */
export const normalizeRetailVertical = (value?: string | string[]): RetailVerticalFilter => {
  const filter = normalizeStoreTypeFilter(value);
  if (filter === "FOOD") return "ALL";
  return filter;
};

/** Resolve vertical from explicit field or name/category heuristics. */
export const resolveStoreVertical = (restaurant: Restaurant): StoreVertical => {
  if (restaurant.vertical) return restaurant.vertical;
  const haystack = [restaurant.category, restaurant.cuisine, restaurant.name, restaurant.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/(pharmacy|pharma|drug|medicine|chemist)/i.test(haystack)) return "PHARMACY";
  if (/(grocery|grocer|mart|supermarket|provision|market)/i.test(haystack)) return "GROCERY";
  return "FOOD";
};

export const isRestaurantStore = (restaurant: Restaurant): boolean =>
  resolveStoreVertical(restaurant) === "FOOD";

export const isRetailStore = (restaurant: Restaurant): boolean =>
  RETAIL_VERTICALS.includes(resolveStoreVertical(restaurant));

export const matchesStoreTypeFilter = (
  restaurant: Restaurant,
  filter: StoreTypeFilter
): boolean => {
  if (filter === "ALL") return true;
  return resolveStoreVertical(restaurant) === filter;
};

/** @deprecated use matchesStoreTypeFilter */
export const matchesRetailFilter = (
  restaurant: Restaurant,
  filter: RetailVerticalFilter
): boolean => {
  if (!isRetailStore(restaurant)) return false;
  if (filter === "ALL") return true;
  return resolveStoreVertical(restaurant) === filter;
};

export const matchesStoreVertical = (restaurant: Restaurant, vertical: StoreVertical) => {
  const storeVertical = (restaurant as Restaurant & { vertical?: StoreVertical }).vertical;
  if (storeVertical) {
    if (vertical === "FOOD") return storeVertical === "FOOD";
    return storeVertical === vertical;
  }
  if (vertical === "FOOD") return true;
  const haystack = [restaurant.category, restaurant.cuisine, restaurant.name, restaurant.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (vertical === "GROCERY") {
    return /(grocery|grocer|mart|supermarket|provision|market)/i.test(haystack);
  }
  return /(pharmacy|pharma|drug|medicine|chemist)/i.test(haystack);
};

export const storeHeroBackground = (vertical: StoreVertical, cuisine?: string) => {
  if (vertical !== "FOOD") return STORE_VERTICAL_CONFIG[vertical].heroBg;
  return cuisineHeroBg(cuisine);
};
