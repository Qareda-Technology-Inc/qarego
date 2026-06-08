import type { StoreVertical, StoreTypeFilter } from "@/utils/storeVertical";

export type VerticalTag = {
  name: string;
  emoji: string;
  description?: string;
};

export const FOOD_RESTAURANT_TAGS: VerticalTag[] = [
  { name: "Local Ghanaian", emoji: "🍲", description: "Jollof, Waakye, Fufu, Banku" },
  { name: "Fast Food & Burgers", emoji: "🍔", description: "Quick-service meals, fries, burgers" },
  { name: "Pastry & Bakery", emoji: "🥐", description: "Meat pies, cakes, bread, donuts" },
  { name: "Continental", emoji: "🍝", description: "Pasta, steaks, salads" },
  { name: "Asian & Chinese", emoji: "🥡", description: "Noodles, fried rice, sushi, spring rolls" },
  { name: "Shawarma & Grills", emoji: "🌯", description: "Wraps, kebab, grilled chicken, pork" },
  { name: "Pizza", emoji: "🍕", description: "Pizzerias" },
  { name: "Desserts & Ice Cream", emoji: "🍦", description: "Sweet treats, waffles, ice cream" },
  { name: "Healthy & Vegan", emoji: "🥗", description: "Salads, smoothies, plant-based" },
];

export const GROCERY_SUPERMARKET_TAGS: VerticalTag[] = [
  { name: "Fresh Produce", emoji: "🥬", description: "Fruits, vegetables, fresh herbs" },
  { name: "Butchery & Meat", emoji: "🥩", description: "Chicken, beef, pork, goat" },
  { name: "Fish & Seafood", emoji: "🐟", description: "Tilapia, salmon, shrimp, crabs" },
  { name: "Dairy & Eggs", emoji: "🥛", description: "Milk, cheese, butter, yogurt, eggs" },
  { name: "Pantry Staples", emoji: "🫘", description: "Rice, oil, pasta, flour, canned goods, spices" },
  { name: "Snacks & Beverages", emoji: "🥤", description: "Chips, cookies, sodas, juices, water" },
  { name: "Bakery & Breakfast", emoji: "🍞", description: "Bread, cereal, oats, spreads" },
  { name: "Toiletries & Personal Care", emoji: "🧴", description: "Soap, tissue, toothpaste, deodorants" },
  { name: "Household Cleaning", emoji: "🧹", description: "Detergents, disinfectants, garbage bags" },
];

export const PHARMACY_HEALTH_TAGS: VerticalTag[] = [
  { name: "Over-the-Counter (OTC)", emoji: "💊", description: "Painkillers, cough syrups, cold medicines" },
  { name: "Prescription Only (POM)", emoji: "📋", description: "Antibiotics, BP or diabetes meds" },
  { name: "Vitamins & Supplements", emoji: "💪", description: "Vitamins, zinc, protein powders" },
  { name: "Baby & Mother Care", emoji: "👶", description: "Diapers, formula, wipes" },
  { name: "Personal Care & Hygiene", emoji: "🧼", description: "Sanitary pads, condoms, skincare" },
  { name: "First Aid & Medical Devices", emoji: "🩹", description: "Bandages, thermometers, BP monitors" },
  { name: "Sexual Wellness", emoji: "❤️", description: "Lubricants, family planning" },
];

export const COMMERCE_VERTICAL_TAGS: Record<StoreVertical, VerticalTag[]> = {
  FOOD: FOOD_RESTAURANT_TAGS,
  GROCERY: GROCERY_SUPERMARKET_TAGS,
  PHARMACY: PHARMACY_HEALTH_TAGS,
};

const emojiByName = new Map<string, string>();
for (const tags of Object.values(COMMERCE_VERTICAL_TAGS)) {
  for (const tag of tags) {
    emojiByName.set(tag.name, tag.emoji);
  }
}

export type StoreTagSource = {
  tags?: string[];
  category?: string;
  cuisine?: string;
};

/** All browse tags on a store (multi-tag + legacy single fields). */
export const getStoreTags = (store: StoreTagSource): string[] => {
  const fromArray = (store.tags ?? []).map((t) => t.trim()).filter(Boolean);
  if (fromArray.length) return [...new Set(fromArray)];
  const legacy = [store.category, store.cuisine]
    .map((t) => t?.trim())
    .filter((t): t is string => Boolean(t));
  return [...new Set(legacy)];
};

/** Primary tag for compact display */
export const storeBrowseTag = (store: StoreTagSource): string => getStoreTags(store)[0] ?? "";

export const storeMatchesBrowseTag = (store: StoreTagSource, tag: string): boolean =>
  getStoreTags(store).includes(tag);

export const storeMatchesSearchQuery = (store: StoreTagSource, q: string): boolean => {
  const lower = q.toLowerCase();
  return getStoreTags(store).some((t) => t.toLowerCase().includes(lower));
};

export const verticalTagEmoji = (name: string, vertical: StoreVertical): string => {
  if (name === "All") {
    return vertical === "FOOD" ? "🍽️" : vertical === "GROCERY" ? "🛒" : "💊";
  }
  return emojiByName.get(name) ?? COMMERCE_VERTICAL_TAGS[vertical][0]?.emoji ?? "🏷️";
};

/** Filter chips for cuisine / department / medical category carousels. */
export const browseFilterTags = (typeFilter: StoreTypeFilter): string[] => {
  if (typeFilter === "ALL") {
    return [
      "All",
      ...FOOD_RESTAURANT_TAGS.map((t) => t.name),
      ...GROCERY_SUPERMARKET_TAGS.map((t) => t.name),
      ...PHARMACY_HEALTH_TAGS.map((t) => t.name),
    ];
  }
  return ["All", ...COMMERCE_VERTICAL_TAGS[typeFilter].map((t) => t.name)];
};
