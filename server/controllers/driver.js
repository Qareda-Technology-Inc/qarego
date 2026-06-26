
import User from '../models/User.js';
import { StatusCodes } from 'http-status-codes';
import { BadRequestError, NotFoundError, UnauthenticatedError } from '../errors/index.js';
import { normalizePhone } from '../utils/phone.js';
import { persistMulterFile, sanitizeMediaUrl, resolveMediaUrl } from '../utils/mediaStorage.js';

function withResolvedDriverMedia(driver, req) {
  const doc = driver?.toObject ? driver.toObject() : { ...driver };
  const d = doc.driverDetails;
  if (!d) return doc;
  const resolve = (v) => (v ? resolveMediaUrl(v, req) || v : v);
  return {
    ...doc,
    driverDetails: {
      ...d,
      profileImage: resolve(d.profileImage),
      licenseFront: resolve(d.licenseFront),
      licenseBack: resolve(d.licenseBack),
      nationalId: resolve(d.nationalId),
      policeClearance: resolve(d.policeClearance),
      vehicle: d.vehicle
        ? {
            ...d.vehicle,
            registrationDoc: resolve(d.vehicle.registrationDoc),
            insuranceDoc: resolve(d.vehicle.insuranceDoc),
          }
        : d.vehicle,
    },
  };
}

function getFile(req, fieldName, index = 0) {
  if (req.files?.[fieldName]?.[index]) return req.files[fieldName][index];
  return null;
}

function documentUrlsFromBody(body) {
  return {
    profileImage: sanitizeMediaUrl(body.profileImageUrl),
    licenseFront: sanitizeMediaUrl(body.licenseFrontUrl),
    licenseBack: sanitizeMediaUrl(body.licenseBackUrl),
    nationalId: sanitizeMediaUrl(body.nationalIdUrl),
    policeClearance: sanitizeMediaUrl(body.policeClearanceUrl),
    registrationDoc: sanitizeMediaUrl(body.registrationDocUrl),
    insuranceDoc: sanitizeMediaUrl(body.insuranceDocUrl),
  };
}

function pickUrl(preferred, fallback) {
  return preferred || fallback || null;
}

function isCourierOnboarding(driver) {
  const status = driver.driverDetails?.status;
  return !status || status === 'pending';
}

function bodyHasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function assertNoAdminOnlyFields(body, fields) {
  const blocked = fields.filter((key) => bodyHasValue(body[key]));
  if (blocked.length > 0) {
    throw new BadRequestError(
      `Only admin can update: ${blocked.join(', ')}. Contact support if you need changes.`
    );
  }
}

async function applyProfileImage(driver, urls, profileFile) {
  if (urls.profileImage) driver.driverDetails.profileImage = urls.profileImage;
  else if (profileFile) {
    driver.driverDetails.profileImage = await persistMulterFile(profileFile, 'drivers/profile');
  }
}

async function applyLicenseAndIdDocs(driver, urls, files) {
  const { licenseFrontFile, licenseBackFile, nationalIdFile } = files;
  if (urls.licenseFront) driver.driverDetails.licenseFront = urls.licenseFront;
  else if (licenseFrontFile) {
    driver.driverDetails.licenseFront = await persistMulterFile(
      licenseFrontFile,
      'drivers/license'
    );
  }
  if (urls.licenseBack) driver.driverDetails.licenseBack = urls.licenseBack;
  else if (licenseBackFile) {
    driver.driverDetails.licenseBack = await persistMulterFile(
      licenseBackFile,
      'drivers/license'
    );
  }
  if (urls.nationalId) driver.driverDetails.nationalId = urls.nationalId;
  else if (nationalIdFile) {
    driver.driverDetails.nationalId = await persistMulterFile(
      nationalIdFile,
      'drivers/documents'
    );
  }
}

async function applyVehicleRegistrationDocs(driver, urls, files) {
  const { registrationFile, insuranceFile } = files;
  if (!driver.driverDetails.vehicle) driver.driverDetails.vehicle = {};
  if (urls.registrationDoc) {
    driver.driverDetails.vehicle.registrationDoc = urls.registrationDoc;
  } else if (registrationFile) {
    driver.driverDetails.vehicle.registrationDoc = await persistMulterFile(
      registrationFile,
      'drivers/vehicle'
    );
  }
  if (urls.insuranceDoc) {
    driver.driverDetails.vehicle.insuranceDoc = urls.insuranceDoc;
  } else if (insuranceFile) {
    driver.driverDetails.vehicle.insuranceDoc = await persistMulterFile(
      insuranceFile,
      'drivers/vehicle'
    );
  }
}

function applyVehicleFields(driver, body) {
  const { makeModel, year, plateNumber, color, make, model } = body;
  if (!driver.driverDetails.vehicle) driver.driverDetails.vehicle = {};

  if (make) driver.driverDetails.vehicle.make = make;
  if (model) driver.driverDetails.vehicle.model = model;

  if (makeModel) {
    let vehicleMake = 'Unknown';
    let vehicleModel = 'Unknown';
    if (typeof makeModel === 'string') {
      const parts = makeModel.trim().split(' ');
      if (parts.length > 0) {
        vehicleMake = parts[0];
        vehicleModel = parts.slice(1).join(' ') || parts[0];
      }
    }
    driver.driverDetails.vehicle.make = vehicleMake;
    driver.driverDetails.vehicle.model = vehicleModel;
  }
  if (year) driver.driverDetails.vehicle.year = year;
  if (plateNumber) driver.driverDetails.vehicle.plateNumber = plateNumber;
  if (color) driver.driverDetails.vehicle.color = color;
}

function courierAttemptedOnboardingFields(body, files) {
  return (
    bodyHasValue(body.make) ||
    bodyHasValue(body.model) ||
    bodyHasValue(body.makeModel) ||
    bodyHasValue(body.year) ||
    bodyHasValue(body.plateNumber) ||
    bodyHasValue(body.color) ||
    bodyHasValue(body.licenseFrontUrl) ||
    bodyHasValue(body.licenseBackUrl) ||
    bodyHasValue(body.nationalIdUrl) ||
    bodyHasValue(body.registrationDocUrl) ||
    bodyHasValue(body.insuranceDocUrl) ||
    files.licenseFrontFile ||
    files.licenseBackFile ||
    files.nationalIdFile ||
    files.registrationFile ||
    files.insuranceFile
  );
}

async function buildDriverDetailsFromBody(req) {
  const {
    dob,
    gender,
    makeModel,
    year,
    plateNumber,
    color,
    category,
  } = req.body;

  let vehicleMake = 'Unknown';
  let vehicleModel = 'Unknown';
  if (makeModel && typeof makeModel === 'string') {
    const parts = makeModel.trim().split(' ');
    if (parts.length > 0) {
      vehicleMake = parts[0];
      vehicleModel = parts.slice(1).join(' ') || parts[0];
    }
  }

  const validCategories = ['motorcycle', 'pragya', 'comfort'];
  const vehicleCategory =
    category && validCategories.includes(category) ? category : 'motorcycle';

  const urls = documentUrlsFromBody(req.body);
  const profileFile = getFile(req, 'profileImage');
  const licenseFrontFile =
    getFile(req, 'licenseFront') || getFile(req, 'license', 0);
  const licenseBackFile = getFile(req, 'licenseBack') || getFile(req, 'license', 1);
  const nationalIdFile = getFile(req, 'nationalId');
  const policeClearanceFile = getFile(req, 'policeClearance');
  const registrationFile = getFile(req, 'registration');
  const insuranceFile = getFile(req, 'insurance');

  const [
    profileImage,
    licenseFront,
    licenseBack,
    nationalId,
    policeClearance,
    registrationDoc,
    insuranceDoc,
  ] = await Promise.all([
    profileFile ? persistMulterFile(profileFile, 'drivers/profile') : null,
    licenseFrontFile ? persistMulterFile(licenseFrontFile, 'drivers/license') : null,
    licenseBackFile ? persistMulterFile(licenseBackFile, 'drivers/license') : null,
    nationalIdFile ? persistMulterFile(nationalIdFile, 'drivers/documents') : null,
    policeClearanceFile ? persistMulterFile(policeClearanceFile, 'drivers/documents') : null,
    registrationFile ? persistMulterFile(registrationFile, 'drivers/vehicle') : null,
    insuranceFile ? persistMulterFile(insuranceFile, 'drivers/vehicle') : null,
  ]);

  return {
    dob,
    gender,
    profileImage: pickUrl(profileImage, urls.profileImage),
    licenseFront: pickUrl(licenseFront, urls.licenseFront),
    licenseBack: pickUrl(licenseBack, urls.licenseBack),
    nationalId: pickUrl(nationalId, urls.nationalId),
    policeClearance: pickUrl(policeClearance, urls.policeClearance),
    vehicle: {
      make: vehicleMake,
      model: vehicleModel,
      year,
      plateNumber,
      color,
      category: vehicleCategory,
      registrationDoc: pickUrl(registrationDoc, urls.registrationDoc),
      insuranceDoc: pickUrl(insuranceDoc, urls.insuranceDoc),
    },
    status: 'pending',
  };
}

export const registerDriver = async (req, res) => {
  const {
    fullName,
    email,
    phone: rawPhone,
    dob,
    gender,
    makeModel,
    year,
    plateNumber,
    color,
    category,
  } = req.body;

  const phone = normalizePhone(rawPhone);

  if (!phone || !fullName || !plateNumber) {
    throw new BadRequestError('Full name, phone, and license plate are required');
  }

  const existingUser = await User.findOne({ phone });

  if (existingUser?.role === 'rider') {
    throw new BadRequestError('A driver with this phone number already exists');
  }

  if (existingUser?.role === 'admin') {
    throw new BadRequestError('This phone number belongs to an admin account');
  }

  const driverDetails = await buildDriverDetailsFromBody(req);

  if (existingUser?.role === 'customer') {
    existingUser.role = 'rider';
    existingUser.name = fullName;
    if (email) existingUser.email = email;
    existingUser.driverDetails = {
      ...driverDetails,
      status: existingUser.driverDetails?.status || 'pending',
    };
    existingUser.markModified('driverDetails');
    await existingUser.save();

    return res.status(StatusCodes.OK).json({
      message: 'Customer upgraded to driver successfully',
      driver: {
        id: existingUser._id,
        name: existingUser.name,
        phone: existingUser.phone,
        status: existingUser.driverDetails.status,
      },
    });
  }

  const user = await User.create({
    name: fullName,
    email,
    phone,
    role: 'rider',
    driverDetails,
  });

  res.status(StatusCodes.CREATED).json({
    message: 'Driver registered successfully',
    driver: {
      id: user._id,
      name: user.name,
      phone: user.phone,
      status: user.driverDetails.status,
    },
  });
};

export const getAllDrivers = async (req, res) => {
  const drivers = await User.find({ role: 'rider' })
    .select(
      'name phone email driverDetails totalRatings averageRating balance createdAt isOnline'
    )
    .sort({ isOnline: -1, name: 1 })
    .lean();
  res.status(StatusCodes.OK).json({ drivers });
};

export const getDriver = async (req, res) => {
  const { id } = req.params;
  const driver = await User.findOne({ _id: id, role: 'rider' });

  if (!driver) {
    throw new NotFoundError(`No driver found with id ${id}`);
  }

  res.status(StatusCodes.OK).json({ driver: withResolvedDriverMedia(driver, req) });
};

export const updateDriver = async (req, res) => {
  const { id } = req.params;

  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && String(req.user.id) !== String(id)) {
    throw new UnauthenticatedError('Not authorized to update this profile');
  }

  const driver = await User.findOne({ _id: id, role: 'rider' });
  if (!driver) {
    throw new NotFoundError(`No driver found with id ${id}`);
  }

  if (!driver.driverDetails) driver.driverDetails = {};

  const urls = documentUrlsFromBody(req.body);
  const profileFile = getFile(req, 'profileImage');
  const licenseFrontFile =
    getFile(req, 'licenseFront') || getFile(req, 'license', 0);
  const licenseBackFile = getFile(req, 'licenseBack') || getFile(req, 'license', 1);
  const nationalIdFile = getFile(req, 'nationalId');
  const policeClearanceFile = getFile(req, 'policeClearance');
  const registrationFile = getFile(req, 'registration');
  const insuranceFile = getFile(req, 'insurance');
  const files = {
    licenseFrontFile,
    licenseBackFile,
    nationalIdFile,
    policeClearanceFile,
    registrationFile,
    insuranceFile,
  };

  if (!isAdmin) {
    assertNoAdminOnlyFields(req.body, [
      'status',
      'category',
      'phone',
      'dob',
      'gender',
      'policeClearanceUrl',
    ]);

    if (policeClearanceFile || bodyHasValue(urls.policeClearance)) {
      throw new BadRequestError(
        'Police clearance is uploaded by admin during verification.'
      );
    }

    const onboarding = isCourierOnboarding(driver);
    if (!onboarding && courierAttemptedOnboardingFields(req.body, files)) {
      throw new BadRequestError(
        'Vehicle and compliance documents can only be updated while your account is pending approval. Contact admin for changes.'
      );
    }

    const { name, email } = req.body;
    if (name) driver.name = name;
    if (email) driver.email = email;
    await applyProfileImage(driver, urls, profileFile);

    if (onboarding) {
      applyVehicleFields(driver, req.body);
      await applyLicenseAndIdDocs(driver, urls, files);
      await applyVehicleRegistrationDocs(driver, urls, files);
    }

    driver.markModified('driverDetails');
    await driver.save();
    return res
      .status(StatusCodes.OK)
      .json({ driver: withResolvedDriverMedia(driver, req) });
  }

  const {
    name,
    phone: rawPhone,
    email,
    status,
    dob,
    gender,
    makeModel,
    year,
    plateNumber,
    color,
    category,
    make,
    model,
  } = req.body;

  if (name) driver.name = name;
  if (rawPhone) driver.phone = normalizePhone(rawPhone);
  if (email) driver.email = email;

  if (dob) driver.driverDetails.dob = dob;
  if (gender) driver.driverDetails.gender = gender;
  const validStatuses = ['active', 'pending', 'suspended', 'suspended_debt'];
  if (status && validStatuses.includes(status)) driver.driverDetails.status = status;

  await applyProfileImage(driver, urls, profileFile);
  await applyLicenseAndIdDocs(driver, urls, files);

  if (urls.policeClearance) driver.driverDetails.policeClearance = urls.policeClearance;
  else if (policeClearanceFile) {
    driver.driverDetails.policeClearance = await persistMulterFile(
      policeClearanceFile,
      'drivers/documents'
    );
  }

  applyVehicleFields(driver, { makeModel, year, plateNumber, color, make, model });
  const validCategories = ['motorcycle', 'pragya', 'comfort'];
  if (category && validCategories.includes(category)) {
    if (!driver.driverDetails.vehicle) driver.driverDetails.vehicle = {};
    driver.driverDetails.vehicle.category = category;
  }

  await applyVehicleRegistrationDocs(driver, urls, files);

  driver.markModified('driverDetails');
  await driver.save();

  res.status(StatusCodes.OK).json({ driver: withResolvedDriverMedia(driver, req) });
};

export const deleteDriver = async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'admin') {
    throw new UnauthenticatedError('Only admin can remove driver accounts');
  }

  const driver = await User.findOneAndDelete({ _id: id, role: 'rider' });

  if (!driver) {
    throw new NotFoundError(`No driver found with id ${id}`);
  }

  res.status(StatusCodes.OK).json({ message: 'Driver removed successfully' });
};
