import { sanitizeMediaUrl } from "./mediaStorage.js";

const POM_RE = /prescription|\(POM\)|\bPOM\b|\brx\b/i;
export const MAX_PRESCRIPTION_PHOTOS = 3;

export function isPomMenuItem(item) {
  if (!item) return false;
  const tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
  const hay = `${item.category || ""} ${item.name || ""} ${tags}`;
  return POM_RE.test(hay);
}

export function orderRequiresPrescription(vertical, menuItems) {
  if (String(vertical || "").toUpperCase() !== "PHARMACY") return false;
  return (menuItems || []).some(isPomMenuItem);
}

export function normalizePrescriptionUrls(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const urls = [];
  for (const value of list) {
    const sanitized = sanitizeMediaUrl(value);
    if (sanitized && !urls.includes(sanitized)) urls.push(sanitized);
    if (urls.length >= MAX_PRESCRIPTION_PHOTOS) break;
  }
  return urls;
}
