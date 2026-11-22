// Browsing without an account. Apple (guideline 5.1.1(v)) requires that people can look around
// (services, stores, menus, prices) before signing up; only account features like ordering may
// need a login. These read-only routes are mounted before the authenticated routers in app.js,
// so the same paths keep working for signed-in users. None of these handlers read req.user.
import express from "express";
import {
  listRestaurants,
  getRestaurantMenu,
  getLaundryPickupSlots,
  getFoodCheckoutSettings,
  getFoodDeliveryQuote,
} from "../controllers/food.js";
import { getGasOptions, getGasQuote } from "../controllers/gas.js";
import { getFareRates } from "../controllers/ride.js";
import { listParcelPoints } from "../controllers/parcelPoints.js";
import { checkServiceCoverage } from "../controllers/serviceZone.js";

const router = express.Router();

router.get("/food/restaurants", listRestaurants);
router.get("/food/restaurants/:id", getRestaurantMenu);
router.get("/food/restaurants/:id/laundry-pickup-slots", getLaundryPickupSlots);
router.get("/food/checkout-settings", getFoodCheckoutSettings);
router.get("/food/delivery-quote", getFoodDeliveryQuote);
router.get("/food/gas/options", getGasOptions);
router.get("/food/gas/quote", getGasQuote);
router.get("/commerce/stores", listRestaurants);
router.get("/commerce/stores/:id", getRestaurantMenu);
router.get("/commerce/checkout-settings", getFoodCheckoutSettings);
router.get("/commerce/delivery-quote", getFoodDeliveryQuote);
router.get("/ride/fare-rates", getFareRates);
router.get("/parcel-points", listParcelPoints);
router.post("/service-zones/check", express.json({ limit: "10kb" }), checkServiceCoverage);

export default router;
