/**
 * Top-up (clear debt) and Hubtel webhook.
 */
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import PendingTopUp from '../models/PendingTopUp.js';
import { StatusCodes } from 'http-status-codes';
import { BadRequestError } from '../errors/index.js';

/** POST /ride/top-up - Temporary direct debt clearance (Hubtel bypass). */
export const initiateTopUp = async (req, res) => {
  const driverId = req.user.id;
  const { amount: requestedAmount } = req.body;

  const user = await User.findById(driverId).select('balance name phone role driverDetails');
  if (!user || user.role !== 'rider') {
    throw new BadRequestError('Only riders can top up');
  }

  const balance = Number(user.balance ?? 0);
  if (balance >= 0) {
    return res.status(StatusCodes.OK).json({
      message: 'No debt to clear',
      balance,
      paymentRequired: false,
    });
  }

  const requested = requestedAmount ? Math.abs(Number(requestedAmount)) : 0;
  if (requestedAmount != null && (!Number.isFinite(requested) || requested <= 0)) {
    throw new BadRequestError('Invalid amount');
  }
  const amountToClear = requested > 0 ? Math.min(requested, Math.abs(balance)) : Math.abs(balance);
  const newBalance = balance + amountToClear;
  await User.findByIdAndUpdate(driverId, { balance: newBalance });
  await Transaction.create({
    driver: driverId,
    amount: amountToClear,
    type: 'TOP_UP',
    note: 'Clear debt (manual temporary)',
    balanceAfter: newBalance,
  });
  if (user.driverDetails?.status === 'suspended_debt' && newBalance >= 0) {
    await User.findByIdAndUpdate(driverId, { 'driverDetails.status': 'active' });
  }

  res.status(StatusCodes.OK).json({
    message: 'Debt cleared successfully',
    paymentRequired: false,
    amount: amountToClear,
    balance: newBalance,
  });
};

/**
 * POST /webhooks/hubtel - Hubtel callback when payment succeeds/fails.
 * Body shape may vary; common: ClientReference, Status, Data.
 */
export const hubtelWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const clientReference = body.ClientReference || body.Data?.ClientReference;
    const status = (body.Status || body.Data?.Status || '').toString().toLowerCase();

    if (!clientReference || !clientReference.startsWith('topup_')) {
      return res.status(StatusCodes.OK).json({ received: true });
    }

    const pending = await PendingTopUp.findOne({ clientReference, status: 'pending' });
    if (!pending) {
      return res.status(StatusCodes.OK).json({ received: true });
    }

    if (status === 'success' || status === 'completed') {
      const driver = await User.findById(pending.driver);
      if (driver) {
        const currentBalance = Number(driver.balance ?? 0);
        const newBalance = currentBalance + pending.amount;
        await User.findByIdAndUpdate(pending.driver, { balance: newBalance });
        await Transaction.create({
          driver: pending.driver,
          amount: pending.amount,
          type: 'TOP_UP',
          note: 'Clear debt (Hubtel)',
          balanceAfter: newBalance,
        });
        if (driver.driverDetails?.status === 'suspended_debt' && newBalance >= 0) {
          await User.findByIdAndUpdate(pending.driver, { 'driverDetails.status': 'active' });
        }
      }
      pending.status = 'completed';
    } else {
      pending.status = 'failed';
    }
    pending.hubtelResponse = body;
    await pending.save();
  } catch (err) {
    console.error('Hubtel webhook error:', err);
  }
  res.status(StatusCodes.OK).json({ received: true });
};
