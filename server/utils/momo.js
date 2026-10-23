// Ghana mobile money helpers shared by payments and payouts (Paystack).

/** Ghana phone in international form without "+": 233XXXXXXXXX. */
export function formatGhPhone(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("233")) cleaned = "233" + cleaned;
  return cleaned;
}

/**
 * The MoMo network of a Ghana number, from its prefix: mtn-gh, vodafone-gh (Telecel) or
 * airteltigo-gh. Unknown prefixes count as MTN.
 */
export function detectGhMomoChannel(phone) {
  const cleaned = formatGhPhone(phone);
  const local = cleaned.startsWith("233") ? cleaned.slice(3) : cleaned;
  const prefix2 = local.slice(0, 2);
  if (["20", "50"].includes(prefix2)) return "vodafone-gh";
  if (["26", "27", "56", "57"].includes(prefix2)) return "airteltigo-gh";
  return "mtn-gh";
}

/** A short, unique payment reference (max 32 characters): prefix + id tail + time. */
export function makePaymentRef(prefix, id) {
  const tail = String(id || "").replace(/\W/g, "").slice(-10);
  const stamp = Date.now().toString(36).slice(-6);
  return `${prefix}${tail}${stamp}`.slice(0, 32);
}
