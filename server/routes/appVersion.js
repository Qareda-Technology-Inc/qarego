import express from "express";
import { StatusCodes } from "http-status-codes";
import { getSettings } from "../utils/tripSettlement.js";
import { APP_PLATFORMS, getAppVersionConfig, updateStatus } from "../utils/appVersions.js";

const router = express.Router();

/**
 * GET /app/version?platform=android&build=36 — public (the app checks before sign-in).
 * Tells the app whether to ask for an update, and where the store page is.
 */
router.get("/version", async (req, res) => {
  const platform = String(req.query.platform || "").toLowerCase();
  if (!APP_PLATFORMS.includes(platform)) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: "platform must be android or ios" });
  }
  const config = getAppVersionConfig(await getSettings());
  const p = config[platform];
  res.status(StatusCodes.OK).json({
    ...p,
    message: config.message || null,
    status: updateStatus(p, req.query.build),
  });
});

export default router;
