// Who can do what in the admin portal. Every admin account has role "admin" plus an adminRole:
//   super  — everything, manages the team and sees the activity log (the original Super Admin).
//   admin  — everything except managing the team.
//   staff  — onboarding only: riders (add, review, approve) and vendors (invite, stores, menus,
//            applications, store approvals). No money, settings, trips, orders or customers.

export const ADMIN_ROLES = ["super", "admin", "staff"];

/** An admin account's role; admins from before roles existed are the super admin. */
export const adminRoleOf = (user) => (ADMIN_ROLES.includes(user?.adminRole) ? user.adminRole : "super");

const ID = "[^/]+";
const rule = (method, path) => ({ method, re: new RegExp(`^${path.replace(/:id/g, ID)}$`) });

/** The only requests staff may make (full path, without the query string). */
const STAFF_RULES = [
  // Riders
  rule("GET", "/drivers"),
  rule("GET", "/drivers/review/pending"),
  rule("GET", "/drivers/:id"),
  rule("POST", "/drivers/register"),
  rule("PATCH", "/drivers/:id"),
  rule("POST", "/drivers/:id/review"),
  rule("GET", "/admin/dispatch/drivers"),
  // Vendors and their stores
  rule("GET", "/admin/vendors"),
  rule("POST", "/admin/vendors"),
  rule("PATCH", "/admin/vendors/:id"),
  rule("POST", "/admin/vendors/:id/reset-password"),
  rule("GET", "/admin/vendors/:id/categories"),
  rule("POST", "/admin/vendors/:id/categories"),
  rule("GET", "/admin/vendor-applications"),
  rule("PATCH", "/admin/vendor-applications/:id"),
  rule("POST", "/admin/vendor-applications/:id/invite"),
  rule("GET", "/admin/store-types"),
  rule("GET", "/admin/restaurants"),
  rule("POST", "/admin/restaurants"),
  rule("GET", "/admin/restaurants/:id"),
  rule("PATCH", "/admin/restaurants/:id"),
  rule("POST", "/admin/restaurants/:id/menu"),
  rule("PATCH", "/admin/restaurants/:id/menu/:id"),
  rule("DELETE", "/admin/restaurants/:id/menu/:id"),
  rule("GET", "/admin/store-reviews"),
  rule("POST", "/admin/restaurants/:id/review"),
];

/** Open to every signed-in admin, including one who must still choose their own password. */
const SELF_RULES = [rule("GET", "/admin/me"), rule("POST", "/admin/me/password")];

const SUPER_ONLY = /^\/admin\/(team|activity)(\/|$)/;

const matches = (rules, method, path) => rules.some((r) => r.method === method && r.re.test(path));

export const isSelfRequest = (method, path) => matches(SELF_RULES, method, path);

/** Whether an admin with this role may make this request. */
export function adminCanAccess(adminRole, method, path) {
  const clean = path.replace(/\/+$/, "") || "/";
  if (isSelfRequest(method, clean)) return true;
  if (SUPER_ONLY.test(clean)) return adminRole === "super";
  if (adminRole === "staff") return matches(STAFF_RULES, method, clean);
  return true;
}
