// Prescription requests: the customer sends a photo of a prescription (or a short list) to one
// pharmacy instead of filling a basket. The pharmacist writes the price, the customer approves,
// and only then does the order go ahead (and get paid, for mobile money).
//
// The order is a normal FoodOrder with `pharmacyQuote` set. It stays PLACED until the customer
// approves; cash orders then start straight away, mobile money ones once the payment lands.
import { refreshOrderTotals } from "./laundryOrders.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const MAX_QUOTE_LINES = 30;
export const MAX_REQUEST_CHARS = 500;
const MAX_NAME_CHARS = 80;
const MAX_NOTE_CHARS = 300;
const MAX_LINE_PRICE = 10_000;
const MAX_LINE_QTY = 99;

/** How long the customer has to approve a price. Stock and prices move, so it isn't held for ever. */
export const PHARMACY_PRICE_HOURS = 2;
const HOUR = 3_600_000;

export const isPharmacyQuoteOrder = (order) => !!order?.pharmacyQuote;

/** When the customer must answer by: set with the price, or worked out for older orders. */
export function pharmacyAnswerBy(quote) {
  if (quote?.answerBy) return new Date(quote.answerBy);
  return quote?.quotedAt ? new Date(new Date(quote.quotedAt).getTime() + PHARMACY_PRICE_HOURS * HOUR) : null;
}

/** A price sent to the customer and not answered in time. */
export function pharmacyPriceExpired(order, now = new Date()) {
  if (order?.pharmacyQuote?.priceStatus !== "awaiting_customer") return false;
  const by = pharmacyAnswerBy(order.pharmacyQuote);
  return !!by && now.getTime() > by.getTime();
}

/** Still waiting on the pharmacist or the customer, so the store can't start it or take payment. */
export const pharmacyQuotePending = (order) =>
  isPharmacyQuoteOrder(order) && order.pharmacyQuote.priceStatus !== "approved";

const cleanText = (value, max) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** What the customer wrote with the photo ("what do you need?"). */
export function readPrescriptionRequestText(raw) {
  return cleanText(raw, MAX_REQUEST_CHARS);
}

/**
 * The pharmacist's price: [{ name, quantity, price }] plus medicines they don't have and a short
 * note. Throws with a message the pharmacist can act on.
 */
export function readPharmacyQuote(body) {
  const rawLines = Array.isArray(body?.items) ? body.items : [];
  if (rawLines.length > MAX_QUOTE_LINES) throw new Error(`Add at most ${MAX_QUOTE_LINES} lines`);
  const items = [];
  for (const line of rawLines) {
    const name = cleanText(line?.name, MAX_NAME_CHARS);
    const price = round2(line?.price);
    const quantity = parseInt(line?.quantity, 10) || 1;
    if (!name && !(price > 0)) continue; // an empty row
    if (!name) throw new Error("Give every medicine a name");
    if (!(price > 0) || price > MAX_LINE_PRICE) throw new Error(`Check the price for ${name}`);
    if (quantity < 1 || quantity > MAX_LINE_QTY) throw new Error(`Check the quantity for ${name}`);
    items.push({ menuItem: null, name, price, quantity, modifiers: [] });
  }
  if (!items.length) {
    throw new Error("Add at least one medicine with its price. If you have none of it, decline the order.");
  }
  const unavailable = (Array.isArray(body?.unavailable) ? body.unavailable : [])
    .map((u) => cleanText(u, MAX_NAME_CHARS))
    .filter(Boolean)
    .slice(0, MAX_QUOTE_LINES);
  const note = cleanText(body?.note, MAX_NOTE_CHARS) || null;
  return { items, unavailable, note };
}

/** Put the pharmacist's price on the order: fees and the store/rider split follow the new subtotal. */
export function applyPharmacyQuote(order, quote, settings, now = new Date()) {
  const status = order.pharmacyQuote?.priceStatus;
  if (!["awaiting_pharmacy", "awaiting_customer"].includes(status)) {
    throw new Error("The customer has already answered this price");
  }
  order.items = quote.items;
  refreshOrderTotals(order, settings);
  order.pharmacyQuote.priceStatus = "awaiting_customer";
  // A new or changed price gives the customer a fresh window to answer.
  order.pharmacyQuote.quotedAt = now;
  order.pharmacyQuote.answerBy = new Date(now.getTime() + PHARMACY_PRICE_HOURS * HOUR);
  order.pharmacyQuote.unavailable = quote.unavailable;
  order.pharmacyQuote.pharmacistNote = quote.note;
  order.markModified("pharmacyQuote");
}

/** The customer's answer. Declining cancels the order (nothing has been paid yet). */
export function applyPharmacyDecision(order, decision, now = new Date()) {
  if (order.pharmacyQuote?.priceStatus !== "awaiting_customer") {
    throw new Error("There's no price to answer yet");
  }
  // Too late to approve (the sweep may not have closed it yet). Declining is still fine.
  if (decision === "approve" && pharmacyPriceExpired(order, now)) {
    throw new Error(PHARMACY_EXPIRED_MESSAGE);
  }
  order.pharmacyQuote.decidedAt = now;
  order.pharmacyQuote.priceStatus = decision === "approve" ? "approved" : "declined";
  order.markModified("pharmacyQuote");
}

export const PHARMACY_DECLINED_REASON = "You declined the pharmacy's price, so nothing was charged.";
export const PHARMACY_EXPIRED_MESSAGE =
  "This price has expired. Send your prescription again to get a new price.";
export const PHARMACY_EXPIRED_REASON = `The pharmacy's price wasn't approved within ${PHARMACY_PRICE_HOURS} hours, so this request was closed. You weren't charged. Send your prescription again any time.`;
