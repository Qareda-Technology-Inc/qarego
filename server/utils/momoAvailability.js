// Switch for mobile money and card payments (Paystack): MOMO_ENABLED=true in the server
// environment turns them on. With it off, everything is cash only (payments, payouts, top-ups).
import { BadRequestError } from "../errors/index.js";

export function isMomoEnabled() {
  return String(process.env.MOMO_ENABLED || "").toLowerCase() === "true";
}

export const MOMO_PAUSED_MESSAGE =
  "Mobile money isn't available right now. Please pay with cash.";

export function assertMomoEnabled() {
  if (!isMomoEnabled()) throw new BadRequestError(MOMO_PAUSED_MESSAGE);
}
