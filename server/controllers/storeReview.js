// Admin review of stores vendors set up themselves, before they go live to customers.
import Restaurant from "../models/Restaurant.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { buildReadiness, countItemsWithPhotos, licenceLabel, reviewStatus } from "../utils/storeReadiness.js";
import { sendPushToUserId } from "../utils/pushNotifications.js";
import { grantNewStoreFreePeriod, isCommissionFree } from "../utils/commissionFree.js";
import { getSettings } from "../utils/tripSettlement.js";

const QUEUE_STATUSES = ["pending", "changes_requested", "draft"];

/** GET /admin/store-reviews — stores not live yet: waiting for review first, then sent back, then still setting up. */
export const adminListStoreReviews = async (req, res) => {
  const stores = await Restaurant.find({ "review.status": { $in: QUEUE_STATUSES } })
    .select(
      "name imageEmoji imageUrl vertical address latitude longitude openingHours licence review owner createdAt"
    )
    .populate("owner", "name username phone")
    .lean();
  const photoCounts = await countItemsWithPhotos(stores.map((s) => s._id));

  const order = { pending: 0, changes_requested: 1, draft: 2 };
  const rows = stores
    .map((s) => ({
      ...s,
      reviewStatus: reviewStatus(s),
      licenceLabel: licenceLabel(s.vertical),
      readiness: buildReadiness(s, photoCounts.get(String(s._id)) || 0),
    }))
    .sort(
      (a, b) =>
        order[a.reviewStatus] - order[b.reviewStatus] ||
        new Date(a.review?.submittedAt || a.createdAt) - new Date(b.review?.submittedAt || b.createdAt)
    );

  res.status(StatusCodes.OK).json({
    stores: rows,
    counts: {
      pending: rows.filter((r) => r.reviewStatus === "pending").length,
      changes_requested: rows.filter((r) => r.reviewStatus === "changes_requested").length,
      draft: rows.filter((r) => r.reviewStatus === "draft").length,
    },
  });
};

/**
 * POST /admin/restaurants/:id/review { decision: approve | request_changes, note, override }
 * Approving puts the store live; asking for changes keeps it hidden and shows the vendor the note.
 */
export const adminReviewStore = async (req, res) => {
  const { decision } = req.body;
  const note = String(req.body.note || "").trim();
  if (!["approve", "request_changes"].includes(decision)) {
    throw new BadRequestError("decision must be approve or request_changes");
  }
  if (decision === "request_changes" && !note) {
    throw new BadRequestError("Tell the vendor what to fix");
  }

  const restaurant = await Restaurant.findById(req.params.id);
  if (!restaurant) throw new NotFoundError("Store not found");

  if (decision === "approve") {
    const counts = await countItemsWithPhotos([restaurant._id]);
    const readiness = buildReadiness(restaurant, counts.get(String(restaurant._id)) || 0);
    const missing = readiness.items.filter((i) => !i.done).map((i) => i.label.toLowerCase());
    if (missing.length && !req.body.override) {
      throw new BadRequestError(`Still missing: ${missing.join(", ")}`);
    }
    restaurant.isActive = true;
    grantNewStoreFreePeriod(restaurant, await getSettings());
  } else {
    restaurant.isActive = false;
  }

  restaurant.review = {
    status: decision === "approve" ? "approved" : "changes_requested",
    note: note || null,
    submittedAt: restaurant.review?.submittedAt ?? null,
    decidedAt: new Date(),
    by: req.user.id,
  };
  await restaurant.save();

  if (restaurant.owner) {
    sendPushToUserId(
      restaurant.owner,
      decision === "approve"
        ? {
            title: `${restaurant.name} is live`,
            body: isCommissionFree(restaurant)
              ? `Customers can now order from you. No QareGO commission until ${restaurant.commissionFreeUntil.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.`
              : "Customers can now find your store and order from it.",
            data: { type: "store_review", decision: "approved", restaurantId: String(restaurant._id) },
          }
        : {
            title: `Changes needed for ${restaurant.name}`,
            body: note.length > 120 ? `${note.slice(0, 117)}…` : note,
            data: { type: "store_review", decision: "changes_requested", restaurantId: String(restaurant._id) },
          }
    ).catch((err) => console.warn("[store-review] push failed:", err?.message || err));
  }

  res.status(StatusCodes.OK).json({ message: decision === "approve" ? "Store is live" : "Sent back to vendor", restaurant });
};
