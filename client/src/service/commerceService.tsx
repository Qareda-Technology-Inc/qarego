/**
 * Commerce service alias (phase 1 migration).
 * Keeps compatibility by re-exporting current food service API.
 * New code should prefer importing from this file.
 */

export {
  fetchRestaurants as fetchStores,
  fetchRestaurantMenu as fetchStoreMenu,
  fetchFoodCheckoutSettings as fetchCommerceCheckoutSettings,
  createFoodOrder as createCommerceOrder,
  fetchFoodOrder as fetchCommerceOrder,
  fetchActiveFoodOrder as fetchActiveCommerceOrder,
} from "./foodService";

export type {
  Restaurant as Store,
  MenuItem as StoreItem,
  FoodOrder as CommerceOrder,
  FoodCheckoutSettings as CommerceCheckoutSettings,
} from "./foodService";
