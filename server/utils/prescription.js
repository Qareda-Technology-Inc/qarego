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

/**
 * A prescription must be a file our own upload endpoint stored: our Cloudinary account, or
 * this server's /uploads in local mode. Any other link would satisfy the POM check without a
 * real photo, and make store staff open an arbitrary page.
 */
export function isOwnUploadUrl(url) {
  if (typeof url !== "string") return false;
  if (url.startsWith("/uploads/") && !url.includes("..")) return true;
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) return false;
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname === "res.cloudinary.com" &&
      u.pathname.startsWith(`/${cloud}/`)
    );
  } catch {
    return false;
  }
}

export function normalizePrescriptionUrls(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const urls = [];
  for (const value of list) {
    const candidate = sanitizeMediaUrl(value);
    const sanitized = candidate && isOwnUploadUrl(candidate) ? candidate : null;
    if (sanitized && !urls.includes(sanitized)) urls.push(sanitized);
    if (urls.length >= MAX_PRESCRIPTION_PHOTOS) break;
  }
  return urls;
}
