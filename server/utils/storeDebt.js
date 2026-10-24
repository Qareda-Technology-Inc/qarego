// Store debt: what a store owes QareGO (Restaurant.commissionOwed — QareGO's share of cash pickup
// orders, courier cancellation charges) against the admin's limit (Settings.storeDebtLimit).
// Over the limit the store gets no new orders until it pays (merchant portal → Pay QareGO).
import { computeOpenState } from "./storeHours.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** The limit in cedis; 0 = no limit. */
export const storeDebtLimit = (settings) => Math.max(0, Number(settings?.storeDebtLimit) || 0);

/** True when the store owes more than the limit. */
export function isOverDebtLimit(store, settings) {
  const limit = storeDebtLimit(settings);
  return limit > 0 && round2(store?.commissionOwed) > limit;
}

/** computeOpenState that also pauses a store over its debt limit. */
export const storeOpenState = (store, settings, now = new Date()) =>
  computeOpenState(store, now, { overDebtLimit: isOverDebtLimit(store, settings) });

/** What the merchant portal shows about a store's balance. */
export function storeDebtStatus(store, settings) {
  const limit = storeDebtLimit(settings);
  const owed = round2(store?.commissionOwed);
  return { owed, limit, paused: limit > 0 && owed > limit };
}

/**
 * Call after a charge raised a store's balance by `added`: if that took it over the limit, tell
 * the owner their store is paused and how to resume. Never throws.
 */
export async function notifyIfNewlyOverDebtLimit(store, added) {
  try {
    if (!store?.owner) return;
    const { getSettings } = await import("./tripSettlement.js");
    const settings = await getSettings();
    const before = { commissionOwed: (Number(store.commissionOwed) || 0) - (Number(added) || 0) };
    if (!isOverDebtLimit(store, settings) || isOverDebtLimit(before, settings)) return;
    const { sendPushToUserId } = await import("./pushNotifications.js");
    await sendPushToUserId(store.owner, {
      title: `${store.name}: new orders paused`,
      body: `Your store owes QareGO ${`GH₵${round2(store.commissionOwed).toFixed(2)}`}, over the ${`GH₵${storeDebtLimit(settings).toFixed(2)}`} limit. Pay QareGO in the merchant portal to start getting orders again.`,
      data: { type: "store_debt", restaurantId: String(store._id) },
    });
  } catch (err) {
    console.warn("[store-debt] pause notice failed:", err?.message || err);
  }
}
