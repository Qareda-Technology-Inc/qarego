import express from "express";
import {
  listParcelPoints,
  adminListParcelPoints,
  adminCreateParcelPoint,
  adminUpdateParcelPoint,
  adminDeleteParcelPoint,
} from "../controllers/parcelPoints.js";

const router = express.Router();

/** Signed-in customers: points to choose from when booking a parcel. */
router.get("/", listParcelPoints);

export default router;

/** Mounted under /admin (already auth + requireAdmin). */
export function registerAdminParcelPointRoutes(adminRouter) {
  adminRouter.get("/parcel-points", adminListParcelPoints);
  adminRouter.post("/parcel-points", adminCreateParcelPoint);
  adminRouter.patch("/parcel-points/:id", adminUpdateParcelPoint);
  adminRouter.delete("/parcel-points/:id", adminDeleteParcelPoint);
}
