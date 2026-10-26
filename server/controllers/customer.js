
import User from '../models/User.js';
import LateCancellation from '../models/LateCancellation.js';
import { StatusCodes } from 'http-status-codes';
import { BadRequestError, NotFoundError } from '../errors/index.js';
import { normalizePhone } from '../utils/phone.js';
import { closeUserAccount } from './auth.js';
import Ride from '../models/Ride.js';
import FoodOrder from '../models/FoodOrder.js';

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
  const customers = await User.find({ role: 'customer', deletedAt: null }).select('name phone email averageRating totalRatings isSuspended createdAt');
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
  const { name, phone, email, isSuspended, bookingBlockedUntil } = req.body;

  const customer = await User.findOne({ _id: id, role: 'customer' });
  if (!customer) {
    throw new NotFoundError(`No customer found with id ${id}`);
  }

  if (name !== undefined) customer.name = name;
  if (phone !== undefined) customer.phone = normalizePhone(phone);
  if (email !== undefined) customer.email = email;
  if (typeof isSuspended === 'boolean') customer.isSuspended = isSuspended;
  // Admin lifts a late-cancel booking block (null), or sets one.
  if (bookingBlockedUntil !== undefined) {
    customer.bookingBlockedUntil = bookingBlockedUntil ? new Date(bookingBlockedUntil) : null;
  }

  await customer.save();

  res.status(StatusCodes.OK).json({ customer });
};

/**
 * DELETE /customers/:id — close the account like the in-app "Delete account": details are
 * removed and sign-in blocked, but their trips and orders stay (anonymised) for the books.
 */
export const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  const customer = await User.findOne({ _id: id, role: 'customer', deletedAt: null });
  if (!customer) {
    throw new NotFoundError(`No customer found with id ${id}`);
  }
  await closeUserAccount(customer, { byAdmin: true });
  res.status(StatusCodes.OK).json({ message: 'Customer account closed' });
};

/** GET /customers/:id/history — profile, recent trips and orders, and lifetime totals. */
export const getCustomerHistory = async (req, res) => {
  const customer = await User.findOne({ _id: req.params.id, role: 'customer' })
    .select('name phone email averageRating totalRatings isSuspended createdAt deletedAt bookingBlockedUntil')
    .lean();
  if (!customer) throw new NotFoundError('Customer not found');

  const [rides, orders, tripTotals, orderTotals, lateCancels] = await Promise.all([
    Ride.find({ customer: customer._id, foodOrder: null })
      .select('serviceType status fare pickup.address drop.address rider createdAt paymentMethod')
      .populate('rider', 'name phone')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    FoodOrder.find({ customer: customer._id })
      .select('restaurantName restaurant status total createdAt paymentMethod fulfillmentType cancelReason')
      .populate('restaurant', 'vertical imageEmoji')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Ride.aggregate([
      { $match: { customer: customer._id, foodOrder: null, status: 'COMPLETED' } },
      { $group: { _id: null, count: { $sum: 1 }, spent: { $sum: '$fare' } } },
    ]),
    FoodOrder.aggregate([
      { $match: { customer: customer._id, status: 'DELIVERED' } },
      { $group: { _id: null, count: { $sum: 1 }, spent: { $sum: '$total' } } },
    ]),
    LateCancellation.find({ customer: customer._id })
      .select('serviceType stage riderPaid pickup createdAt rider')
      .populate('rider', 'name')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  res.status(StatusCodes.OK).json({
    customer,
    totals: {
      trips: tripTotals[0]?.count || 0,
      orders: orderTotals[0]?.count || 0,
      spent: round2((tripTotals[0]?.spent || 0) + (orderTotals[0]?.spent || 0)),
    },
    rides,
    orders,
    lateCancels,
  });
};
