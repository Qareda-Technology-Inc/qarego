import { UnauthenticatedError } from "../errors/index.js";
import User from "../models/User.js";
import { adminCanAccess, adminRoleOf, isSelfRequest } from "../utils/adminAccess.js";
import { recordAdminActivity } from "../utils/adminActivity.js";

const CHANGES = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Use after authMiddleware — restricts a route to admin-portal accounts, and to what their role
 * allows (see utils/adminAccess.js). Reads the account fresh, so a role change or a disabled
 * account takes effect on the next request. Sets req.adminRole, and records every successful
 * change in the admin activity log.
 */
export default async function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    throw new UnauthenticatedError("Admin access required");
  }
  const user = await User.findById(req.user.id).select("role adminRole isSuspended deletedAt mustChangePassword").lean();
  if (!user || user.role !== "admin" || user.isSuspended || user.deletedAt) {
    throw new UnauthenticatedError("This admin account is no longer active");
  }
  const method = req.method === "HEAD" ? "GET" : req.method;
  const path = `${req.baseUrl}${req.path}`;
  if (user.mustChangePassword && !isSelfRequest(method, path.replace(/\/+$/, ""))) {
    return res.status(403).json({ msg: "Choose your own password before continuing", code: "PASSWORD_CHANGE_REQUIRED" });
  }
  const adminRole = adminRoleOf(user);
  if (!adminCanAccess(adminRole, method, path)) {
    return res.status(403).json({ msg: "Your account doesn't have access to this", code: "ADMIN_FORBIDDEN" });
  }
  req.adminRole = adminRole;

  // Activity log: keep the response (a create's new id and name) and record the change once
  // it has succeeded.
  if (CHANGES.has(method) && !res.locals.activityHooked) {
    res.locals.activityHooked = true;
    const json = res.json.bind(res);
    res.json = (body) => {
      res.locals.responseBody = body;
      return json(body);
    };
    res.on("finish", () => {
      if (res.statusCode < 400) void recordAdminActivity(req, res);
    });
  }
  next();
}
