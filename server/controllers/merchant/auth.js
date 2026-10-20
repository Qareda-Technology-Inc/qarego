import User from "../../models/User.js";
import Restaurant from "../../models/Restaurant.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError } from "../../errors/index.js";
import { normalizePhone } from "../../utils/phone.js";

/** POST /auth/merchant/login — vendor (merchant) or cook login */
export const merchantLogin = async (req, res) => {
  const { password } = req.body;
  const login = String(req.body.username || "").trim();
  if (!login || !password) {
    throw new BadRequestError("Please provide your username or phone, and your password");
  }

  // Vendors can sign in with their phone number too (024…, 24…, +23324…).
  let user = await User.findOne({ username: login }).select("+password");
  if (!user && /^[+\d\s-]{9,16}$/.test(login)) {
    user = await User.findOne({
      phone: normalizePhone(login),
      role: { $in: ["merchant", "cook"] },
    }).select("+password");
  }
  if (!user) {
    throw new UnauthenticatedError("Invalid Credentials");
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError("Invalid Credentials");
  }

  if (user.role !== "merchant" && user.role !== "cook") {
    throw new UnauthenticatedError("Access Denied: not a restaurant account");
  }

  if (user.isSuspended) {
    throw new UnauthenticatedError("Account disabled. Contact your manager.");
  }

  let restaurants = [];
  if (user.role === "merchant") {
    // A merchant can own/operate many stores (may be empty until they create one)
    restaurants = await Restaurant.find({ owner: user._id })
      .select("name imageEmoji vertical")
      .sort({ createdAt: 1 })
      .lean();
  } else {
    if (!user.restaurant) {
      throw new UnauthenticatedError("No restaurant is linked to this account yet");
    }
    const r = await Restaurant.findById(user.restaurant).select("name imageEmoji vertical").lean();
    if (!r) {
      throw new UnauthenticatedError("No restaurant is linked to this account yet");
    }
    restaurants = [r];
  }

  const accessToken = user.createAccessToken();
  const refreshToken = user.createRefreshToken();

  res.status(StatusCodes.OK).json({
    user: {
      userId: user._id,
      name: user.name,
      role: user.role,
      mustChangePassword: !!user.mustChangePassword,
    },
    restaurants,
    accessToken,
    refreshToken,
  });
};

/**
 * POST /merchant/password { currentPassword, newPassword } — choose your own password
 * (required after an invite or reset, and available any time from Settings).
 */
export const changeMyPassword = async (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");
  if (!currentPassword) throw new BadRequestError("Enter your current password");
  if (newPassword.length < 8) throw new BadRequestError("Use at least 8 characters for your new password");
  if (newPassword === currentPassword) throw new BadRequestError("Choose a password different from the current one");

  const user = await User.findById(req.user.id).select("+password");
  if (!user || (user.role !== "merchant" && user.role !== "cook")) {
    throw new UnauthenticatedError("Merchant access required");
  }
  if (!(await user.comparePassword(currentPassword))) {
    throw new BadRequestError("Your current password isn't right");
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();
  res.status(StatusCodes.OK).json({ message: "Password changed" });
};
