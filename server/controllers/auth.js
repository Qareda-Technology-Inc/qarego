import User from "../models/User.js";
import { adminRoleOf } from "../utils/adminAccess.js";
import { recordAdminSignIn } from "../utils/adminActivity.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError } from "../errors/index.js";
import jwt from "jsonwebtoken";
import { sendOtpSMS } from "../utils/smsService.js";
import crypto from "crypto";
import OtpCode from "../models/OtpCode.js";
import { ARKESEL_OTP_LENGTH, isArkeselOtpConfigured, sendArkeselOtp, verifyArkeselOtp } from "../utils/arkeselOtp.js";
import { normalizePhone } from "../utils/phone.js";
import { normalizeServicePreferencesInput } from "../utils/riderServicePreferences.js";
import { sanitizeMediaUrl } from "../utils/mediaStorage.js";
import { getReviewAccount, ensureReviewUser } from "../utils/reviewLogin.js";
import Ride from "../models/Ride.js";
import path from "path";
import { fileURLToPath } from "url";
import { deleteFromCloudinary, parseCloudinaryUrl, safeUnlink } from "../utils/cloudinary.js";
import FoodOrder from "../models/FoodOrder.js";
import { formatCurrency } from "../utils/currency.js";

const OTP_TTL_MIN = 5;
/** Wrong guesses allowed on one of our own codes before it's thrown away. */
const MAX_OTP_ATTEMPTS = 5;

/** A 4-digit code QareGO makes itself (older apps, or when Arkesel's OTP service can't be used). */
const generateOTP = () => crypto.randomInt(1000, 10000).toString();

/**
 * POST /auth/request-otp { phone, codeLength? }
 * New apps send codeLength 6: Arkesel's OTP service makes, sends and later checks the code.
 * Older apps (4-digit boxes) get a 4-digit code QareGO makes and sends by normal SMS. If Arkesel's
 * OTP service refuses, we fall back to that too; the reply's codeLength tells the app which.
 */
export const requestOtp = async (req, res) => {
  const { phone: rawPhone } = req.body;
  const phone = normalizePhone(rawPhone);
  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  const reviewAccount = getReviewAccount(rawPhone) || getReviewAccount(phone);
  if (reviewAccount) {
    return res.status(StatusCodes.OK).json({
      message: "Review login ready",
      method: "review",
      codeLength: String(reviewAccount.otp).length,
    });
  }

  const wantsLongCode = Number(req.body.codeLength) >= ARKESEL_OTP_LENGTH;
  if (wantsLongCode && isArkeselOtpConfigured()) {
    const sent = await sendArkeselOtp(phone);
    if (sent.ok) {
      // A code we made earlier for this number is no longer the one to use.
      await OtpCode.deleteOne({ phone });
      return res.status(StatusCodes.OK).json({
        message: "OTP sent successfully via SMS",
        method: "sms",
        codeLength: ARKESEL_OTP_LENGTH,
        ussdCode: sent.ussdCode,
      });
    }
    console.error("[otp] Arkesel OTP failed, sending our own code instead:", sent.code, sent.error);
  }

  const otp = generateOTP();
  await OtpCode.findOneAndUpdate(
    { phone },
    { $set: { code: otp, expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60 * 1000), attempts: 0 } },
    { upsert: true }
  );
  try {
    const smsResult = await sendOtpSMS(phone, otp);
    if (!smsResult.success && !smsResult.development) {
      console.error("[otp] SMS failed:", smsResult.error);
    }
  } catch (smsError) {
    console.error("[otp] SMS failed:", smsError.message);
  }

  res.status(StatusCodes.OK).json({
    message: "OTP sent successfully via SMS",
    method: "sms",
    codeLength: 4,
    // Development only: lets you sign in without an SMS.
    otp: process.env.NODE_ENV === "development" ? otp : undefined,
  });
};

export const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new BadRequestError("Please provide username and password");
  }

  const login = String(username).trim();
  const user =
    (await User.findOne({ username: login }).select('+password')) ||
    (await User.findOne({ username: login.toLowerCase() }).select('+password'));
  if (!user) {
    throw new UnauthenticatedError("Invalid Credentials");
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError("Invalid Credentials");
  }

  if (user.role !== 'admin') {
     throw new UnauthenticatedError("Access Denied: Not an admin");
  }
  if (user.isSuspended || user.deletedAt) {
    throw new UnauthenticatedError("This admin account has been turned off. Ask your super admin.");
  }

  const accessToken = user.createAccessToken();
  const refreshToken = user.createRefreshToken();
  await User.updateOne({ _id: user._id }, { $set: { lastAdminLoginAt: new Date() } });
  void recordAdminSignIn(user, req);

  res.status(StatusCodes.OK).json({
    user: {
      userId: user._id,
      name: user.name,
      role: user.role,
      adminRole: adminRoleOf(user),
      mustChangePassword: !!user.mustChangePassword,
    },
    accessToken,
    refreshToken,
  });
};

/** Check a code: Arkesel's (6+ digits) with Arkesel, our own 4-digit ones against the database. */
async function checkOtp(phone, otp) {
  const code = String(otp || "").trim();
  if (code.length >= ARKESEL_OTP_LENGTH) {
    const result = await verifyArkeselOtp(phone, code);
    if (result.ok) return;
    if (result.reason === "expired") throw new UnauthenticatedError("This code has expired. Please request a new one.");
    if (result.reason === "invalid") throw new UnauthenticatedError("Invalid code. Please try again.");
    console.error("[otp] Arkesel verify failed:", result.error);
    throw new BadRequestError("We couldn't check your code just now. Please try again.");
  }

  const stored = await OtpCode.findOne({ phone });
  if (!stored || stored.expiresAt.getTime() < Date.now()) {
    throw new UnauthenticatedError("This code has expired or wasn't found. Please request a new one.");
  }
  if (stored.code !== code) {
    const attempts = stored.attempts + 1;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await OtpCode.deleteOne({ _id: stored._id });
      throw new UnauthenticatedError("Too many wrong codes. Please request a new one.");
    }
    await OtpCode.updateOne({ _id: stored._id }, { $set: { attempts } });
    throw new UnauthenticatedError("Invalid code. Please try again.");
  }
  await OtpCode.deleteOne({ _id: stored._id });
}

export const verifyOtp = async (req, res) => {
  const { phone: rawPhone, otp } = req.body;
  const phone = normalizePhone(rawPhone);

  if (!phone || !otp) {
    throw new BadRequestError("Phone number and OTP are required");
  }

  const reviewAccount = getReviewAccount(rawPhone) || getReviewAccount(phone);
  if (reviewAccount) {
    if (otp !== reviewAccount.otp) {
      throw new UnauthenticatedError("Invalid OTP. Please try again.");
    }
    const user = await ensureReviewUser(reviewAccount);
    const accessToken = user.createAccessToken();
    const refreshToken = user.createRefreshToken();
    return res.status(StatusCodes.OK).json({
      message: "OTP verified successfully",
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  await checkOtp(phone, otp);

  // Find or create user
  let user = await User.findOne({ phone });

  if (!user) {
    // If user does NOT exist, create as CUSTOMER
    user = new User({
      phone,
      role: "customer", // Default to customer
    });
    await user.save();
  }

  // Generate tokens
  const accessToken = user.createAccessToken();
  const refreshToken = user.createRefreshToken();

  res.status(StatusCodes.OK).json({
    message: "OTP verified successfully",
    user,
    access_token: accessToken,
    refresh_token: refreshToken,
  });
};

export const auth = async (req, res) => {
  const { phone: rawPhone } = req.body;
  const phone = normalizePhone(rawPhone);

  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  try {
    let user = await User.findOne({ phone });

    // If user exists, log them in
    if (user) {
      const accessToken = user.createAccessToken();
      const refreshToken = user.createRefreshToken();

      return res.status(StatusCodes.OK).json({
        message: "User logged in successfully",
        user,
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }

    // If user does NOT exist, create as CUSTOMER (Riders must be pre-registered by admin)
    // Alternatively, if we want to allow new users to BECOME riders, we'd need a different flow.
    // But per requirements: "admin will register the riders".
    // So any new phone number is automatically a CUSTOMER.
    
    user = new User({
      phone,
      role: "customer", // Default to customer
    });

    await user.save();

    const accessToken = user.createAccessToken();
    const refreshToken = user.createRefreshToken();

    res.status(StatusCodes.CREATED).json({
      message: "User created successfully",
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};


export const refreshToken = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    throw new BadRequestError("Refresh token is required");
  }

  try {
    const payload = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(payload.id);

    if (!user || user.deletedAt) {
      throw new UnauthenticatedError("Invalid refresh token");
    }

    const newAccessToken = user.createAccessToken();
    const newRefreshToken = user.createRefreshToken();

    res.status(StatusCodes.OK).json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    console.error(error);
    throw new UnauthenticatedError("Invalid refresh token");
  }
};

export const updateUser = async (req, res) => {
  const { id, name, email, profileImageUrl } = req.body;
  const normalizedId = id != null ? String(id) : null;

  if (!normalizedId) {
    throw new BadRequestError("User ID is required");
  }

  // User can only update their own profile (req.user.id from auth middleware)
  if (String(req.user.id) !== normalizedId) {
    throw new UnauthenticatedError("You can only update your own profile");
  }

  const user = await User.findById(normalizedId);
  if (!user) {
    throw new BadRequestError("User not found");
  }

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  const photo = sanitizeMediaUrl(profileImageUrl);
  if (photo) user.profileImage = photo;

  const { servicePreferences } = req.body;
  if (servicePreferences && user.role === "rider") {
    const normalized = normalizeServicePreferencesInput(servicePreferences);
    if (normalized) {
      if (!user.driverDetails) user.driverDetails = {};
      user.driverDetails.servicePreferences = {
        ...(user.driverDetails.servicePreferences?.toObject?.() ||
          user.driverDetails.servicePreferences ||
          {}),
        ...normalized,
      };
      user.markModified("driverDetails");
    }
  }

  await user.save();

  const payload = user.toObject ? user.toObject() : user;
  delete payload.password;

  res.status(StatusCodes.OK).json({
    message: "User updated successfully",
    user: payload,
  });
};

const SERVER_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const ACTIVE_TRIP_STATUSES = ["SEARCHING_FOR_RIDER", "START", "ARRIVED", "IN_PROGRESS"];
const OPEN_ORDER_STATUSES = ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP"];

/**
 * DELETE /auth/account — the signed-in customer or rider deletes their account (required by
 * Google Play). Personal data is removed and sign-in is blocked; trips, orders and payments are
 * kept, anonymised, for accounting. Signing in again with the same number starts a new account.
 */
export const deleteMyAccount = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || user.deletedAt) throw new UnauthenticatedError("Authentication invalid");
  if (!["customer", "rider"].includes(user.role)) {
    throw new BadRequestError("Staff accounts are removed by an administrator");
  }
  await closeUserAccount(user);
  res.status(StatusCodes.OK).json({ deleted: true });
};

/**
 * Close a customer or rider account the same way whoever asks (the user in the app, or an
 * admin): refuse while a trip, order or balance is open, delete their files, blank their
 * details and block sign-in. Trips, orders and payments stay, anonymised, for accounting.
 */
export async function closeUserAccount(user, { byAdmin = false } = {}) {
  const who = byAdmin ? "This account" : "You";
  const activeTrip = await Ride.exists({
    $or: [{ customer: user._id }, { rider: user._id }],
    status: { $in: ACTIVE_TRIP_STATUSES },
  });
  if (activeTrip) {
    throw new BadRequestError(
      byAdmin
        ? "This account has a trip in progress. Finish or cancel it first."
        : "Finish or cancel your current trip before deleting your account"
    );
  }
  const openOrder = await FoodOrder.exists({
    customer: user._id,
    status: { $in: OPEN_ORDER_STATUSES },
  });
  if (openOrder) {
    throw new BadRequestError(
      byAdmin
        ? "This account has an order in progress. Wait for it to finish or cancel it first."
        : "Wait for your current order to finish before deleting your account"
    );
  }

  if (user.role === "rider") {
    const balance = Math.round((Number(user.balance) || 0) * 100) / 100;
    if (balance < 0) {
      throw new BadRequestError(
        `${who} owe${byAdmin ? "s" : ""} ${formatCurrency(-balance)} in commission. Clear it before deleting ${byAdmin ? "the" : "your"} account.`
      );
    }
    if (balance > 0) {
      throw new BadRequestError(
        `${byAdmin ? "This rider has" : "You have"} ${formatCurrency(balance)} still to be paid out. Pay it out before deleting ${byAdmin ? "the" : "your"} account.`
      );
    }
  }

  // Remove the files themselves (photos, licence, ID, vehicle papers), not just the links.
  await deleteUserMedia(user);

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        name: "Deleted user",
        email: null,
        profileImage: null,
        pushTokens: [],
        isOnline: false,
        deletedAt: new Date(),
      },
      // Unset (not null) so the sparse unique indexes free the phone number for a new account.
      $unset: { phone: "", username: "", driverDetails: "" },
    }
  );
}

/** Best effort: a missing or already-deleted file must not block account deletion. */
async function deleteUserMedia(user) {
  const d = user.driverDetails || {};
  const urls = [
    user.profileImage,
    d.profileImage,
    d.licenseFront,
    d.licenseBack,
    d.nationalId,
    d.policeClearance,
    d.vehicle?.registrationDoc,
    d.vehicle?.insuranceDoc,
  ].filter((u) => typeof u === "string" && u.trim());

  await Promise.all(
    [...new Set(urls)].map(async (url) => {
      try {
        const cloud = parseCloudinaryUrl(url);
        if (cloud) {
          await deleteFromCloudinary(cloud.publicId, cloud.resourceType);
          return;
        }
        if (url.startsWith("/uploads/")) {
          const abs = path.join(SERVER_ROOT, url.split("?")[0]);
          if (abs.startsWith(path.join(SERVER_ROOT, "uploads") + path.sep)) safeUnlink(abs);
        }
      } catch (err) {
        console.warn("[account-delete] could not remove file:", url, err?.message || err);
      }
    })
  );
}
