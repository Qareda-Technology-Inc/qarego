// Web portal addresses from the environment. ADMIN_ORIGIN / MERCHANT_ORIGIN may list several,
// comma-separated (e.g. the new domain plus the old *.vercel.app one during a move). All are
// allowed to call the API; the first one is used in links we send to people.
const list = (value) =>
  String(value || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

export const adminOrigins = () => list(process.env.ADMIN_ORIGIN);
export const merchantOrigins = () => list(process.env.MERCHANT_ORIGIN);

/** Address used in links to the merchant portal (texts, notifications). */
export const merchantPortalBase = () => merchantOrigins()[0] || null;
