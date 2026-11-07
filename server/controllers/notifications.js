import User from "../models/User.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../errors/index.js";
import {
  sendFcmToToken,
  sendExpoPushToToken,
  sendPushToUserTokens,
  isPushConfigured,
} from "../utils/pushNotifications.js";
import { isFirebaseConfigured } from "../utils/firebaseAdmin.js";
import { buildPushFromTemplate } from "../utils/pushNotificationTemplates.js";
import PushBroadcast from "../models/PushBroadcast.js";
import { audiencesForRole } from "../utils/pushBroadcast.js";

const VALID_PROVIDERS = ["fcm", "expo"];

/** POST /notifications/register-token */
export const registerPushToken = async (req, res) => {
  const { token, provider = "fcm", platform } = req.body;

  if (!token || typeof token !== "string") {
    throw new BadRequestError("token is required");
  }
  const prov = VALID_PROVIDERS.includes(provider) ? provider : "fcm";

  const user = await User.findById(req.user.id);
  if (!user) {
    throw new BadRequestError("User not found");
  }

  if (!user.pushTokens) user.pushTokens = [];

  const normalizedPlatform = platform || "unknown";
  const normalizedToken = String(token).trim();

  // Keep one active token per provider+platform and drop duplicates/stale entries.
  user.pushTokens = user.pushTokens.filter((t) => {
    if (!t?.token) return false;
    if (t.token === normalizedToken) return false; // dedupe exact token
    if (
      normalizedPlatform !== "unknown" &&
      t.platform === normalizedPlatform &&
      t.provider !== prov
    ) {
      // Token provider switched on this device/platform (e.g. iOS fcm -> expo).
      return false;
    }
    return true;
  });

  const entry = {
    token: normalizedToken,
    provider: prov,
    platform: normalizedPlatform,
    updatedAt: new Date(),
  };

  user.pushTokens.push(entry);

  // Keep last 5 tokens per user
  if (user.pushTokens.length > 5) {
    user.pushTokens = user.pushTokens
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);
  }

  await user.save();

  res.status(StatusCodes.OK).json({
    message: "Push token registered",
    pushEnabled: isPushConfigured(),
    firebaseConfigured: isFirebaseConfigured(),
  });
};

/** DELETE /notifications/register-token */
export const unregisterPushToken = async (req, res) => {
  const { token } = req.body;
  if (!token) {
    throw new BadRequestError("token is required");
  }

  await User.updateOne(
    { _id: req.user.id },
    { $pull: { pushTokens: { token } } }
  );

  res.status(StatusCodes.OK).json({ message: "Token removed" });
};

/** GET /notifications/status */
export const getPushStatus = async (_req, res) => {
  res.status(StatusCodes.OK).json({
    firebaseConfigured: isFirebaseConfigured(),
    provider: "fcm",
  });
};

/** POST /notifications/test — send test notification to self */
export const sendTestPush = async (req, res) => {
  const user = await User.findById(req.user.id).select("pushTokens");
  const tokens = user?.pushTokens || [];

  if (!tokens.length) {
    throw new BadRequestError("No push tokens registered for this account");
  }

  const payload =
    (await buildPushFromTemplate("test_push", {}, { type: "test" })) || {
      title: "QareGO",
      body: "Firebase push notifications are working.",
      data: { type: "test" },
    };

  const results = await sendPushToUserTokens(tokens, payload);
  const anyOk = results.some((r) => r.result?.ok);

  res.status(StatusCodes.OK).json({
    message: anyOk ? "Test sent" : "No device accepted the notification",
    results,
    firebaseConfigured: isFirebaseConfigured(),
  });
};

/** Admin messages stay in the app's list this long. */
const INBOX_DAYS = 60;

async function inboxQuery(userId, role) {
  const user = await User.findById(userId).select("createdAt inboxSeenAt").lean();
  const windowStart = new Date(Date.now() - INBOX_DAYS * 24 * 60 * 60 * 1000);
  // Unread counts from sign-up, so a new user doesn't start with a pile of old messages.
  const seenAt = user?.inboxSeenAt || user?.createdAt || windowStart;
  return {
    seenAt,
    filter: {
      audience: { $in: audiencesForRole(role) },
      status: { $ne: "failed" },
      createdAt: { $gte: windowStart },
    },
  };
}

/** GET /notifications/inbox — admin messages (with promo photos) for this user's role */
export const getInbox = async (req, res) => {
  const { seenAt, filter } = await inboxQuery(req.user.id, req.user.role);
  const rows = await PushBroadcast.find(filter)
    .sort({ createdAt: -1 })
    .limit(40)
    .select("title body imageUrl promo createdAt")
    .populate("promo.restaurant", "name vertical isActive")
    .populate("promo.menuItem", "name price isAvailable")
    .lean();

  const unread = rows.filter((row) => row.createdAt > seenAt).length;
  res.status(StatusCodes.OK).json({
    unread,
    messages: rows.map((row) => {
      const store = row.promo?.restaurant;
      const item = row.promo?.menuItem;
      return {
        _id: row._id,
        title: row.title,
        body: row.body,
        imageUrl: row.imageUrl || null,
        createdAt: row.createdAt,
        unread: row.createdAt > seenAt,
        // Only link to stores still in the app.
        promo: store?.isActive
          ? {
              restaurantId: store._id,
              restaurantName: store.name,
              vertical: store.vertical,
              menuItemId: item?._id || null,
              menuItemName: item?.name || null,
              price: item?.price ?? null,
            }
          : null,
      };
    }),
  });
};

/** GET /notifications/inbox/unread — just the badge count */
export const getInboxUnread = async (req, res) => {
  const { seenAt, filter } = await inboxQuery(req.user.id, req.user.role);
  const unread = await PushBroadcast.countDocuments({
    ...filter,
    createdAt: { ...filter.createdAt, $gt: seenAt },
  });
  res.status(StatusCodes.OK).json({ unread });
};

/** POST /notifications/inbox/seen — clears the unread badge */
export const markInboxSeen = async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $set: { inboxSeenAt: new Date() } });
  res.status(StatusCodes.OK).json({ unread: 0 });
};
