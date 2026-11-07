import express from "express";
import authMiddleware from "../middleware/authentication.js";
import {
  registerPushToken,
  unregisterPushToken,
  getPushStatus,
  sendTestPush,
  getInbox,
  getInboxUnread,
  markInboxSeen,
} from "../controllers/notifications.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/status", getPushStatus);
router.post("/register-token", registerPushToken);
router.delete("/register-token", unregisterPushToken);
router.post("/test", sendTestPush);
router.get("/inbox", getInbox);
router.get("/inbox/unread", getInboxUnread);
router.post("/inbox/seen", markInboxSeen);

export default router;
