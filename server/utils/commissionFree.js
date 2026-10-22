// Commission-free period for stores: while a store's commissionFreeUntil is in the future its
// orders carry no store commission. Admin sets it per store; new stores can get one
// automatically when they go live (Settings.storeFreePeriodDays).

const DAY_MS = 86_400_000;

/** True while the store's free period is running. */
export function isCommissionFree(store, at = new Date()) {
  return !!store?.commissionFreeUntil && new Date(store.commissionFreeUntil).getTime() > at.getTime();
}

/**
 * Give a store the automatic free period when it goes live. Only once per store: a store that
 * already had one (or had it ended by admin) doesn't get another. Mutates the document.
 */
export function grantNewStoreFreePeriod(store, settings, from = new Date()) {
  const days = Math.floor(Number(settings?.storeFreePeriodDays) || 0);
  if (days <= 0 || store.commissionFreeSetAt || store.commissionFreeUntil) return false;
  store.commissionFreeUntil = new Date(from.getTime() + days * DAY_MS);
  store.commissionFreeSetAt = from;
  return true;
}
