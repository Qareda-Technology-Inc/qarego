// Mobile money is paused while QareGO moves to a new MoMo provider. Set MOMO_ENABLED=true in
// the server environment once the new provider is integrated.
import { BadRequestError } from "../errors/index.js";

export function isMomoEnabled() {
  return String(process.env.MOMO_ENABLED || "").toLowerCase() === "true";
}

export const MOMO_PAUSED_MESSAGE =
  "Mobile money is coming soon. Please pay with cash for now.";

export function assertMomoEnabled() {
  if (!isMomoEnabled()) throw new BadRequestError(MOMO_PAUSED_MESSAGE);
}
