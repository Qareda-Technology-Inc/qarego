import User from "../../models/User.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, NotFoundError } from "../../errors/index.js";
import { normalizePhone } from "../../utils/phone.js";

/** GET /merchant/cooks — staff for my restaurant */
export const listMyCooks = async (req, res) => {
  const cooks = await User.find({ role: "cook", restaurant: req.restaurantId })
    .select("name username phone isSuspended createdAt")
    .sort({ createdAt: -1 })
    .lean();
  res.status(StatusCodes.OK).json({ cooks });
};

/** POST /merchant/cooks — owner creates a cook login */
export const createCook = async (req, res) => {
  const { username, password, name, phone } = req.body;
  if (!username || !password) {
    throw new BadRequestError("Username and password are required");
  }

  const existing = await User.findOne({ username: username.trim() });
  if (existing) {
    throw new BadRequestError("That username is already taken");
  }

  const cook = await User.create({
    role: "cook",
    username: username.trim(),
    password,
    name: name?.trim() || username.trim(),
    phone: phone ? normalizePhone(phone) : undefined,
    restaurant: req.restaurantId,
    createdBy: req.user.id,
  });

  res.status(StatusCodes.CREATED).json({
    message: "Cook added",
    cook: {
      _id: cook._id,
      name: cook.name,
      username: cook.username,
      phone: cook.phone,
      isSuspended: cook.isSuspended,
    },
  });
};

/** PATCH /merchant/cooks/:id — owner updates name, resets password, or disables */
export const updateCook = async (req, res) => {
  const cook = await User.findOne({
    _id: req.params.id,
    role: "cook",
    restaurant: req.restaurantId,
  }).select("+password");
  if (!cook) throw new NotFoundError("Cook not found");

  const { name, password, phone, isSuspended } = req.body;
  if (name !== undefined) cook.name = name.trim();
  if (phone !== undefined) cook.phone = phone ? normalizePhone(phone) : cook.phone;
  if (typeof isSuspended === "boolean") cook.isSuspended = isSuspended;
  if (password) cook.password = password;

  await cook.save();

  res.status(StatusCodes.OK).json({
    message: "Cook updated",
    cook: {
      _id: cook._id,
      name: cook.name,
      username: cook.username,
      phone: cook.phone,
      isSuspended: cook.isSuspended,
    },
  });
};

/** DELETE /merchant/cooks/:id — owner removes a cook */
export const deleteCook = async (req, res) => {
  const cook = await User.findOneAndDelete({
    _id: req.params.id,
    role: "cook",
    restaurant: req.restaurantId,
  });
  if (!cook) throw new NotFoundError("Cook not found");
  res.status(StatusCodes.OK).json({ message: "Cook removed" });
};
