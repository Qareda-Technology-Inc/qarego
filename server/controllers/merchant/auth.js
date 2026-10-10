import User from "../../models/User.js";
import Restaurant from "../../models/Restaurant.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError } from "../../errors/index.js";

/** POST /auth/merchant/login — vendor (merchant) or cook login */
export const merchantLogin = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    throw new BadRequestError("Please provide username and password");
  }

  const user = await User.findOne({ username }).select("+password");
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
    },
    restaurants,
    accessToken,
    refreshToken,
  });
};
