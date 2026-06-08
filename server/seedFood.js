import Restaurant from "./models/Restaurant.js";
import MenuItem from "./models/MenuItem.js";
import FoodOrder from "./models/FoodOrder.js";

/** Legacy demo restaurants inserted by an older auto-seed (no vendor owner). */
const DEMO_RESTAURANT_NAMES = [
  "Mama's Kitchen",
  "Pizza Hub Accra",
  "Chop Bar Express",
];

/**
 * Remove boilerplate demo restaurants so the customer app only shows
 * real stores created via admin / merchant portal.
 */
export async function clearDemoFoodSeed() {
  const demo = await Restaurant.find({
    name: { $in: DEMO_RESTAURANT_NAMES },
    $or: [{ owner: null }, { owner: { $exists: false } }],
  })
    .select("_id name")
    .lean();

  if (demo.length === 0) {
    console.log("Food: no demo seed restaurants to remove");
    return;
  }

  const ids = demo.map((r) => r._id);
  await MenuItem.deleteMany({ restaurant: { $in: ids } });
  await FoodOrder.deleteMany({ restaurant: { $in: ids } });
  const result = await Restaurant.deleteMany({ _id: { $in: ids } });
  console.log(
    `Food: removed ${result.deletedCount} demo restaurant(s): ${demo.map((r) => r.name).join(", ")}`
  );
}

/**
 * Optional dev-only seed — disabled by default. Set SEED_DEMO_FOOD=true to run once.
 */
export async function seedFoodIfEmpty() {
  if (process.env.SEED_DEMO_FOOD !== "true") return;

  const count = await Restaurant.countDocuments();
  if (count > 0) return;

  const spots = [
    {
      name: "Mama's Kitchen",
      description: "Local Ghanaian dishes — jollof, banku, grilled tilapia",
      cuisine: "Ghanaian",
      imageEmoji: "🍲",
      rating: 4.7,
      deliveryFee: 0,
      minOrderAmount: 25,
      estimatedPrepMinutes: 30,
      address: "Osu, Oxford Street, Accra",
      latitude: 5.5573,
      longitude: -0.1816,
      menu: [
        { name: "Jollof Rice & Chicken", description: "Spicy party jollof with grilled chicken", price: 45, category: "Mains" },
        { name: "Banku & Tilapia", description: "Fresh tilapia with pepper sauce", price: 55, category: "Mains" },
        { name: "Red Red", description: "Beans stew with plantain & gari", price: 28, category: "Mains" },
        { name: "Sobolo", description: "Chilled hibiscus drink", price: 8, category: "Drinks" },
      ],
    },
  ];

  for (const spot of spots) {
    const { menu, ...rest } = spot;
    const restaurant = await Restaurant.create(rest);
    await MenuItem.insertMany(
      menu.map((item) => ({
        ...item,
        restaurant: restaurant._id,
        isAvailable: true,
      }))
    );
  }

  console.log("Food delivery seed: demo restaurants created (SEED_DEMO_FOOD=true)");
}
