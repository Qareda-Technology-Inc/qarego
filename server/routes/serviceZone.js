import express from "express";
import {
  adminListServiceZones,
  adminCreateServiceZone,
  adminGetServiceZone,
  adminUpdateServiceZone,
  adminDeleteServiceZone,
  checkServiceCoverage,
} from "../controllers/serviceZone.js";

const router = express.Router();

/** Authenticated customers/riders — coverage check for current location. */
router.post("/check", checkServiceCoverage);

export default router;

/** Mounted under /admin (already auth + requireAdmin). */
export function registerAdminServiceZoneRoutes(adminRouter) {
  adminRouter.get("/service-zones", adminListServiceZones);
  adminRouter.post("/service-zones", adminCreateServiceZone);
  adminRouter.get("/service-zones/:id", adminGetServiceZone);
  adminRouter.patch("/service-zones/:id", adminUpdateServiceZone);
  adminRouter.delete("/service-zones/:id", adminDeleteServiceZone);
}
