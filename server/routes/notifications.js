import express from "express";
import authMiddleware from "../middleware/authentication.js";
import {
  registerPushToken,
  unregisterPushToken,
  getPushStatus,
  sendTestPush,
} from "../controllers/notifications.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/status", getPushStatus);
router.post("/register-token", registerPushToken);
router.delete("/register-token", unregisterPushToken);
router.post("/test", sendTestPush);

export default router;
