// Admin activity log: requireAdmin calls recordAdminActivity after every successful change an
// admin-portal account makes (POST/PATCH/PUT/DELETE), and the admin login records sign-ins.
// Each change becomes a plain sentence ("approved rider Kofi Mensah") with who, when and what.
// Add a rule below for a new admin route to give it a good sentence; unknown changes are still
// recorded, with a generic one.
import AdminActivity from "../models/AdminActivity.js";
import User from "../models/User.js";
import Restaurant from "../models/Restaurant.js";
import Ride from "../models/Ride.js";
import FoodOrder from "../models/FoodOrder.js";
import FoodPayment from "../models/FoodPayment.js";
import CommerceStoreType from "../models/CommerceStoreType.js";
import ServiceZone from "../models/ServiceZone.js";
import VendorApplication from "../models/VendorApplication.js";
import { adminRoleOf } from "./adminAccess.js";

const money = (n) => `GH₵${(Number(n) || 0).toFixed(2)}`;
const shortId = (id) => `#${String(id).slice(-8).toUpperCase()}`;
/** "Kofi's", but "Sally Gifted Fingers'". */
const pos = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

const ROLE_WORD = { super: "a super admin", admin: "an admin", staff: "onboarding staff" };

const ORDER_ACTION = {
  accept: "accepted order {t} for the store",
  reject: "cancelled order {t}",
  ready: "marked order {t} ready",
  collected: "marked order {t} collected",
  assign_rider: "sent a rider to order {t}",
  empty_returned: "confirmed the empty cylinder for order {t} was returned",
  retry_refund: "retried the refund for order {t}",
  mark_refunded: "marked order {t} refunded by hand",
  retry_payout: "retried the payouts for order {t}",
};

/**
 * [method, path pattern, area, action, summary]. In the summary {t} is the target's name; a
 * function gets { body, t } and returns the sentence.
 */
const RULES = [
  // Riders
  ["POST", "/drivers/register", "rider", "rider.add", "added rider {t}"],
  ["PATCH", "/drivers/:id", "rider", "rider.edit", "edited rider {t}"],
  ["DELETE", "/drivers/:id", "rider", "rider.delete", "deleted rider {t}"],
  ["POST", "/drivers/:id/review", "rider", "rider.review", ({ body, t }) =>
    body.decision === "approve" ? `approved rider ${t}` : `asked rider ${t} for changes${body.note ? `: "${body.note}"` : ""}`],
  ["PATCH", "/admin/dispatch/drivers/:id/service-preferences", "rider", "rider.services", "changed the services rider {t} gets"],
  ["PATCH", "/admin/dispatch/drivers/:id/reliability", "rider", "rider.reliability", ({ body, t }) =>
    `changed rider ${pos(t)} reliability${body.action ? ` (${String(body.action).replace(/_/g, " ")})` : ""}`],
  ["POST", "/admin/drivers/:id/credit", "money", "rider.credit", ({ body, t }) =>
    body.kind === "CASH_REPAYMENT" ? `recorded ${money(body.amount)} cash from rider ${t}` : `credited ${money(body.amount)} to rider ${pos(t)} wallet`],
  ["POST", "/admin/drivers/:id/payout", "money", "rider.payout", "paid out rider {t's} wallet to MoMo"],
  // Vendors and stores
  ["POST", "/admin/vendors", "vendor", "vendor.invite", "invited vendor {t}"],
  ["PATCH", "/admin/vendors/:id", "vendor", "vendor.edit", "edited vendor {t}"],
  ["POST", "/admin/vendors/:id/reset-password", "vendor", "vendor.reset_password", "reset vendor {t's} password"],
  ["DELETE", "/admin/vendors/:id", "vendor", "vendor.delete", "deleted vendor {t}"],
  ["POST", "/admin/vendors/:id/categories", "vendor", "vendor.category", "added a store category for vendor {t}"],
  ["PATCH", "/admin/vendor-applications/:id", "vendor", "application.update", ({ body, t }) =>
    `marked the store application from ${t} as ${body.status || "updated"}`],
  ["POST", "/admin/vendor-applications/:id/invite", "vendor", "application.invite", "invited {t} from their store application"],
  ["POST", "/admin/restaurants", "store", "store.add", "added store {t}"],
  ["PATCH", "/admin/restaurants/:id", "store", "store.edit", ({ body, t }) => {
    if (body.commissionFreeUntil !== undefined) {
      return body.commissionFreeUntil
        ? `gave store ${t} no commission until ${new Date(body.commissionFreeUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
        : `ended store ${pos(t)} commission-free period`;
    }
    if (body.isActive !== undefined && Object.keys(body).length <= 2) {
      return body.isActive ? `switched store ${t} on` : `switched store ${t} off`;
    }
    return `edited store ${t}`;
  }],
  ["DELETE", "/admin/restaurants/:id", "store", "store.delete", "deleted store {t}"],
  ["POST", "/admin/restaurants/:id/review", "store", "store.review", ({ body, t }) =>
    body.decision === "approve" ? `approved store ${t}` : `asked store ${t} for changes${body.note ? `: "${body.note}"` : ""}`],
  ["POST", "/admin/restaurants/:id/menu", "store", "menu.add", ({ body, t }) => `added "${body.name || "an item"}" to ${pos(t)} menu`],
  ["PATCH", "/admin/restaurants/:id/menu/:id", "store", "menu.edit", ({ body, t }) =>
    body.isAvailable !== undefined && Object.keys(body).length === 1
      ? `marked an item on ${pos(t)} menu ${body.isAvailable ? "available" : "sold out"}`
      : `edited ${body.name ? `"${body.name}" on ` : "an item on "}${pos(t)} menu`],
  ["DELETE", "/admin/restaurants/:id/menu/:id", "store", "menu.delete", "removed an item from {t's} menu"],
  ["POST", "/admin/stores/:id/commission-payment", "money", "store.cash_payment", ({ body, t }) => `recorded ${money(body.amount)} paid by store ${t}`],
  ["POST", "/admin/store-types", "catalog", "store_type.add", "added store type {t}"],
  ["PATCH", "/admin/store-types/:id", "catalog", "store_type.edit", "edited store type {t}"],
  ["DELETE", "/admin/store-types/:id", "catalog", "store_type.delete", "deleted store type {t}"],
  // Trips and orders
  ["POST", "/admin/rides/:id/assign", "trip", "trip.assign", "assigned a rider to trip {t}"],
  ["POST", "/admin/trips/:id/payment", "money", "trip.payment", ({ body, t }) =>
    body.action === "write_off" ? `wrote off unpaid trip ${t} (QareGO paid the rider)` : `marked unpaid trip ${t} as paid in cash`],
  ["PATCH", "/food/admin/orders/:id", "order", "order.action", ({ body, t }) =>
    (ORDER_ACTION[body.action] || `updated order {t}${body.action ? ` (${body.action})` : ""}`).replace("{t}", t)],
  ["PATCH", "/commerce/admin/orders/:id", "order", "order.action", ({ body, t }) =>
    (ORDER_ACTION[body.action] || `updated order {t}${body.action ? ` (${body.action})` : ""}`).replace("{t}", t)],
  ["POST", "/admin/food-payments/:id/retry-payout", "money", "order.retry_payout", "retried the payouts for order {t}"],
  // Customers
  ["POST", "/customers", "customer", "customer.add", "added customer {t}"],
  ["PATCH", "/customers/:id", "customer", "customer.edit", ({ body, t }) =>
    body.isSuspended !== undefined ? `${body.isSuspended ? "suspended" : "unsuspended"} customer ${t}` : `edited customer ${t}`],
  ["DELETE", "/customers/:id", "customer", "customer.delete", "deleted customer {t}"],
  // Platform
  ["PATCH", "/admin/settings", "settings", "settings.edit", ({ body }) => `changed settings: ${Object.keys(body).join(", ") || "none"}`],
  ["POST", "/admin/settings/kitchen-alert-sound", "settings", "settings.sound", "changed the store new-order sound"],
  ["POST", "/admin/settings/rider-alert-sound", "settings", "settings.sound", "changed the rider offer sound"],
  ["PATCH", "/admin/push-templates", "settings", "push.templates", "edited the push notification texts"],
  ["POST", "/admin/push-templates/preview", null, null, null], // a preview changes nothing
  ["POST", "/admin/push-broadcast", "settings", "push.broadcast", ({ body }) =>
    `sent a push notification${body.title ? ` "${body.title}"` : ""}${body.audience ? ` to ${body.audience}` : ""}`],
  ["POST", "/admin/service-zones", "settings", "zone.add", "added service area {t}"],
  ["PATCH", "/admin/service-zones/:id", "settings", "zone.edit", "edited service area {t}"],
  ["DELETE", "/admin/service-zones/:id", "settings", "zone.delete", "deleted service area {t}"],
  // Team and own account
  ["POST", "/admin/team", "team", "team.add", ({ body, t }) => `added ${t} to the team as ${ROLE_WORD[body.adminRole] || body.adminRole}`],
  ["PATCH", "/admin/team/:id", "team", "team.edit", ({ body, t }) => {
    if (body.active !== undefined) return body.active ? `turned ${pos(t)} account back on` : `turned off ${pos(t)} account`;
    if (body.adminRole) return `made ${t} ${ROLE_WORD[body.adminRole] || body.adminRole}`;
    return `edited ${pos(t)} team details`;
  }],
  ["POST", "/admin/team/:id/reset-password", "team", "team.reset_password", "reset {t's} password"],
  ["POST", "/admin/me/password", "account", "account.password", "changed their own password"],
].map(([method, pattern, area, action, summary]) => ({
  method,
  re: new RegExp(`^${pattern.replace(/:id/g, "([^/]+)")}$`),
  area,
  action,
  summary,
}));

/** What kind of record a rule's first path id points at. */
const TARGET_TYPE = {
  rider: "rider",
  vendor: "vendor",
  store: "store",
  customer: "customer",
  catalog: "storeType",
  trip: "trip",
  order: "order",
  team: "team",
};

async function labelFor(type, id, action) {
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) return null;
  try {
    if (action?.startsWith("application.")) {
      const a = await VendorApplication.findById(id).select("businessName name ownerName").lean();
      return a?.businessName || a?.name || a?.ownerName || null;
    }
    if (action === "order.retry_payout") {
      const p = await FoodPayment.findById(id).select("order").lean();
      return p?.order ? shortId(p.order) : null;
    }
    if (action?.startsWith("trip.") || type === "trip") {
      const r = await Ride.findById(id).select("_id").lean();
      return r ? shortId(r._id) : null;
    }
    if (type === "order") {
      const o = await FoodOrder.findById(id).select("restaurantName").lean();
      return o ? `${shortId(id)}${o.restaurantName ? ` (${o.restaurantName})` : ""}` : null;
    }
    if (type === "store" || action === "store.cash_payment") {
      const r = await Restaurant.findById(id).select("name").lean();
      return r?.name || null;
    }
    if (type === "storeType") {
      const t = await CommerceStoreType.findById(id).select("name").lean();
      return t?.name || null;
    }
    if (action?.startsWith("zone.")) {
      const z = await ServiceZone.findById(id).select("name").lean();
      return z?.name || null;
    }
    const u = await User.findById(id).select("name username phone").lean();
    return u?.name || u?.username || u?.phone || null;
  } catch {
    return null;
  }
}

/** The new record's id and name from a create response (POST with no id in the path). */
function createdFromResponse(body) {
  const rec = body?.restaurant || body?.member || body?.driver || body?.vendor || body?.user || body?.customer || body?.storeType || body?.zone || body?.serviceZone || body?.item;
  if (!rec || typeof rec !== "object") return { id: null, label: null };
  return { id: rec._id ? String(rec._id) : null, label: rec.name || rec.username || rec.phone || null };
}

const SECRET = /pass|token|secret|otp|pin|code/i;

/** Request fields worth keeping: plain values (shortened), and only the key names of objects. */
function sanitize(body) {
  if (!body || typeof body !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(body).slice(0, 25)) {
    if (SECRET.test(k)) continue;
    if (v == null || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.length > 200 ? `${v.slice(0, 200)}…` : v;
    else if (Array.isArray(v)) out[k] = `[${v.length} item${v.length === 1 ? "" : "s"}]`;
    else out[k] = `{${Object.keys(v).slice(0, 10).join(", ")}}`;
  }
  return Object.keys(out).length ? out : null;
}

const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim() || null;

/** Record a successful admin change. Never throws (a logging failure must not break the request). */
export async function recordAdminActivity(req, res) {
  try {
    const method = req.method;
    const path = `${req.baseUrl}${req.path}`.replace(/\/+$/, "");
    const rule = RULES.find((r) => r.method === method && r.re.test(path));
    if (rule && !rule.action) return; // explicitly not logged (e.g. a preview)

    const actor = await User.findById(req.user.id).select("name username adminRole").lean();
    const body = req.body && typeof req.body === "object" ? req.body : {};
    let area = rule?.area || "other";
    let action = rule?.action || "other";
    let targetId = rule ? path.match(rule.re)?.[1] || null : null;
    let label = null;

    if (!targetId && method === "POST") {
      const created = createdFromResponse(res.locals?.responseBody);
      targetId = created.id;
      label = created.label;
    }
    if (!label) label = await labelFor(TARGET_TYPE[area], targetId, action);
    if (!label && action === "rider.add") label = body.name || body.phone || null;
    if (!label && action === "team.add") label = body.name || body.username || null;
    if (!label && action === "vendor.invite") label = body.name || body.phone || null;
    if (!label && action === "store.add") label = body.name || null;
    const t = label || (targetId ? shortId(targetId) : "");

    let summary;
    if (!rule) summary = `made a change (${method} ${path})`;
    else if (typeof rule.summary === "function") summary = rule.summary({ body, t });
    else summary = rule.summary.replace("{t's}", pos(t)).replace("{t}", t);
    summary = summary.replace(/\s+/g, " ").trim();

    await AdminActivity.create({
      actor: req.user.id,
      actorName: actor?.name || actor?.username || null,
      actorRole: adminRoleOf(actor),
      action,
      area,
      summary,
      target: { type: TARGET_TYPE[area] || area, id: targetId, label },
      details: sanitize(body),
      method,
      path,
      ip: clientIp(req),
    });
  } catch (err) {
    console.warn("[admin-activity] could not record:", err?.message || err);
  }
}

/** Record an admin sign-in. Never throws. */
export async function recordAdminSignIn(user, req) {
  try {
    await AdminActivity.create({
      actor: user._id,
      actorName: user.name || user.username || null,
      actorRole: adminRoleOf(user),
      action: "account.sign_in",
      area: "account",
      summary: "signed in",
      method: "POST",
      path: "/auth/admin/login",
      ip: clientIp(req),
    });
  } catch (err) {
    console.warn("[admin-activity] could not record sign-in:", err?.message || err);
  }
}
