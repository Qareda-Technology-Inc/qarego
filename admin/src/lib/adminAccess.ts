// Which admin-portal pages each role can open (the server enforces the same rules on every
// request: server/utils/adminAccess.js).
//   super — everything, plus Team and Activity.   admin — everything except those.
//   staff — onboarding only: riders and vendors.

export type AdminRole = "super" | "admin" | "staff";

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  super: "Super admin",
  admin: "Admin",
  staff: "Onboarding staff",
};

/** Pages staff can open (and everything under them). */
const STAFF_PAGES = ["/drivers", "/vendors", "/restaurants", "/store-approvals"];
/** Pages every admin can open, whatever their role. */
const OPEN_PAGES = ["/login", "/account"];

/** Where each role lands after signing in, or when a page isn't for them. */
export const homeFor = (role?: AdminRole | null) => (role === "staff" ? "/drivers/review" : "/");

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

export function canOpenPage(role: AdminRole | null | undefined, path: string): boolean {
  if (OPEN_PAGES.some((p) => under(path, p))) return true;
  if (under(path, "/team") || under(path, "/activity")) return role === "super";
  if (role === "staff") return STAFF_PAGES.some((p) => under(path, p));
  return true;
}
