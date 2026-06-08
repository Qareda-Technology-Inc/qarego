
import User from '../models/User.js';
import { StatusCodes } from 'http-status-codes';
import { BadRequestError, NotFoundError } from '../errors/index.js';
import { normalizePhone } from '../utils/phone.js';

export const createCustomer = async (req, res) => {
  const { name, phone: rawPhone, email } = req.body;
  const phone = normalizePhone(rawPhone);
  
  if (!phone) {
    throw new BadRequestError('Phone number is required');
  }

  const existingUser = await User.findOne({ phone });
  if (existingUser) {
    throw new BadRequestError(
      existingUser.role === 'rider'
        ? 'This phone is registered as a driver'
        : 'User with this phone number already exists'
    );
  }

  const customer = await User.create({
    name,
    phone,
    email,
    role: 'customer'
  });

  res.status(StatusCodes.CREATED).json({ customer });
};

export const getAllCustomers = async (req, res) => {
  const customers = await User.find({ role: 'customer' }).select('name phone email averageRating totalRatings isSuspended createdAt');
  res.status(StatusCodes.OK).json({ customers });
};

export const getCustomer = async (req, res) => {
  const { id } = req.params;
  const customer = await User.findOne({ _id: id, role: 'customer' });
  
  if (!customer) {
    throw new NotFoundError(`No customer found with id ${id}`);
  }
  
  res.status(StatusCodes.OK).json({ customer });
};

export const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, isSuspended } = req.body;

  const customer = await User.findOne({ _id: id, role: 'customer' });
  if (!customer) {
    throw new NotFoundError(`No customer found with id ${id}`);
  }

  if (name !== undefined) customer.name = name;
  if (phone !== undefined) customer.phone = normalizePhone(phone);
  if (email !== undefined) customer.email = email;
  if (typeof isSuspended === 'boolean') customer.isSuspended = isSuspended;

  await customer.save();

  res.status(StatusCodes.OK).json({ customer });
};

export const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  const customer = await User.findOneAndDelete({ _id: id, role: 'customer' });

  if (!customer) {
    throw new NotFoundError(`No customer found with id ${id}`);
  }

  res.status(StatusCodes.OK).json({ message: 'Customer removed successfully' });
};
