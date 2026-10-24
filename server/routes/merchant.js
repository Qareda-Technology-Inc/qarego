import express from "express";
import {
  loadMerchantContext,
  requireOwner,
  requireMerchantRole,
  requireOwnPassword,
} from "../middleware/merchantContext.js";
import {
  listMyRestaurants,
  createMyRestaurant,
  listMyCategories,
  createMyCategory,
  deleteMyCategory,
  getMyOverview,
  getMyFinance,
  getMyLedger,
  startStorePayment,
  getStorePaymentStatus,
  getMyRestaurant,
  updateMyRestaurant,
  submitMyStoreForReview,
  changeMyPassword,
  countMyLaundryOrder,
  setAcceptingOrders,
  getMyStats,
  listMyMenuCategories,
  createMyMenuCategory,
  updateMyMenuCategory,
  deleteMyMenuCategory,
  listMyMenu,
  createMyMenuItem,
  bulkUpdateMyMenuPrices,
  updateMyMenuItem,
  updateMyMenuItemModifiers,
  deleteMyMenuItem,
  getKitchenAlertSound,
  listMyOrders,
  listAssignableRiders,
  myOrderAction,
  listMyCooks,
  createCook,
  updateCook,
  deleteCook,
} from "../controllers/merchant.js";
import { merchantListStoreTypes } from "../controllers/commerceStoreType.js";

const router = express.Router();

// Choosing a password must work while every other route is blocked by requireOwnPassword.
router.post("/password", requireMerchantRole, changeMyPassword);
router.use(requireOwnPassword);

// Stores — no single active store needed
router.get("/restaurants", requireMerchantRole, listMyRestaurants);
router.post("/restaurants", requireOwner, createMyRestaurant);

// Platform store types (admin-defined: Food / Grocery / Pharmacy)
router.get("/store-types", requireOwner, merchantListStoreTypes);

// Store categories (vendor-defined, reused across their stores)
router.get("/categories", requireOwner, listMyCategories);
router.post("/categories", requireOwner, createMyCategory);
router.delete("/categories/:id", requireOwner, deleteMyCategory);

// Owner dashboard across all stores
router.get("/overview", requireOwner, getMyOverview);
router.get("/finance", requireOwner, getMyFinance);
router.get("/ledger", requireOwner, getMyLedger);
router.post("/balance/pay", requireOwner, startStorePayment);
router.get("/balance/pay/:reference", requireOwner, getStorePaymentStatus);

// Platform kitchen alert (configured by admin)
router.get("/kitchen-alert-sound", requireMerchantRole, getKitchenAlertSound);

// Everything below operates on the ACTIVE restaurant (x-restaurant-id header)
// Restaurant profile
router.get("/restaurant", loadMerchantContext, getMyRestaurant);
router.patch("/restaurant", loadMerchantContext, requireOwner, updateMyRestaurant);
router.post("/restaurant/submit-review", loadMerchantContext, requireOwner, submitMyStoreForReview);
// Pause/resume orders — owner OR cook
router.patch("/restaurant/accepting", loadMerchantContext, setAcceptingOrders);

// Kitchen summary
router.get("/stats", loadMerchantContext, getMyStats);

// Menu categories (per active store)
router.get("/menu-categories", loadMerchantContext, requireOwner, listMyMenuCategories);
router.post("/menu-categories", loadMerchantContext, requireOwner, createMyMenuCategory);
router.patch("/menu-categories/:id", loadMerchantContext, requireOwner, updateMyMenuCategory);
router.delete("/menu-categories/:id", loadMerchantContext, requireOwner, deleteMyMenuCategory);

// Menu
router.get("/menu", loadMerchantContext, listMyMenu);
router.post("/menu", loadMerchantContext, requireOwner, createMyMenuItem);
router.post("/menu/bulk-price", loadMerchantContext, requireOwner, bulkUpdateMyMenuPrices);
router.patch("/menu/:itemId", loadMerchantContext, updateMyMenuItem); // cooks: availability only
router.patch("/menu/:itemId/modifiers", loadMerchantContext, requireOwner, updateMyMenuItemModifiers);
router.delete("/menu/:itemId", loadMerchantContext, requireOwner, deleteMyMenuItem);

// Orders (kitchen queue)
router.get("/orders", loadMerchantContext, listMyOrders);
router.get("/riders", loadMerchantContext, listAssignableRiders);
router.patch("/orders/:id", loadMerchantContext, myOrderAction);
router.post("/orders/:id/laundry-count", loadMerchantContext, countMyLaundryOrder);

// Cooks (staff) — owner only
router.get("/cooks", loadMerchantContext, requireOwner, listMyCooks);
router.post("/cooks", loadMerchantContext, requireOwner, createCook);
router.patch("/cooks/:id", loadMerchantContext, requireOwner, updateCook);
router.delete("/cooks/:id", loadMerchantContext, requireOwner, deleteCook);

export default router;
