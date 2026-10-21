// Paystack (Ghana, GHS): hosted checkout for customer payments (mobile money and cards).
// The app opens `authorization_url` in its payment screen and watches for the redirect to
// /payments/return or /payments/cancel, exactly as it did with Hubtel's checkout.
import crypto from "crypto";

const API = "https://api.paystack.co";

export const isPaystackConfigured = () => Boolean(process.env.PAYSTACK_SECRET_KEY);

/** Which provider takes customer payments: Paystack once its key is set, else the old Hubtel setup. */
export const customerPaymentProvider = () => (isPaystackConfigured() ? "paystack" : "hubtel");

async function paystack(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    const err = new Error(data.message || `Paystack request failed (${res.status})`);
    err.statusCode = res.status;
    err.paystack = data;
    throw err;
  }
  return data.data;
}

/** Paystack needs an email; most customers sign in with a phone only. */
export function paystackEmailFor(user) {
  if (user?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) return user.email;
  const digits = String(user?.phone || user?.id || "customer").replace(/\D/g, "") || "customer";
  return `${digits}@customers.qarego.app`;
}

/**
 * Start a hosted checkout. Amount in cedis (sent to Paystack in pesewas).
 * Returns { authorizationUrl, accessCode, reference }.
 */
export async function initializePaystackCheckout({ amount, email, reference, callbackUrl, cancelUrl, metadata }) {
  const data = await paystack("POST", "/transaction/initialize", {
    amount: Math.round(Number(amount) * 100),
    currency: "GHS",
    email,
    reference,
    callback_url: callbackUrl,
    channels: ["mobile_money", "card"],
    metadata: { ...(metadata || {}), cancel_action: cancelUrl },
  });
  return { authorizationUrl: data.authorization_url, accessCode: data.access_code, reference: data.reference };
}

/**
 * Look up a transaction. Returns { status: success|failed|pending, amount (cedis), channel, raw }.
 * A reference Paystack doesn't know yet (checkout never opened) counts as pending.
 */
export async function verifyPaystackTransaction(reference) {
  try {
    const data = await paystack("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
    const s = String(data.status || "").toLowerCase();
    // "abandoned" is just an unpaid checkout and "ongoing"/"pay_offline" a MoMo prompt waiting for
    // approval: both can still be paid, so they stay pending.
    const status = s === "success" ? "success" : s === "failed" || s === "reversed" ? "failed" : "pending";
    return { status, amount: Number(data.amount || 0) / 100, channel: data.channel || null, id: data.id, raw: data };
  } catch (err) {
    if (err.statusCode === 400 || err.statusCode === 404) return { status: "pending", raw: err.paystack };
    throw err;
  }
}

/** Webhooks are signed with HMAC-SHA512 of the raw body using the secret key. */
export function isValidPaystackSignature(rawBody, signature) {
  if (!isPaystackConfigured() || !rawBody || !signature) return false;
  const expected = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
