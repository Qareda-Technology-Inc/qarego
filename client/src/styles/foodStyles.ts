/** Shared food delivery module theme (Deliveroo-inspired layout, Qarego orange accent) */
export const FOOD_THEME = {
  orange: "#f97316",
  orangeDark: "#ea580c",
  orangeLight: "#fff7ed",
  orangeMuted: "#ffedd5",
  surface: "#ffffff",
  card: "#ffffff",
  text: "#2e3333",
  textMuted: "#585c5c",
  textLight: "#828585",
  /** Placeholder / hint text in search bars */
  searchHint: "#aeb4b4",
  border: "#e8ebeb",
  searchBg: "#f2f4f5",
  divider: "#e8ebeb",
  accentTeal: "#00ccbc",
} as const;

/** Shared copy for commerce home / stores search bars */
export const COMMERCE_SEARCH_HINT = "Food, restaurants, groceries, pharmacy…";

export const CAROUSEL_CARD_WIDTH = 268;

/** Cuisine → emoji for category circles */
export const CUISINE_EMOJI: Record<string, string> = {
  All: "🍽️",
  Ghanaian: "🍲",
  Italian: "🍕",
  "Fast food": "🥘",
};

export function cuisineEmoji(cuisine: string): string {
  return CUISINE_EMOJI[cuisine] ?? "🍴";
}

/** Placeholder hero backgrounds when using emoji instead of photos */
export const CUISINE_HERO_BG: Record<string, string> = {
  Ghanaian: "#fef3c7",
  Italian: "#fee2e2",
  "Fast food": "#ffedd5",
  Local: "#ecfdf5",
  Drinks: "#e0f2fe",
  default: "#f2f4f5",
};

export function cuisineHeroBg(cuisine?: string): string {
  if (!cuisine) return CUISINE_HERO_BG.default;
  return CUISINE_HERO_BG[cuisine] ?? CUISINE_HERO_BG.default;
}
