import User from "../models/User.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError } from "../errors/index.js";
import jwt from "jsonwebtoken";
import { sendOtpSMS } from "../utils/smsService.js";
import { normalizePhone } from "../utils/phone.js";
import { normalizeServicePreferencesInput } from "../utils/riderServicePreferences.js";
import { sanitizeMediaUrl } from "../utils/mediaStorage.js";

// Generate a 4-digit OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Store OTPs temporarily (in production, use Redis or similar)
const otpStore = new Map();

export const requestOtp = async (req, res) => {
  const { phone: rawPhone, method = "whatsapp" } = req.body;
  const phone = normalizePhone(rawPhone);

  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  try {
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with expiration (5 minutes)
    otpStore.set(phone, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      method, // Store the method used
    });

    // Send OTP via SMS (Arkasel)
    try {
      const smsResult = await sendOtpSMS(phone, otp);
      if (!smsResult.success && !smsResult.development) {
        console.error("Failed to send SMS via Arkasel:", smsResult.error);
        // Continue anyway - OTP is still stored and can be verified
        // In production, you might want to throw an error here
      }
    } catch (smsError) {
      console.error("Error sending SMS via Arkasel:", smsError.message);
      // In development, continue even if SMS fails
      // In production, you might want to throw an error or use fallback
      if (process.env.NODE_ENV === "production") {
        // Optionally throw error in production
        // throw new BadRequestError("Failed to send OTP. Please try again.");
      }
    }

    res.status(StatusCodes.OK).json({
      message: "OTP sent successfully via SMS",
      method: "sms",
      // In production, don't send OTP in response
      // For development, we'll send it so you can test
      otp: process.env.NODE_ENV === "development" ? otp : undefined,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new BadRequestError("Please provide username and password");
  }

  const user = await User.findOne({ username }).select('+password');
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

  const accessToken = user.createAccessToken();
  const refreshToken = user.createRefreshToken();

  res.status(StatusCodes.OK).json({
    user: {
      userId: user._id,
      name: user.name,
      role: user.role,
    },
    accessToken,
    refreshToken,
  });
};

export const verifyOtp = async (req, res) => {
  const { phone: rawPhone, otp } = req.body;
  const phone = normalizePhone(rawPhone);

  if (!phone || !otp) {
    throw new BadRequestError("Phone number and OTP are required");
  }

  try {
    // Check if OTP exists and is valid
    const storedOtp = otpStore.get(phone);
    
    if (!storedOtp) {
      throw new UnauthenticatedError("OTP not found or expired. Please request a new OTP.");
    }

    if (Date.now() > storedOtp.expiresAt) {
      otpStore.delete(phone);
      throw new UnauthenticatedError("OTP has expired. Please request a new OTP.");
    }

    if (storedOtp.otp !== otp) {
      throw new UnauthenticatedError("Invalid OTP. Please try again.");
    }

    // OTP is valid, remove it from store
    otpStore.delete(phone);

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
  } catch (error) {
    console.error(error);
    throw error;
  }
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

    if (!user) {
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
