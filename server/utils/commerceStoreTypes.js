import CommerceStoreType from "../models/CommerceStoreType.js";
import Restaurant from "../models/Restaurant.js";
import { ALL_COMMERCE_VERTICAL_TAGS } from "./commerceVerticalTags.js";

/** @deprecated use ALL_COMMERCE_VERTICAL_TAGS */
export const DEFAULT_STORE_TYPES = ALL_COMMERCE_VERTICAL_TAGS;

/** Upsert platform tags — adds new catalog entries without removing custom admin types. */
export async function ensureDefaultStoreTypes() {
  for (const tag of ALL_COMMERCE_VERTICAL_TAGS) {
    await CommerceStoreType.updateOne(
      { vertical: tag.vertical, name: tag.name },
      {
        $set: {
          emoji: tag.emoji,
          sortOrder: tag.sortOrder,
          isActive: true,
        },
        $setOnInsert: {
          name: tag.name,
          vertical: tag.vertical,
        },
      },
      { upsert: true }
    );
  }
}

export function inferVerticalFromCategoryName(category) {
  const hay = String(category || "").toLowerCase();
  if (/(grocery|grocer|mart|supermarket|provision|market)/i.test(hay)) return "GROCERY";
  if (/(pharmacy|pharma|drug|medicine|chemist|health)/i.test(hay)) return "PHARMACY";
  if (/(\bgas\b|lpg|cylinder|filling)/i.test(hay)) return "GAS";
  return "FOOD";
}

/**
 * Stores saved before the store type existed default to FOOD, so a pharmacy could show
 * kitchen wording. Correct only the clear case: a FOOD store whose tags all belong to one
 * other type (tags are catalog names, each with exactly one type). Safe to run every start.
 */
export async function fixStoreVerticalsFromTags() {
  const types = await CommerceStoreType.find({}).select("name vertical").lean();
  const verticalByName = new Map(types.map((t) => [t.name.toLowerCase(), t.vertical]));
  const stores = await Restaurant.find({ $or: [{ vertical: "FOOD" }, { vertical: null }] })
    .select("name tags category vertical")
    .lean();
  let fixed = 0;
  for (const store of stores) {
    const names = (store.tags?.length ? store.tags : [store.category]).filter(Boolean);
    const verticals = new Set(
      names.map((n) => verticalByName.get(String(n).toLowerCase())).filter(Boolean)
    );
    if (verticals.size !== 1) continue;
    const [vertical] = verticals;
    if (vertical === "FOOD") continue;
    await Restaurant.updateOne({ _id: store._id }, { $set: { vertical } });
    console.log(`[store-types] ${store.name}: FOOD -> ${vertical} (from its tags)`);
    fixed += 1;
  }
  return fixed;
}
