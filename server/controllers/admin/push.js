// Admin push notifications: templates and broadcasts.
import Settings from "../../models/Settings.js";
import { StatusCodes } from "http-status-codes";
import {
  catalogForAdminResponse,
  getPushTemplatesList,
  mergePushTemplates,
  normalizePushTemplateOverrides,
  invalidatePushTemplateCache,
  renderPushTemplateString,
  buildPushFromTemplate,
} from "../../utils/pushNotificationTemplates.js";
import { isFirebaseConfigured } from "../../utils/firebaseAdmin.js";
import PushBroadcast from "../../models/PushBroadcast.js";
import {
  BROADCAST_AUDIENCE_IDS,
  BROADCAST_AUDIENCES,
  getBroadcastAudienceStats,
  sendBroadcastPush,
} from "../../utils/pushBroadcast.js";

/** GET /admin/push-templates — catalog + current title/body/enabled */
export const getPushTemplatesAdmin = async (_req, res) => {
  try {
    const templates = await getPushTemplatesList();
    res.status(StatusCodes.OK).json({
      catalog: catalogForAdminResponse(),
      templates,
      firebaseConfigured: isFirebaseConfigured(),
    });
  } catch (error) {
    console.error("Get push templates error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to fetch push templates" });
  }
};

/** PATCH /admin/push-templates — update templates only */
export const updatePushTemplatesAdmin = async (req, res) => {
  try {
    const normalized = normalizePushTemplateOverrides(req.body?.templates ?? req.body);
    if (!normalized.ok) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: normalized.message });
    }

    let settings = await Settings.findOne({ key: "global" });
    if (!settings) {
      settings = await Settings.create({ key: "global" });
    }

    settings.pushNotificationTemplates = {
      ...(settings.pushNotificationTemplates || {}),
      ...normalized.value,
    };
    await settings.save();
    invalidatePushTemplateCache();

    const templates = mergePushTemplates(settings.pushNotificationTemplates);
    res.status(StatusCodes.OK).json({
      message: "Push templates updated",
      templates,
    });
  } catch (error) {
    console.error("Update push templates error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to update push templates" });
  }
};

/** POST /admin/push-templates/preview — render title/body with sample variables */
export const previewPushTemplateAdmin = async (req, res) => {
  try {
    const { key, title, body, variables } = req.body;
    if (!key || typeof key !== "string") {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "key is required" });
    }

    const vars =
      variables && typeof variables === "object" && !Array.isArray(variables)
        ? variables
        : {};

    if (typeof title === "string" && typeof body === "string") {
      return res.status(StatusCodes.OK).json({
        title: renderPushTemplateString(title, vars),
        body: renderPushTemplateString(body, vars),
      });
    }

    const payload = await buildPushFromTemplate(key, vars, { type: "preview" });
    if (!payload) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Template not found or disabled",
      });
    }
    res.status(StatusCodes.OK).json({
      title: payload.title,
      body: payload.body,
    });
  } catch (error) {
    console.error("Preview push template error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to preview template" });
  }
};

/** GET /admin/push-broadcast — audience reach + recent broadcasts */
export const getPushBroadcastAdmin = async (_req, res) => {
  try {
    const [audiences, recent] = await Promise.all([
      getBroadcastAudienceStats(),
      PushBroadcast.find()
        .sort({ createdAt: -1 })
        .limit(25)
        .populate("sentBy", "name username")
        .lean(),
    ]);

    res.status(StatusCodes.OK).json({
      firebaseConfigured: isFirebaseConfigured(),
      audiences,
      recent: recent.map((row) => ({
        _id: row._id,
        title: row.title,
        body: row.body,
        audience: row.audience,
        audienceLabel: BROADCAST_AUDIENCES[row.audience]?.label || row.audience,
        deepLink: row.deepLink,
        usersTargeted: row.usersTargeted,
        devicesTargeted: row.devicesTargeted,
        sentOk: row.sentOk,
        sentFailed: row.sentFailed,
        status: row.status,
        sentByName: row.sentBy?.name || row.sentBy?.username || "Admin",
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get push broadcast error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to load broadcast data" });
  }
};

/** POST /admin/push-broadcast — send message to all devices in audience */
export const sendPushBroadcastAdmin = async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const body = String(req.body?.body || "").trim();
    const audience = String(req.body?.audience || "app_users");
    const deepLink = req.body?.deepLink ? String(req.body.deepLink).trim() : null;

    if (!title) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Title is required" });
    }
    if (!body) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Message is required" });
    }
    if (title.length > 120) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Title must be 120 characters or less" });
    }
    if (body.length > 500) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Message must be 500 characters or less" });
    }
    if (!BROADCAST_AUDIENCE_IDS.includes(audience)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Invalid audience" });
    }
    if (!isFirebaseConfigured()) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Firebase is not configured on the server — pushes cannot be sent",
      });
    }

    const record = await PushBroadcast.create({
      title,
      body,
      audience,
      deepLink,
      sentBy: req.user.id,
      status: "sending",
    });

    try {
      const stats = await sendBroadcastPush({
        title,
        body,
        audience,
        deepLink,
        sentBy: req.user.id,
        broadcastId: record._id,
      });

      res.status(StatusCodes.OK).json({
        message: "Broadcast sent",
        broadcast: {
          _id: record._id,
          ...stats,
          audience,
          audienceLabel: BROADCAST_AUDIENCES[audience]?.label,
        },
      });
    } catch (sendErr) {
      await PushBroadcast.findByIdAndUpdate(record._id, {
        status: "failed",
        errorMessage: sendErr?.message || "Send failed",
      });
      throw sendErr;
    }
  } catch (error) {
    console.error("Send push broadcast error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: error?.message || "Failed to send broadcast",
    });
  }
};
