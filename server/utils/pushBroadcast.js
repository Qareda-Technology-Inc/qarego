import User from "../models/User.js";
import PushBroadcast from "../models/PushBroadcast.js";
import { isFirebaseConfigured } from "./firebaseAdmin.js";
import { sendPushToUserTokens } from "./pushNotifications.js";

export const BROADCAST_AUDIENCES = {
  all: { label: "Everyone with the app", roles: null },
  app_users: { label: "Customers & riders", roles: ["customer", "rider"] },
  customers: { label: "Customers only", roles: ["customer"] },
  riders: { label: "Riders / drivers", roles: ["rider"] },
  merchants: { label: "Merchants & kitchen staff", roles: ["merchant", "cook"] },
};

export const BROADCAST_AUDIENCE_IDS = Object.keys(BROADCAST_AUDIENCES);

/** Audiences whose broadcasts a user with this role should see in the in-app list. */
export function audiencesForRole(role) {
  return BROADCAST_AUDIENCE_IDS.filter((id) => {
    const roles = BROADCAST_AUDIENCES[id].roles;
    return !roles || roles.includes(role);
  });
}

/**
 * Phones fetch notification pictures themselves, so the URL must be absolute.
 * Cloudinary URLs already are; local /uploads paths need the API's public address.
 */
export function absoluteImageUrl(stored) {
  if (!stored) return null;
  if (/^https?:\/\//i.test(stored)) return stored;
  const base = (process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
  if (!base || !stored.startsWith("/")) return null;
  return `${base}${stored}`;
}

function audienceFilter(audience) {
  const cfg = BROADCAST_AUDIENCES[audience];
  if (!cfg) return null;
  const query = { "pushTokens.0": { $exists: true } };
  if (cfg.roles?.length) {
    query.role = { $in: cfg.roles };
  }
  return query;
}

function countDevices(tokens) {
  return (tokens || []).filter((t) => t?.token).length;
}

function shouldPruneInvalidToken(result) {
  if (!result || result.ok) return false;
  const reason = String(result.reason || "").toLowerCase();
  const error = String(result.error || "").toLowerCase();
  const detail = JSON.stringify(result.detail || {}).toLowerCase();
  return (
    reason.includes("invalid-registration-token") ||
    reason.includes("registration-token-not-registered") ||
    error.includes("not a valid fcm registration token") ||
    error.includes("requested entity was not found") ||
    detail.includes("device not registered") ||
    detail.includes("invalidcredentials") ||
    detail.includes("invalidpush token")
  );
}

/** Audience reach for admin UI. */
export async function getBroadcastAudienceStats() {
  const audiences = [];
  for (const id of BROADCAST_AUDIENCE_IDS) {
    const query = audienceFilter(id);
    const users = await User.find(query).select("pushTokens").lean();
    const devices = users.reduce((sum, u) => sum + countDevices(u.pushTokens), 0);
    audiences.push({
      id,
      label: BROADCAST_AUDIENCES[id].label,
      users: users.length,
      devices,
    });
  }
  return audiences;
}

/**
 * Send a push notification to every device in the chosen audience.
 * Returns delivery stats when finished.
 */
export async function sendBroadcastPush({
  title,
  body,
  audience,
  deepLink = null,
  imageUrl = null,
  data = {},
  sentBy,
  broadcastId = null,
}) {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured — cannot send push notifications");
  }

  const query = audienceFilter(audience);
  if (!query) {
    throw new Error("Invalid audience");
  }

  const payload = {
    title: title.trim(),
    body: body.trim(),
    imageUrl: absoluteImageUrl(imageUrl),
    data: {
      type: "admin_broadcast",
      audience,
      ...(broadcastId ? { broadcastId: String(broadcastId) } : {}),
      ...(deepLink ? { deepLink: String(deepLink) } : {}),
      ...data,
    },
  };

  const users = await User.find(query).select("pushTokens").lean();
  const seenTokens = new Set();
  const tokenEntries = [];

  for (const user of users) {
    for (const entry of user.pushTokens || []) {
      if (!entry?.token || seenTokens.has(entry.token)) continue;
      seenTokens.add(entry.token);
      tokenEntries.push({
        ...entry,
        userId: user._id?.toString?.() || String(user._id),
      });
    }
  }

  let sentOk = 0;
  let sentFailed = 0;
  const invalidByUser = new Map();
  const batchSize = 40;

  for (let i = 0; i < tokenEntries.length; i += batchSize) {
    const batch = tokenEntries.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (entry) => {
        const results = await sendPushToUserTokens([entry], payload);
        return { entry, result: results[0]?.result };
      })
    );
    for (const row of results) {
      const result = row?.result;
      if (result?.ok) sentOk += 1;
      else {
        sentFailed += 1;
        if (shouldPruneInvalidToken(result) && row?.entry?.userId && row?.entry?.token) {
          if (!invalidByUser.has(row.entry.userId)) {
            invalidByUser.set(row.entry.userId, new Set());
          }
          invalidByUser.get(row.entry.userId).add(row.entry.token);
        }
      }
    }
  }

  if (invalidByUser.size) {
    await Promise.all(
      Array.from(invalidByUser.entries()).map(([userId, tokens]) =>
        User.updateOne(
          { _id: userId },
          { $pull: { pushTokens: { token: { $in: Array.from(tokens) } } } }
        )
      )
    );
  }

  const invalidRemoved = Array.from(invalidByUser.values()).reduce(
    (sum, tokenSet) => sum + tokenSet.size,
    0
  );

  if (invalidRemoved > 0) {
    console.log(`[push] broadcast pruned ${invalidRemoved} invalid tokens`);
  }

  const stats = {
    usersTargeted: users.length,
    devicesTargeted: tokenEntries.length,
    sentOk,
    sentFailed,
    invalidRemoved,
    status: "completed",
  };

  if (broadcastId) {
    await PushBroadcast.findByIdAndUpdate(broadcastId, stats);
  }

  return stats;
}
