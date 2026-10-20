// What a store needs before QareGO puts it in front of customers.
import MenuItem from "../models/MenuItem.js";

export const MIN_ITEMS_WITH_PHOTOS = 3;

/** Stores that sell regulated goods must show their licence. */
export function licenceLabel(vertical) {
  if (vertical === "PHARMACY") return "Pharmacy licence (Pharmacy Council)";
  if (vertical === "GAS") return "LPG retail licence (NPA)";
  return null;
}

/** "approved" when there's no review on record — those stores predate reviews. */
export function reviewStatus(restaurant) {
  return restaurant?.review?.status || "approved";
}

/**
 * Checklist for one store. `itemsWithPhotos` is how many available menu items have a photo
 * (gas stations sell cylinders at admin-set prices, so they have no menu to check).
 */
export function buildReadiness(restaurant, itemsWithPhotos = 0) {
  const r = restaurant || {};
  const hasPin =
    Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && !(r.latitude === 0 && r.longitude === 0);
  const items = [
    { key: "photo", label: "Store photo", done: !!r.imageUrl, hint: "Add a cover photo customers will see." },
    {
      key: "location",
      label: "Address and map pin",
      done: !!r.address?.trim() && hasPin,
      hint: "Riders use the pin to find you.",
    },
    {
      key: "hours",
      label: "Opening hours",
      done: Array.isArray(r.openingHours) && r.openingHours.length === 7,
      hint: "Set the days and times you take orders.",
    },
  ];
  if (r.vertical !== "GAS") {
    items.push({
      key: "menu",
      label: `At least ${MIN_ITEMS_WITH_PHOTOS} items with photos`,
      done: itemsWithPhotos >= MIN_ITEMS_WITH_PHOTOS,
      hint: `You have ${itemsWithPhotos}.`,
    });
  }
  const licence = licenceLabel(r.vertical);
  if (licence) {
    items.push({
      key: "licence",
      label: licence,
      done: !!r.licence?.url && !!r.licence?.number,
      hint: "Upload a clear photo of the licence and enter its number.",
    });
  }
  return { items, ready: items.every((i) => i.done) };
}

/** Available items with a photo, per store id. */
export async function countItemsWithPhotos(restaurantIds) {
  const rows = await MenuItem.aggregate([
    {
      $match: {
        restaurant: { $in: restaurantIds },
        isAvailable: true,
        imageUrl: { $nin: [null, ""] },
      },
    },
    { $group: { _id: "$restaurant", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export async function getStoreReadiness(restaurant) {
  const counts = await countItemsWithPhotos([restaurant._id]);
  return buildReadiness(restaurant, counts.get(String(restaurant._id)) || 0);
}
