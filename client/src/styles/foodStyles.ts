/** Shared food delivery module theme */
import { Dimensions } from "react-native";

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
  searchHint: "#aeb4b4",
  border: "#e8ebeb",
  searchBg: "#f2f4f5",
  divider: "#e8ebeb",
  accentTeal: "#00ccbc",
} as const;

export const COMMERCE_SEARCH_HINT = "Food, restaurants, groceries, pharmacy…";

const SCREEN_W = Dimensions.get("window").width;

/** 2-column store tiles — fixed sizes keep rows aligned */
export const GRID_H_PAD = 16;
export const GRID_CARD_GAP = 6;
export const GRID_CARD_WIDTH = Math.floor(
  (SCREEN_W - GRID_H_PAD * 2 - GRID_CARD_GAP) / 2
);
export const GRID_CARD_IMAGE_HEIGHT = 109;
export const GRID_CARD_BODY_HEIGHT = 45;
export const GRID_CARD_HEIGHT = GRID_CARD_IMAGE_HEIGHT + GRID_CARD_BODY_HEIGHT;

/** Horizontal carousel rows — wider than grid so two cards don't fill the screen */
export const CAROUSEL_LIST_PAD = 16;
export const CAROUSEL_CARD_GAP = 12;
const CAROUSEL_VIEW_W = SCREEN_W - CAROUSEL_LIST_PAD * 2;
export const CAROUSEL_CARD_WIDTH = Math.floor(CAROUSEL_VIEW_W * 0.62);
export const CAROUSEL_CARD_IMAGE_HEIGHT = Math.round(
  GRID_CARD_IMAGE_HEIGHT * (CAROUSEL_CARD_WIDTH / GRID_CARD_WIDTH)
);
export const CAROUSEL_CARD_HEIGHT = CAROUSEL_CARD_IMAGE_HEIGHT + GRID_CARD_BODY_HEIGHT;

/** Compact horizontal rows — Top picks, Quick delivery, New on QareGO */
export const QUICK_CAROUSEL_CARD_WIDTH = Math.floor(CAROUSEL_VIEW_W * 0.55);
export const QUICK_CAROUSEL_CARD_IMAGE_HEIGHT = Math.round(GRID_CARD_IMAGE_HEIGHT * 0.88);
export const QUICK_CAROUSEL_CARD_HEIGHT =
  QUICK_CAROUSEL_CARD_IMAGE_HEIGHT + GRID_CARD_BODY_HEIGHT;

/** Full-width store tile — image on top, text below (one per row) */
export const FULL_WIDTH_CARD_WIDTH = SCREEN_W - GRID_H_PAD * 2;
export const FULL_WIDTH_CARD_IMAGE_HEIGHT = Math.round(FULL_WIDTH_CARD_WIDTH * 0.42);
export const FULL_WIDTH_CARD_HEIGHT =
  FULL_WIDTH_CARD_IMAGE_HEIGHT + GRID_CARD_BODY_HEIGHT;

/** Store menu — Bolt-style horizontal row (~2 tiles + peek) */
export const MENU_ROW_H_PAD = 16;
export const MENU_ROW_CARD_GAP = 12;
export const MENU_ROW_CARD_WIDTH = Math.floor(
  (SCREEN_W - MENU_ROW_H_PAD * 2 - MENU_ROW_CARD_GAP) / 2.15
);
export const MENU_ROW_IMAGE_SIZE = MENU_ROW_CARD_WIDTH;
export const MENU_ROW_TEXT_HEIGHT = 52;

/** Column list — text left, landscape image right */
export const MENU_LIST_IMAGE_RATIO = 4 / 3;

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

/** Delivery ETA range e.g. 30–55 min */
export function formatPrepWindow(prepMinutes?: number): string {
  const base = Math.max(15, prepMinutes ?? 30);
  const high = base + 25;
  return `${base}–${high} min`;
}
