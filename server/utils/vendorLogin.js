// Vendor (merchant) logins: QareGO issues a temporary password and texts it; the vendor
// must choose their own the first time they sign in.
import { merchantPortalBase } from "./portalOrigins.js";
import crypto from "crypto";
import User from "../models/User.js";
import { sendSMS } from "./smsService.js";
import { normalizePhone } from "./phone.js";
import { BadRequestError } from "../errors/index.js";

// No 0/O, 1/I/L, so it can be read out over the phone.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateTempPassword() {
  const pick = () => ALPHABET[crypto.randomInt(ALPHABET.length)];
  const group = () => Array.from({ length: 4 }, pick).join("");
  return `${group()}-${group()}`;
}

/** "Mama's Kitchen" → "mamaskitchen", then mamaskitchen2, 3… until it's free. */
export async function uniqueUsernameFrom(name) {
  const base =
    String(name || "vendor")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20) || "vendor";
  for (let n = 1; n < 500; n += 1) {
    const candidate = n === 1 ? base : `${base}${n}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `${base}${crypto.randomInt(10000, 99999)}`;
}

export function merchantPortalUrl() {
  const origin = merchantPortalBase();
  return origin ? `${origin}/login` : null;
}

/**
 * Text the vendor their sign-in details. Never throws: returns { sent } so the admin can
 * pass the details on themselves when SMS isn't available.
 */
export async function sendVendorLoginSms({ phone, name, username, tempPassword, reason = "invite" }) {
  if (!phone) return { sent: false, reason: "No phone number on this vendor" };
  const first = String(name || "").trim().split(/\s+/)[0];
  const url = merchantPortalUrl();
  const where = url ? `at ${url}` : "on the QareGO merchant portal";
  const opening =
    reason === "reset"
      ? `${first ? `Hi ${first}, your` : "Your"} QareGO store password was reset.`
      : `${first ? `Hi ${first}, your` : "Your"} QareGO store account is ready.`;
  const message = `${opening} Sign in ${where} with username ${username} and temporary password ${tempPassword}. You'll then choose your own password.`;
  try {
    const result = await sendSMS(phone, message);
    if (result?.development) return { sent: false, reason: "SMS isn't set up on this server" };
    return { sent: result?.success !== false };
  } catch (err) {
    console.warn("[vendor-login] SMS failed:", err?.message || err);
    return { sent: false, reason: "The text message couldn't be sent" };
  }
}

/** Issue a fresh temporary password, flag the account, and text it. */
export async function issueTempPassword(user, reason) {
  const tempPassword = generateTempPassword();
  user.password = tempPassword;
  user.mustChangePassword = true;
  await user.save();
  const sms = await sendVendorLoginSms({
    phone: user.phone,
    name: user.name,
    username: user.username,
    tempPassword,
    reason,
  });
  return { tempPassword, sms };
}

/**
 * Create a vendor account from a name and phone (username optional) and text them a temporary
 * password. Shared by "Invite vendor" and inviting from a website application.
 */
export async function inviteVendor({ name: rawName, phone: rawPhone, username: rawUsername }) {
  const name = String(rawName || "").trim();
  const phone = rawPhone ? normalizePhone(String(rawPhone)) : null;
  if (!name) throw new BadRequestError("Enter the vendor's name");
  if (!phone) throw new BadRequestError("Enter the vendor's phone number, so we can text their login");

  let username = String(rawUsername || "").trim().toLowerCase();
  if (username) {
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      throw new BadRequestError("Usernames are 3–30 letters, numbers, dots, dashes or underscores");
    }
    if (await User.exists({ username })) throw new BadRequestError("That username is already taken");
  } else {
    username = await uniqueUsernameFrom(name);
  }
  if (await User.exists({ phone, role: "merchant" })) {
    throw new BadRequestError("A vendor with this phone number already exists");
  }

  const vendor = new User({ role: "merchant", username, name, phone });
  const { tempPassword, sms } = await issueTempPassword(vendor, "invite");
  return {
    vendor,
    login: { username: vendor.username, tempPassword, sms, portalUrl: merchantPortalUrl() },
  };
}
