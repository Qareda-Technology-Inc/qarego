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

  const existing = user.pushTokens.findIndex(
    (t) => t.token === token || (t.provider === prov && t.platform === platform)
  );

  const entry = {
    token,
    provider: prov,
    platform: platform || "unknown",
    updatedAt: new Date(),
  };

  if (existing >= 0) {
    user.pushTokens[existing] = entry;
  } else {
    user.pushTokens.push(entry);
  }

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
