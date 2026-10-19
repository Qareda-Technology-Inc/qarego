import express from "express";
import { getGasOptions, getGasQuote, createGasOrder } from "../controllers/gas.js";
import {
  listRestaurants,
  getRestaurantMenu,
  createFoodOrder,
  getFoodOrder,
  listMyFoodOrders,
  getActiveFoodOrder,
  rateFoodOrder,
  cancelMyFoodOrder,
  getFoodCheckoutSettings,
  getFoodDeliveryQuote,
  adminListFoodOrders,
  adminGetFoodOrder,
  adminListAssignableRiders,
  adminRestaurantOrderAction,
} from "../controllers/food.js";
import {
  getFoodOrderPaymentStatus,
  initiateFoodOrderPayment,
} from "../controllers/payment.js";

const router = express.Router();

router.get("/restaurants", listRestaurants);
router.get("/restaurants/:id", getRestaurantMenu);
router.get("/checkout-settings", getFoodCheckoutSettings);
router.get("/delivery-quote", getFoodDeliveryQuote);
router.post("/orders", createFoodOrder);
router.get("/gas/options", getGasOptions);
router.get("/gas/quote", getGasQuote);
router.post("/gas/orders", createGasOrder);
router.post("/orders/:id/payment/initiate", initiateFoodOrderPayment);
router.get("/orders/:id/payment-status", getFoodOrderPaymentStatus);
router.get("/orders", listMyFoodOrders);
router.get("/orders/active", getActiveFoodOrder);
router.get("/orders/:id", getFoodOrder);
router.post("/orders/:id/rate", rateFoodOrder);
router.post("/orders/:id/cancel", cancelMyFoodOrder);

/** Restaurant console (admin token) */
router.get("/admin/orders", adminListFoodOrders);
router.get("/admin/orders/:id", adminGetFoodOrder);
router.get("/admin/riders", adminListAssignableRiders);
router.patch("/admin/orders/:id", adminRestaurantOrderAction);

export default router;
