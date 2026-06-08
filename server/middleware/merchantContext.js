import mongoose from "mongoose";
import User from "../models/User.js";
import Restaurant from "../models/Restaurant.js";
import { UnauthenticatedError, BadRequestError } from "../errors/index.js";

/** Just gates the route to merchant/cook accounts (no specific store needed). */
export function requireMerchantRole(req, res, next) {
  const role = req.user?.role;
  if (role !== "merchant" && role !== "cook") {
    throw new UnauthenticatedError("Merchant access required");
  }
  next();
}

/**
 * Runs after authMiddleware. Resolves the ACTIVE restaurant and attaches
 * req.restaurant / req.restaurantId.
 *  - cook: locked to the single restaurant on their account.
 *  - merchant: chosen via `x-restaurant-id` header (or `restaurantId` query),
 *    verified to be one they own. If they own exactly one, it's used by default.
 */
export async function loadMerchantContext(req, res, next) {
  const role = req.user?.role;
  if (role !== "merchant" && role !== "cook") {
    throw new UnauthenticatedError("Merchant access required");
  }

  let restaurant = null;

  if (role === "cook") {
    const cook = await User.findById(req.user.id).select("restaurant isSuspended");
    if (!cook || cook.isSuspended) {
      throw new UnauthenticatedError("Account disabled");
    }
    if (cook.restaurant) {
      restaurant = await Restaurant.findById(cook.restaurant);
    }
    if (!restaurant) {
      throw new BadRequestError("No restaurant is linked to this account");
    }
  } else {
    const requestedId = req.headers["x-restaurant-id"] || req.query.restaurantId;
    if (requestedId) {
      if (!mongoose.isValidObjectId(requestedId)) {
        throw new BadRequestError("Invalid restaurant id");
      }
      restaurant = await Restaurant.findOne({ _id: requestedId, owner: req.user.id });
      if (!restaurant) {
        throw new UnauthenticatedError("You do not manage this restaurant");
      }
    } else {
      const owned = await Restaurant.find({ owner: req.user.id }).limit(2);
      if (owned.length === 0) {
        throw new BadRequestError("Create your first store to get started");
      }
      if (owned.length > 1) {
        throw new BadRequestError("Select a restaurant first");
      }
      restaurant = owned[0];
    }
  }

  req.restaurant = restaurant;
  req.restaurantId = restaurant._id;
  next();
}

/** Owner-only (merchant) actions: menu edits, profile, managing cooks, creating stores. */
export function requireOwner(req, res, next) {
  if (req.user?.role !== "merchant") {
    throw new UnauthenticatedError("Only the restaurant owner can do this");
  }
  next();
}
