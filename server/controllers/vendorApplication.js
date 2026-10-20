// "List your store" applications from the website, and how admins follow them up.
import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";
import VendorApplication from "../models/VendorApplication.js";
import User from "../models/User.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { normalizePhone } from "../utils/phone.js";
import { inviteVendor } from "../utils/vendorLogin.js";

const STORE_TYPES = ["FOOD", "GROCERY", "PHARMACY", "GAS", "OTHER"];
const LIMIT_PER_HOUR = 5;
const recentByIp = new Map();

/** Saved applications from one address in the last hour (the form is public). */
function recentHits(ip) {
  const now = Date.now();
  const hits = (recentByIp.get(ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  recentByIp.set(ip, hits);
  return hits;
}

/** Only saved applications count, so someone fixing typos isn't locked out. */
function recordHit(ip) {
  if (recentByIp.size > 5000) recentByIp.clear();
  recentByIp.set(ip, [...recentHits(ip), Date.now()]);
}

const clean = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

/** POST /vendor-applications — public, from the website form. */
export const submitVendorApplication = async (req, res) => {
  // Bots fill every field; people never see this one.
  if (req.body?.website) return res.status(StatusCodes.CREATED).json({ message: "Thanks" });
  // The website posts through a Vercel rewrite, so the visitor's address is in Vercel's header.
  const ip = String(req.headers["x-vercel-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
  if (recentHits(ip).length >= LIMIT_PER_HOUR) {
    throw new BadRequestError("Too many applications from here. Please try again later or call us.");
  }

  const businessName = clean(req.body.businessName, 120);
  const contactName = clean(req.body.contactName, 80);
  const area = clean(req.body.area, 120);
  const message = String(req.body.message ?? "").trim().slice(0, 1000);
  const storeType = STORE_TYPES.includes(req.body.storeType) ? req.body.storeType : null;
  const email = clean(req.body.email, 120).toLowerCase() || null;
  const digits = String(req.body.phone || "").replace(/\D/g, "");

  if (!businessName) throw new BadRequestError("Enter your business name");
  if (!contactName) throw new BadRequestError("Enter your name");
  if (digits.length < 9 || digits.length > 12) throw new BadRequestError("Enter a valid phone number");
  if (!storeType) throw new BadRequestError("Choose what you sell");
  if (!area) throw new BadRequestError("Enter your town or area");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestError("Check your email address");

  const phone = normalizePhone(req.body.phone);
  // Same phone already waiting: update that application instead of adding a duplicate.
  const open = await VendorApplication.findOne({ phone, status: { $in: ["new", "contacted"] } });
  if (open) {
    Object.assign(open, { businessName, contactName, area, storeType, email, message });
    await open.save();
    recordHit(ip);
    return res.status(StatusCodes.OK).json({ message: "Application updated" });
  }

  await VendorApplication.create({ businessName, contactName, phone, email, storeType, area, message });
  recordHit(ip);
  res.status(StatusCodes.CREATED).json({ message: "Application received" });
};

/** GET /admin/vendor-applications?status=new|contacted|invited|declined|open */
export const adminListVendorApplications = async (req, res) => {
  const status = String(req.query.status || "open");
  const query = status === "open" ? { status: { $in: ["new", "contacted"] } } : status === "all" ? {} : { status };
  const [applications, counts] = await Promise.all([
    VendorApplication.find(query).sort({ createdAt: -1 }).limit(200).populate("vendor", "name username").lean(),
    VendorApplication.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  // Flag applications from a phone that already has a vendor account.
  const phones = applications.filter((a) => a.status !== "invited").map((a) => a.phone);
  const existing = await User.find({ role: "merchant", phone: { $in: phones } }).select("phone name username").lean();
  const byPhone = new Map(existing.map((u) => [u.phone, u]));

  res.status(StatusCodes.OK).json({
    applications: applications.map((a) => ({ ...a, existingVendor: byPhone.get(a.phone) || null })),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
  });
};

async function findApplication(id) {
  if (!mongoose.isValidObjectId(id)) throw new BadRequestError("Invalid application id");
  const application = await VendorApplication.findById(id);
  if (!application) throw new NotFoundError("Application not found");
  return application;
}

/** PATCH /admin/vendor-applications/:id { status?: contacted | declined | new, note? } */
export const adminUpdateVendorApplication = async (req, res) => {
  const application = await findApplication(req.params.id);
  const { status } = req.body;
  if (status !== undefined) {
    if (!["new", "contacted", "declined"].includes(status)) {
      throw new BadRequestError("Status must be new, contacted or declined");
    }
    if (application.status === "invited") throw new BadRequestError("This business already has a vendor account");
    application.status = status;
  }
  if (req.body.note !== undefined) application.note = String(req.body.note || "").trim().slice(0, 1000) || null;
  application.handledBy = req.user.id;
  application.handledAt = new Date();
  await application.save();
  res.status(StatusCodes.OK).json({ application });
};

/** POST /admin/vendor-applications/:id/invite { username? } — create their vendor account and text the login. */
export const adminInviteFromApplication = async (req, res) => {
  const application = await findApplication(req.params.id);
  if (application.status === "invited") throw new BadRequestError("This business was already invited");

  const { vendor, login } = await inviteVendor({
    name: application.businessName,
    phone: application.phone,
    username: req.body.username,
  });
  application.status = "invited";
  application.vendor = vendor._id;
  application.handledBy = req.user.id;
  application.handledAt = new Date();
  await application.save();

  res.status(StatusCodes.CREATED).json({
    application,
    vendor: { _id: vendor._id, name: vendor.name, username: vendor.username, phone: vendor.phone },
    login,
  });
};
