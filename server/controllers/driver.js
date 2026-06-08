
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

  const driver = await User.findOne({ _id: id, role: 'rider' });
  if (!driver) {
    throw new NotFoundError(`No driver found with id ${id}`);
  }

  if (name) driver.name = name;
  if (rawPhone) driver.phone = normalizePhone(rawPhone);
  if (email) driver.email = email;

  if (!driver.driverDetails) driver.driverDetails = {};

  if (dob) driver.driverDetails.dob = dob;
  if (gender) driver.driverDetails.gender = gender;
  const validStatuses = ['active', 'pending', 'suspended', 'suspended_debt'];
  if (status && validStatuses.includes(status)) driver.driverDetails.status = status;

  const urls = documentUrlsFromBody(req.body);
  const profileFile = getFile(req, 'profileImage');
  const licenseFrontFile =
    getFile(req, 'licenseFront') || getFile(req, 'license', 0);
  const licenseBackFile = getFile(req, 'licenseBack') || getFile(req, 'license', 1);
  const nationalIdFile = getFile(req, 'nationalId');
  const policeClearanceFile = getFile(req, 'policeClearance');
  const registrationFile = getFile(req, 'registration');
  const insuranceFile = getFile(req, 'insurance');

  if (urls.profileImage) driver.driverDetails.profileImage = urls.profileImage;
  else if (profileFile) {
    driver.driverDetails.profileImage = await persistMulterFile(profileFile, 'drivers/profile');
  }
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
  if (urls.policeClearance) driver.driverDetails.policeClearance = urls.policeClearance;
  else if (policeClearanceFile) {
    driver.driverDetails.policeClearance = await persistMulterFile(
      policeClearanceFile,
      'drivers/documents'
    );
  }

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
  const validCategories = ['motorcycle', 'pragya', 'comfort'];
  if (category && validCategories.includes(category)) {
    driver.driverDetails.vehicle.category = category;
  }

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

  driver.markModified('driverDetails');
  await driver.save();

  res.status(StatusCodes.OK).json({ driver: withResolvedDriverMedia(driver, req) });
};

export const deleteDriver = async (req, res) => {
  const { id } = req.params;

  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && req.user.id !== id) {
    throw new UnauthenticatedError('Not authorized to delete this profile');
  }

  const driver = await User.findOneAndDelete({ _id: id, role: 'rider' });

  if (!driver) {
    throw new NotFoundError(`No driver found with id ${id}`);
  }

  res.status(StatusCodes.OK).json({ message: 'Driver removed successfully' });
};
