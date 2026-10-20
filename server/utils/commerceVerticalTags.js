/**
 * Platform browse / assignment tags per commerce vertical.
 * Seeded into CommerceStoreType for merchant store creation.
 */

/** @typedef {{ name: string; emoji: string; vertical: 'FOOD'|'GROCERY'|'PHARMACY'|'GAS'|'LAUNDRY'; sortOrder: number; description?: string }} CommerceTag */

/** @type {CommerceTag[]} */
export const FOOD_RESTAURANT_TAGS = [
  { name: "Local Ghanaian", emoji: "🍲", vertical: "FOOD", sortOrder: 1, description: "Jollof, Waakye, Fufu, Banku" },
  { name: "Fast Food & Burgers", emoji: "🍔", vertical: "FOOD", sortOrder: 2, description: "Quick-service meals, fries, burgers" },
  { name: "Pastry & Bakery", emoji: "🥐", vertical: "FOOD", sortOrder: 3, description: "Meat pies, cakes, bread, donuts" },
  { name: "Continental", emoji: "🍝", vertical: "FOOD", sortOrder: 4, description: "Pasta, steaks, salads" },
  { name: "Asian & Chinese", emoji: "🥡", vertical: "FOOD", sortOrder: 5, description: "Noodles, fried rice, sushi, spring rolls" },
  { name: "Shawarma & Grills", emoji: "🌯", vertical: "FOOD", sortOrder: 6, description: "Wraps, kebab, grilled chicken, pork" },
  { name: "Pizza", emoji: "🍕", vertical: "FOOD", sortOrder: 7, description: "Pizzerias" },
  { name: "Desserts & Ice Cream", emoji: "🍦", vertical: "FOOD", sortOrder: 8, description: "Sweet treats, waffles, ice cream" },
  { name: "Healthy & Vegan", emoji: "🥗", vertical: "FOOD", sortOrder: 9, description: "Salads, smoothies, plant-based" },
];

/** @type {CommerceTag[]} */
export const GROCERY_SUPERMARKET_TAGS = [
  { name: "Fresh Produce", emoji: "🥬", vertical: "GROCERY", sortOrder: 1, description: "Fruits, vegetables, fresh herbs" },
  { name: "Butchery & Meat", emoji: "🥩", vertical: "GROCERY", sortOrder: 2, description: "Chicken, beef, pork, goat" },
  { name: "Fish & Seafood", emoji: "🐟", vertical: "GROCERY", sortOrder: 3, description: "Tilapia, salmon, shrimp, crabs" },
  { name: "Dairy & Eggs", emoji: "🥛", vertical: "GROCERY", sortOrder: 4, description: "Milk, cheese, butter, yogurt, eggs" },
  { name: "Pantry Staples", emoji: "🫘", vertical: "GROCERY", sortOrder: 5, description: "Rice, oil, pasta, flour, canned goods, spices" },
  { name: "Snacks & Beverages", emoji: "🥤", vertical: "GROCERY", sortOrder: 6, description: "Chips, cookies, sodas, juices, water" },
  { name: "Bakery & Breakfast", emoji: "🍞", vertical: "GROCERY", sortOrder: 7, description: "Bread, cereal, oats, spreads" },
  { name: "Toiletries & Personal Care", emoji: "🧴", vertical: "GROCERY", sortOrder: 8, description: "Soap, tissue, toothpaste, deodorants" },
  { name: "Household Cleaning", emoji: "🧹", vertical: "GROCERY", sortOrder: 9, description: "Detergents, disinfectants, garbage bags" },
];

/** @type {CommerceTag[]} */
export const PHARMACY_HEALTH_TAGS = [
  { name: "Over-the-Counter (OTC)", emoji: "💊", vertical: "PHARMACY", sortOrder: 1, description: "Painkillers, cough syrups, cold medicines" },
  { name: "Prescription Only (POM)", emoji: "📋", vertical: "PHARMACY", sortOrder: 2, description: "Antibiotics, BP or diabetes meds — prescription required" },
  { name: "Vitamins & Supplements", emoji: "💪", vertical: "PHARMACY", sortOrder: 3, description: "Cod liver oil, Vitamin C, zinc, protein" },
  { name: "Baby & Mother Care", emoji: "👶", vertical: "PHARMACY", sortOrder: 4, description: "Diapers, formula, wipes, pregnancy vitamins" },
  { name: "Personal Care & Hygiene", emoji: "🧼", vertical: "PHARMACY", sortOrder: 5, description: "Sanitary pads, condoms, skincare, lotions" },
  { name: "First Aid & Medical Devices", emoji: "🩹", vertical: "PHARMACY", sortOrder: 6, description: "Bandages, antiseptics, thermometers, BP monitors" },
  { name: "Sexual Wellness", emoji: "❤️", vertical: "PHARMACY", sortOrder: 7, description: "Lubricants, supplements, family planning" },
];

/** @type {CommerceTag[]} */
export const GAS_STATION_TAGS = [
  { name: "LPG Refill", emoji: "🔥", vertical: "GAS", sortOrder: 1, description: "Refill the customer's empty cylinder" },
  { name: "Cylinder Exchange", emoji: "🔄", vertical: "GAS", sortOrder: 2, description: "Swap an empty cylinder for a full one" },
];

/** @type {CommerceTag[]} */
export const LAUNDRY_TAGS = [
  { name: "Wash & Fold", emoji: "🧺", vertical: "LAUNDRY", sortOrder: 1, description: "Everyday clothes washed, dried and folded" },
  { name: "Wash & Iron", emoji: "👔", vertical: "LAUNDRY", sortOrder: 2, description: "Washed and pressed: shirts, trousers, uniforms" },
  { name: "Dry Cleaning", emoji: "🧥", vertical: "LAUNDRY", sortOrder: 3, description: "Suits, kaba and slit, delicate fabrics" },
  { name: "Ironing Only", emoji: "♨️", vertical: "LAUNDRY", sortOrder: 4, description: "Clean clothes pressed and folded" },
  { name: "Bedding & Curtains", emoji: "🛏️", vertical: "LAUNDRY", sortOrder: 5, description: "Duvets, bedsheets, curtains, towels" },
];

export const ALL_COMMERCE_VERTICAL_TAGS = [
  ...FOOD_RESTAURANT_TAGS,
  ...GROCERY_SUPERMARKET_TAGS,
  ...PHARMACY_HEALTH_TAGS,
  ...GAS_STATION_TAGS,
  ...LAUNDRY_TAGS,
];
