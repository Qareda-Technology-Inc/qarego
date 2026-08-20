import User from "../models/User.js";

/** Google Play / App Store review accounts. */
export const REVIEW_CUSTOMER = {
  role: "customer",
  otp: "0000",
  canonicalPhone: "+233000000000",
  name: "Google Review Customer",
};

export const REVIEW_RIDER = {
  role: "rider",
  otp: "1111",
  canonicalPhone: "+233111111111",
  name: "Google Review Rider",
};

export function isReviewLoginEnabled() {
  return process.env.REVIEW_LOGIN_ENABLED !== "false";
}

function localDigits(rawPhone) {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("233")) local = local.slice(3);
  if (local.startsWith("0") && local.length >= 10) local = local.slice(1);
  return { digits, local };
}

/**
 * Match 0000000000 (customer) and 1111111111 (rider) in local or E.164 form.
 */
export function getReviewAccount(rawPhone) {
  if (!isReviewLoginEnabled() || rawPhone == null || rawPhone === "") {
    return null;
  }

  const { digits, local } = localDigits(rawPhone);

  if (/^0{9,}$/.test(local) || /^0{9,}$/.test(digits)) {
    return REVIEW_CUSTOMER;
  }
  if (/^1{9,}$/.test(local) || /^1{9,}$/.test(digits)) {
    return REVIEW_RIDER;
  }
  return null;
}

export async function ensureReviewUser(account) {
  let user = await User.findOne({ phone: account.canonicalPhone });

  if (!user) {
    user = new User({
      phone: account.canonicalPhone,
      role: account.role,
      name: account.name,
    });
  }

  user.role = account.role;
  if (!user.name) user.name = account.name;
  user.isSuspended = false;

  if (account.role === "rider") {
    if (!user.driverDetails) user.driverDetails = {};
    user.driverDetails.status = "active";
    user.driverDetails.licenseNumber =
      user.driverDetails.licenseNumber || "REVIEW-1111";
    if (!user.driverDetails.vehicle) user.driverDetails.vehicle = {};
    user.driverDetails.vehicle.make =
      user.driverDetails.vehicle.make || "Honda";
    user.driverDetails.vehicle.model =
      user.driverDetails.vehicle.model || "Review Bike";
    user.driverDetails.vehicle.year =
      user.driverDetails.vehicle.year || "2024";
    user.driverDetails.vehicle.plateNumber =
      user.driverDetails.vehicle.plateNumber || "REVIEW-1111";
    user.driverDetails.vehicle.color =
      user.driverDetails.vehicle.color || "Black";
    user.driverDetails.vehicle.category =
      user.driverDetails.vehicle.category || "motorcycle";
    if (!user.driverDetails.servicePreferences) {
      user.driverDetails.servicePreferences = {
        RIDE: { enabled: true },
        DELIVERY: { enabled: true },
        FOOD: { enabled: true },
      };
    }
    user.driverDetails.servicePreset =
      user.driverDetails.servicePreset || "all";
    user.markModified("driverDetails");
  }

  await user.save();
  return user;
}
