// Laundry orders: a store order on a LAUNDRY shop that is collected first, counted at the
// shop, washed, then returned. The customer's basket is an estimate until the shop counts.
import MenuItem from "../models/MenuItem.js";
import { computeFoodServiceFee } from "./foodServiceFee.js";
import { computeFoodOrderSplit } from "./foodOrderSettlement.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const isLaundryOrder = (order) => !!order?.laundry;

/** Orders a courier collects from the customer first: gas refills and laundry. */
export const isCollectFirstOrder = (order) => order?.gasMode === "REFILL" || isLaundryOrder(order);

export const countItems = (items) => (items || []).reduce((n, i) => n + (Number(i.quantity) || 0), 0);

/** Courier note for the bag: count only (what's inside is the customer's business). */
export function laundryCourierSummary(order) {
  const n = order.laundry?.countedItemCount ?? countItems(order.items);
  return `Laundry · ${n} item${n === 1 ? "" : "s"}`;
}

/** Recalculate fees, total and the frozen cash split after the items changed. */
function refreshTotals(order, settings, { waiveServiceFee = false } = {}) {
  order.subtotal = round2(order.items.reduce((s, i) => s + i.price * i.quantity, 0));
  order.serviceFee = waiveServiceFee || order.subtotal <= 0 ? 0 : computeFoodServiceFee(order.subtotal, settings);
  order.total = round2(order.subtotal + order.serviceFee + (order.deliveryFee || 0));
  Object.assign(
    order,
    // Keep the store's rate from when the order was placed (e.g. a commission-free period).
    computeFoodOrderSplit({ subtotal: order.subtotal, deliveryFee: order.deliveryFee, serviceFee: order.serviceFee }, settings, {
      commissionFree: !!order.commissionFree,
      stationCommissionRate: order.commissionFree ? null : order.restaurantCommissionRate,
    })
  );
}

/**
 * The shop's count once the bag arrives. `lines` = [{ menuItemId, quantity }] from the shop's
 * own price list (sold-out or hidden items still count: the clothes are already there).
 * Returns { priceRaised }: when the count costs more than the estimate the customer must
 * approve before washing; otherwise it's approved straight away.
 */
export async function applyLaundryCount(order, lines, settings) {
  if (!Array.isArray(lines) || !lines.length) throw new Error("Add the items you counted");
  const quantities = new Map();
  for (const l of lines) {
    const qty = parseInt(l?.quantity, 10);
    if (!l?.menuItemId || !(qty > 0)) continue;
    quantities.set(String(l.menuItemId), (quantities.get(String(l.menuItemId)) || 0) + Math.min(qty, 500));
  }
  if (!quantities.size) throw new Error("Add the items you counted");

  const menu = await MenuItem.find({ _id: { $in: [...quantities.keys()] }, restaurant: order.restaurant })
    .select("name price")
    .lean();
  if (menu.length !== quantities.size) throw new Error("Some items aren't on this shop's price list");

  const previous = order.subtotal;
  order.items = menu.map((m) => ({
    menuItem: m._id,
    name: m.name,
    price: round2(m.price),
    quantity: quantities.get(String(m._id)),
    modifiers: [],
  }));
  refreshTotals(order, settings);

  const priceRaised = order.subtotal > round2(order.laundry.estimatedSubtotal) + 0.004;
  order.laundry.countedAt = new Date();
  order.laundry.countedItemCount = countItems(order.items);
  order.laundry.previousSubtotal = round2(previous) !== order.subtotal ? round2(previous) : null;
  order.laundry.priceStatus = priceRaised ? "awaiting_customer" : "approved";
  order.laundry.decidedAt = priceRaised ? null : new Date();
  order.markModified("laundry");
  return { priceRaised };
}

/**
 * The customer's answer to a higher count. Declining sends everything back unwashed: they pay
 * only for the two trips, and the shop gets nothing for this order.
 */
export function applyLaundryDecision(order, decision, settings) {
  if (order.laundry?.priceStatus !== "awaiting_customer") throw new Error("There's no new price to answer");
  order.laundry.decidedAt = new Date();
  if (decision === "approve") {
    order.laundry.priceStatus = "approved";
  } else {
    order.laundry.priceStatus = "declined";
    order.items = order.items.map((i) => ({ ...(i.toObject?.() ?? i), price: 0 }));
    refreshTotals(order, settings, { waiveServiceFee: true });
  }
  order.markModified("laundry");
}
