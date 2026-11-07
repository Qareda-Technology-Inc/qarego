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
import MenuItem from "../../models/MenuItem.js";
import Restaurant from "../../models/Restaurant.js";
import {
  BROADCAST_AUDIENCE_IDS,
  BROADCAST_AUDIENCES,
  getBroadcastAudienceStats,
  sendBroadcastPush,
} from "../../utils/pushBroadcast.js";

/** Promotions open a store in the customer app, so they only go to audiences with customers. */
const PROMO_AUDIENCES = ["all", "app_users", "customers"];

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Look up the item or store a broadcast promotes. Its own photo is used, so admins pick from
 * what is already in the app instead of uploading.
 */
async function resolvePromo(raw) {
  const menuItemId = raw?.menuItemId ? String(raw.menuItemId) : null;
  const restaurantId = raw?.restaurantId ? String(raw.restaurantId) : null;
  if (!menuItemId && !restaurantId) return null;

  if (menuItemId) {
    const item = await MenuItem.findById(menuItemId)
      .select("name imageUrl restaurant")
      .populate("restaurant", "name imageUrl isActive")
      .lean()
      .catch(() => null);
    if (!item?.restaurant?.isActive) {
      return { error: "That item is no longer in the app" };
    }
    return {
      restaurant: item.restaurant._id,
      menuItem: item._id,
      imageUrl: item.imageUrl || item.restaurant.imageUrl || null,
    };
  }

  const store = await Restaurant.findById(restaurantId)
    .select("name imageUrl isActive")
    .lean()
    .catch(() => null);
  if (!store?.isActive) {
    return { error: "That store is no longer in the app" };
  }
  return { restaurant: store._id, menuItem: null, imageUrl: store.imageUrl || null };
}

/** GET /admin/push-broadcast/promo-search?q= — items and stores (with their photos) to promote */
export const searchPromoTargetsAdmin = async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 60);
  const nameMatch = q ? { name: { $regex: escapeRegex(q), $options: "i" } } : {};

  const activeStores = await Restaurant.find({ isActive: true })
    .select("_id")
    .lean();
  const activeIds = activeStores.map((r) => r._id);

  const [items, stores] = await Promise.all([
    MenuItem.find({
      ...nameMatch,
      restaurant: { $in: activeIds },
      imageUrl: { $nin: [null, ""] },
    })
      .sort(q ? { name: 1 } : { updatedAt: -1 })
      .limit(24)
      .select("name price imageUrl isAvailable restaurant")
      .populate("restaurant", "name vertical")
      .lean(),
    Restaurant.find({ isActive: true, ...nameMatch })
      .sort({ name: 1 })
      .limit(q ? 12 : 8)
      .select("name vertical imageUrl imageEmoji address")
      .lean(),
  ]);

  res.status(StatusCodes.OK).json({
    items: items.map((item) => ({
      _id: item._id,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      isAvailable: item.isAvailable,
      restaurantId: item.restaurant?._id,
      restaurantName: item.restaurant?.name || "",
      vertical: item.restaurant?.vertical || "FOOD",
    })),
    stores: stores.map((store) => ({
      _id: store._id,
      name: store.name,
      vertical: store.vertical,
      imageUrl: store.imageUrl,
      imageEmoji: store.imageEmoji,
      address: store.address,
    })),
  });
};

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
        imageUrl: row.imageUrl || null,
        promoted: row.promo?.menuItem || row.promo?.restaurant ? true : false,
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
    const promo = await resolvePromo(req.body?.promo);
    if (promo?.error) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: promo.error });
    }
    if (promo && !PROMO_AUDIENCES.includes(audience)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "A promotion opens a store in the customer app, so send it to customers",
      });
    }
    // Messages for customers and riders also stay in the app's notifications list, so they
    // can go out without Firebase. Merchants have no such list.
    const reachesInbox = audience !== "merchants";
    if (!isFirebaseConfigured() && !reachesInbox) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Firebase is not configured on the server — pushes cannot be sent",
      });
    }

    const record = await PushBroadcast.create({
      title,
      body,
      audience,
      deepLink,
      imageUrl: promo?.imageUrl || null,
      promo: promo ? { restaurant: promo.restaurant, menuItem: promo.menuItem } : undefined,
      sentBy: req.user.id,
      status: "sending",
    });

    try {
      const stats = isFirebaseConfigured()
        ? await sendBroadcastPush({
            title,
            body,
            audience,
            deepLink,
            imageUrl: promo?.imageUrl || null,
            data: promo
              ? {
                  restaurantId: String(promo.restaurant),
                  ...(promo.menuItem ? { menuItemId: String(promo.menuItem) } : {}),
                }
              : {},
            sentBy: req.user.id,
            broadcastId: record._id,
          })
        : { usersTargeted: 0, devicesTargeted: 0, sentOk: 0, sentFailed: 0, status: "completed" };
      if (!isFirebaseConfigured()) {
        await PushBroadcast.findByIdAndUpdate(record._id, stats);
      }

      res.status(StatusCodes.OK).json({
        message: isFirebaseConfigured()
          ? "Broadcast sent"
          : "Saved to the app's notifications list (phone notifications are off on this server)",
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
