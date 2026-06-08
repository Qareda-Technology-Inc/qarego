import Restaurant from "../models/Restaurant.js";

/** Update running average when a customer rates a restaurant. */
export async function applyRestaurantRating(restaurantId, rating) {
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) return null;

  const count = Number(restaurant.ratingCount) || 0;
  const current = Number(restaurant.rating) || 0;
  const actualTotal = count === 0 ? 0 : current * count;
  const nextCount = count + 1;
  restaurant.rating = Math.round(((actualTotal + rating) / nextCount) * 10) / 10;
  restaurant.ratingCount = nextCount;
  await restaurant.save();
  return restaurant;
}
