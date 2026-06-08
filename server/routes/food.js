import express from "express";
import {
  listRestaurants,
  getRestaurantMenu,
  createFoodOrder,
  getFoodOrder,
  listMyFoodOrders,
  getActiveFoodOrder,
  rateFoodOrder,
  getFoodCheckoutSettings,
  getFoodDeliveryQuote,
  adminListFoodOrders,
  adminRestaurantOrderAction,
} from "../controllers/food.js";

const router = express.Router();

router.get("/restaurants", listRestaurants);
router.get("/restaurants/:id", getRestaurantMenu);
router.get("/checkout-settings", getFoodCheckoutSettings);
router.get("/delivery-quote", getFoodDeliveryQuote);
router.post("/orders", createFoodOrder);
router.get("/orders", listMyFoodOrders);
router.get("/orders/active", getActiveFoodOrder);
router.get("/orders/:id", getFoodOrder);
router.post("/orders/:id/rate", rateFoodOrder);

/** Restaurant console (admin token) */
router.get("/admin/orders", adminListFoodOrders);
router.patch("/admin/orders/:id", adminRestaurantOrderAction);

export default router;
