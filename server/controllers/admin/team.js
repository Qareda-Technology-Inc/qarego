// Admin team: the super admin adds admins and onboarding staff, changes their role, resets their
// password and turns accounts off. Every admin can see who they are and change their own password.
import { StatusCodes } from "http-status-codes";
import User from "../../models/User.js";
import AdminActivity from "../../models/AdminActivity.js";
import { BadRequestError, NotFoundError } from "../../errors/index.js";
import { ADMIN_ROLES, adminRoleOf } from "../../utils/adminAccess.js";
import { generateTempPassword } from "../../utils/vendorLogin.js";
import { normalizePhone } from "../../utils/phone.js";
import { adminOrigins } from "../../utils/portalOrigins.js";
import { sendSMS } from "../../utils/smsService.js";

const MEMBER_FIELDS = "name username phone email adminRole isSuspended mustChangePassword createdAt lastAdminLoginAt";

const shape = (u) => ({
  _id: u._id,
  name: u.name || null,
  username: u.username,
  phone: u.phone || null,
  adminRole: adminRoleOf(u),
  active: !u.isSuspended,
  mustChangePassword: !!u.mustChangePassword,
  createdAt: u.createdAt,
  lastLoginAt: u.lastAdminLoginAt || null,
});

/** Text a new or reset admin their sign-in details. Never throws. */
async function textSignIn(user, tempPassword, reason) {
  if (!user.phone) return { sent: false, reason: "No phone number on this account" };
  const first = String(user.name || "").trim().split(/\s+/)[0];
  const url = adminOrigins()[0] || "the QareGO admin portal";
  const opening =
    reason === "reset"
      ? `${first ? `Hi ${first}, your` : "Your"} QareGO admin password was reset.`
      : `${first ? `Hi ${first}, you` : "You"} now have a QareGO admin account.`;
  try {
    const result = await sendSMS(
      user.phone,
      `${opening} Sign in at ${url} with username ${user.username} and temporary password ${tempPassword}. You'll then choose your own password.`
    );
    if (result?.development) return { sent: false, reason: "SMS isn't set up on this server" };
    return { sent: result?.success !== false };
  } catch (err) {
    console.warn("[admin-team] SMS failed:", err?.message || err);
    return { sent: false, reason: "The text message couldn't be sent" };
  }
}

/** Refuse a change that would leave the portal with no active super admin. */
async function assertAnotherSuperRemains(userId) {
  const others = await User.find({ role: "admin", isSuspended: { $ne: true }, deletedAt: null, _id: { $ne: userId } })
    .select("adminRole")
    .lean();
  if (!others.some((u) => adminRoleOf(u) === "super")) {
    throw new BadRequestError("There must always be at least one active super admin");
  }
}

/** GET /admin/me — the signed-in admin and their role. */
export const getAdminMe = async (req, res) => {
  const me = await User.findById(req.user.id).select(MEMBER_FIELDS).lean();
  if (!me) throw new NotFoundError("Account not found");
  res.status(StatusCodes.OK).json({ user: shape(me) });
};

/** POST /admin/me/password { currentPassword, newPassword } */
export const changeMyAdminPassword = async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  if (!currentPassword) throw new BadRequestError("Enter your current password");
  if (newPassword.length < 8) throw new BadRequestError("Use at least 8 characters for your new password");
  if (newPassword === currentPassword) throw new BadRequestError("Choose a password different from the current one");
  const user = await User.findById(req.user.id).select("+password");
  if (!user || !(await user.comparePassword(currentPassword))) {
    throw new BadRequestError("Your current password isn't right");
  }
  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();
  res.status(StatusCodes.OK).json({ message: "Password changed" });
};

/** GET /admin/team — everyone with admin-portal access. */
export const listTeam = async (_req, res) => {
  const members = await User.find({ role: "admin", deletedAt: null }).select(MEMBER_FIELDS).sort({ createdAt: 1 }).lean();
  res.status(StatusCodes.OK).json({ members: members.map(shape) });
};

/** POST /admin/team { name, username, phone?, adminRole } — add an admin or staff member. */
export const createTeamMember = async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const username = String(req.body?.username || "").trim().toLowerCase();
  const adminRole = String(req.body?.adminRole || "");
  const phone = req.body?.phone ? normalizePhone(req.body.phone) : null;
  if (!name) throw new BadRequestError("Enter their name");
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    throw new BadRequestError("Username: 3–30 letters, numbers, dots, dashes or underscores");
  }
  if (!ADMIN_ROLES.includes(adminRole)) throw new BadRequestError("Choose a role: super, admin or staff");
  if (await User.exists({ username })) throw new BadRequestError("That username is already taken");
  if (phone && (await User.exists({ phone }))) {
    throw new BadRequestError("That phone number already belongs to another account");
  }

  const tempPassword = generateTempPassword();
  const user = await User.create({
    role: "admin",
    adminRole,
    name,
    username,
    ...(phone ? { phone } : {}),
    password: tempPassword,
    mustChangePassword: true,
  });
  const sms = await textSignIn(user, tempPassword, "invite");
  res.status(StatusCodes.CREATED).json({ member: shape(user.toObject()), tempPassword, sms });
};

/** PATCH /admin/team/:id { name?, phone?, adminRole?, active? } */
export const updateTeamMember = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: "admin", deletedAt: null });
  if (!user) throw new NotFoundError("Team member not found");
  const isSelf = String(user._id) === String(req.user.id);
  const { name, phone, adminRole, active } = req.body || {};

  if (name !== undefined) {
    if (!String(name).trim()) throw new BadRequestError("Enter their name");
    user.name = String(name).trim();
  }
  if (phone !== undefined) {
    const next = phone ? normalizePhone(phone) : null;
    if (next && (await User.exists({ phone: next, _id: { $ne: user._id } }))) {
      throw new BadRequestError("That phone number already belongs to another account");
    }
    user.phone = next || undefined;
  }
  if (adminRole !== undefined && adminRole !== adminRoleOf(user)) {
    if (!ADMIN_ROLES.includes(adminRole)) throw new BadRequestError("Choose a role: super, admin or staff");
    if (isSelf) throw new BadRequestError("You can't change your own role");
    if (adminRoleOf(user) === "super") await assertAnotherSuperRemains(user._id);
    user.adminRole = adminRole;
  }
  if (active !== undefined) {
    if (isSelf && !active) throw new BadRequestError("You can't turn off your own account");
    if (!active && adminRoleOf(user) === "super") await assertAnotherSuperRemains(user._id);
    user.isSuspended = !active;
  }
  await user.save();
  res.status(StatusCodes.OK).json({ member: shape(user.toObject()) });
};

/** POST /admin/team/:id/reset-password — new temporary password, texted to them. */
export const resetTeamMemberPassword = async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: "admin", deletedAt: null });
  if (!user) throw new NotFoundError("Team member not found");
  if (String(user._id) === String(req.user.id)) {
    throw new BadRequestError("Change your own password from your account menu");
  }
  const tempPassword = generateTempPassword();
  user.password = tempPassword;
  user.mustChangePassword = true;
  await user.save();
  const sms = await textSignIn(user, tempPassword, "reset");
  res.status(StatusCodes.OK).json({ tempPassword, sms });
};

/**
 * GET /admin/activity?actor&area&from&to&q&page&limit — the admin activity log, newest first.
 * Also returns the people and areas to filter by.
 */
export const getAdminActivity = async (req, res) => {
  const { actor, area, from, to, q } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const query = {};
  if (actor && /^[a-f0-9]{24}$/i.test(String(actor))) query.actor = actor;
  if (area) query.area = String(area);
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(`${from}T00:00:00`);
    if (to) query.createdAt.$lte = new Date(`${to}T23:59:59.999`);
  }
  const text = String(q || "").trim();
  if (text) {
    const pattern = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ summary: pattern }, { actorName: pattern }, { "target.label": pattern }];
  }
  const [total, entries, people] = await Promise.all([
    AdminActivity.countDocuments(query),
    AdminActivity.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.find({ role: "admin" }).select("name username").sort({ name: 1 }).lean(),
  ]);
  res.status(StatusCodes.OK).json({
    entries: entries.map((e) => ({
      _id: e._id,
      at: e.createdAt,
      actor: { _id: e.actor, name: e.actorName, role: e.actorRole },
      area: e.area,
      action: e.action,
      summary: e.summary,
      target: e.target || null,
      details: e.details || null,
      ip: e.ip || null,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    people: people.map((p) => ({ _id: p._id, name: p.name || p.username })),
  });
};
