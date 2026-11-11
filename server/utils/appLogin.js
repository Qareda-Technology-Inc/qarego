// The customer/rider app only signs in customers and riders. One phone number is one account,
// so a number registered as a vendor, kitchen staff or admin can't use the app: without this the
// app treated every non-customer as a rider and opened rider screens that then failed.
import { merchantPortalBase } from "./portalOrigins.js";

export const APP_ROLES = ["customer", "rider"];

/** Why this account can't sign in to the app, or null when it can. */
export function appLoginRefusal(user) {
  if (!user || APP_ROLES.includes(user.role)) return null;
  const portal = merchantPortalBase();
  if (user.role === "merchant" || user.role === "cook") {
    return (
      `This number is registered as a QareGO ${user.role === "cook" ? "kitchen staff" : "vendor"} account. ` +
      `Manage your store on the merchant portal${portal ? ` (${portal})` : ""}, ` +
      "or sign in with a different number to order or ride."
    );
  }
  return "This number is a QareGO admin account. Use the admin portal, or sign in with a different number.";
}
