/**
 * Duplicate-safe creates. On a weak signal a request can reach us while the reply is lost;
 * the app then retries with the same clientRequestId, and we return what the first attempt
 * created instead of making a second order or ride.
 */
const CLIENT_REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function readClientRequestId(body) {
  const value = body?.clientRequestId;
  return typeof value === "string" && CLIENT_REQUEST_ID_RE.test(value) ? value : null;
}

export function isDuplicateKeyError(err) {
  return err?.code === 11000 && /clientRequestId/.test(String(err?.message || JSON.stringify(err?.keyPattern || {})));
}

/** Unique per customer, only when the app sent one (old app versions don't). */
export const clientRequestIdIndex = [
  { customer: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } },
];
