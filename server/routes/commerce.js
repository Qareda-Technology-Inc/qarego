import express from "express";
import {
  listRestaurants,
  getRestaurantMenu,
  getFoodCheckoutSettings,
  getFoodDeliveryQuote,
  createFoodOrder,
  getFoodOrder,
  listMyFoodOrders,
  getActiveFoodOrder,
  rateFoodOrder,
  adminListFoodOrders,
  adminRestaurantOrderAction,
} from "../controllers/food.js";

/**
 * Commerce route alias (phase 1 migration).
 * Keeps existing food controllers while exposing neutral API naming.
 */
const router = express.Router();

router.get("/stores", listRestaurants);
router.get("/stores/:id", getRestaurantMenu);
router.get("/checkout-settings", getFoodCheckoutSettings);
router.get("/delivery-quote", getFoodDeliveryQuote);
router.post("/orders", createFoodOrder);
router.get("/orders", listMyFoodOrders);
router.get("/orders/active", getActiveFoodOrder);
router.get("/orders/:id", getFoodOrder);
router.post("/orders/:id/rate", rateFoodOrder);

// Back-office order moderation alias
router.get("/admin/orders", adminListFoodOrders);
router.patch("/admin/orders/:id", adminRestaurantOrderAction);

export default router;
