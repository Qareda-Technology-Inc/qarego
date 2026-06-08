import CommerceStoreType from "../models/CommerceStoreType.js";
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
  return "FOOD";
}
