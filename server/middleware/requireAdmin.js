import { UnauthenticatedError } from "../errors/index.js";

/** Use after authMiddleware — restricts route to admin users. */
export default function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    throw new UnauthenticatedError("Admin access required");
  }
  next();
}
