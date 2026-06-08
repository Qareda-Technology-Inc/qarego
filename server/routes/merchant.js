import express from "express";
import {
  loadMerchantContext,
  requireOwner,
  requireMerchantRole,
} from "../middleware/merchantContext.js";
import {
  listMyRestaurants,
  createMyRestaurant,
  listMyCategories,
  createMyCategory,
  deleteMyCategory,
  getMyOverview,
  getMyRestaurant,
  updateMyRestaurant,
  setAcceptingOrders,
  getMyStats,
  listMyMenuCategories,
  createMyMenuCategory,
  updateMyMenuCategory,
  deleteMyMenuCategory,
  listMyMenu,
  createMyMenuItem,
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

// Platform kitchen alert (configured by admin)
router.get("/kitchen-alert-sound", requireMerchantRole, getKitchenAlertSound);

// Everything below operates on the ACTIVE restaurant (x-restaurant-id header)
// Restaurant profile
router.get("/restaurant", loadMerchantContext, getMyRestaurant);
router.patch("/restaurant", loadMerchantContext, requireOwner, updateMyRestaurant);
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
router.patch("/menu/:itemId", loadMerchantContext, updateMyMenuItem); // cooks: availability only
router.patch("/menu/:itemId/modifiers", loadMerchantContext, requireOwner, updateMyMenuItemModifiers);
router.delete("/menu/:itemId", loadMerchantContext, requireOwner, deleteMyMenuItem);

// Orders (kitchen queue)
router.get("/orders", loadMerchantContext, listMyOrders);
router.get("/riders", loadMerchantContext, listAssignableRiders);
router.patch("/orders/:id", loadMerchantContext, myOrderAction);

// Cooks (staff) — owner only
router.get("/cooks", loadMerchantContext, requireOwner, listMyCooks);
router.post("/cooks", loadMerchantContext, requireOwner, createCook);
router.patch("/cooks/:id", loadMerchantContext, requireOwner, updateCook);
router.delete("/cooks/:id", loadMerchantContext, requireOwner, deleteCook);

export default router;
