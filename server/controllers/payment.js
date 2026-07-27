/**
 * Top-up (clear debt) and Hubtel webhook.
 */
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import PendingTopUp from '../models/PendingTopUp.js';
import FoodOrder from '../models/FoodOrder.js';
import FoodPayment from '../models/FoodPayment.js';
import Ride from '../models/Ride.js';
import { StatusCodes } from 'http-status-codes';
import { BadRequestError, NotFoundError } from '../errors/index.js';
import {
  checkOnlineCheckoutStatus,
  detectGhMomoChannel,
  extractCheckoutStatusFromHubtelPayload,
  formatPhoneForHubtel,
  initiateOnlineCheckout,
  makeShortHubtelRef,
  receivePayment,
  sendPayment,
} from '../utils/hubtelService.js';
import { getSettings, settleTrip } from '../utils/tripSettlement.js';
import { settleFoodOrderOnDelivery } from '../utils/foodOrderSettlement.js';
import { appendWebhookToken } from '../middleware/hubtelWebhookAuth.js';

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  if (process.env.PUBLIC_API_URL) return process.env.PUBLIC_API_URL;
  return `${req.protocol}://${req.get('host')}`;
}

function normalizeCheckoutStatus(rawStatus) {
  const value = String(rawStatus || '').toLowerCase();
  if (['success', 'completed', 'paid'].includes(value)) return 'success';
  if (['failed', 'unpaid', 'declined', 'error'].includes(value)) return 'failed';
  if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
  return 'pending';
}

function makeFoodReference(orderId) {
  const tail = String(orderId).slice(-8);
  const stamp = Date.now().toString(36).slice(-6);
  return `fo${tail}${stamp}`.slice(0, 32);
}

function makeRideReference(rideId) {
  const tail = String(rideId).slice(-8);
  const stamp = Date.now().toString(36).slice(-6);
  return `rd${tail}${stamp}`.slice(0, 32);
}

/**
 * Mark a mobile-money ride/parcel as paid and run the (deferred) settlement.
 * settleTrip is idempotent, so this is safe to call more than once.
 */
async function processRidePaymentSuccess(ride) {
  if (!ride) return;
  if (ride.paymentStatus === 'PAID') return;
  ride.paymentStatus = 'PAID';
  await ride.save();
  await settleTrip(ride);
}

async function processFoodPaymentSuccess(payment, payload) {
  if (!payment) return;
  if (payment.status === 'success') {
    // Checkout confirmed — restaurant/rider payouts run on delivery via settleFoodOrderOnDelivery.
    const order = await FoodOrder.findById(payment.order);
    if (order && order.paymentStatus !== 'PAID') {
      order.paymentStatus = 'PAID';
      order.paymentReference = payment.clientReference;
      await order.save();
    }
    if (payment.payoutStatus !== 'deferred') {
      payment.payoutStatus = 'deferred';
    }
    payment.status = 'success';
    payment.callbackPayload = payload || payment.callbackPayload;
    payment.paymentMethod =
      payload?.Data?.PaymentDetails?.PaymentType || payment.paymentMethod || 'mobilemoney';
    payment.paymentChannel =
      payload?.Data?.PaymentDetails?.Channel || payment.paymentChannel || null;
    payment.hubtelTransactionId = payload?.Data?.CheckoutId || payment.hubtelTransactionId;
    payment.externalTransactionId =
      payload?.Data?.SalesInvoiceId || payment.externalTransactionId;
    await payment.save();

    const readyForSettlement =
      order &&
      (order.status === 'DELIVERED' ||
        (order.fulfillmentType === 'PICKUP' && order.status === 'READY_FOR_PICKUP'));
    if (order && readyForSettlement && order.settlementStatus !== 'settled') {
      try {
        await settleFoodOrderOnDelivery(order._id);
      } catch (err) {
        console.error('Food settlement after payment error:', err);
      }
    }
    return;
  }

  const order = await FoodOrder.findById(payment.order);
  if (!order) return;

  order.paymentStatus = 'PAID';
  order.paymentReference = payment.clientReference;
  await order.save();

  payment.status = 'success';
  payment.callbackPayload = payload || payment.callbackPayload;
  payment.paymentMethod =
    payload?.Data?.PaymentDetails?.PaymentType || payment.paymentMethod || 'mobilemoney';
  payment.paymentChannel =
    payload?.Data?.PaymentDetails?.Channel || payment.paymentChannel || null;
  payment.hubtelTransactionId = payload?.Data?.CheckoutId || payment.hubtelTransactionId;
  payment.externalTransactionId =
    payload?.Data?.SalesInvoiceId || payment.externalTransactionId;
  payment.payoutStatus = 'deferred';
  payment.payoutAmount = 0;
  payment.payoutError = null;
  await payment.save();

  const readyForSettlement =
    order.status === 'DELIVERED' ||
    (order.fulfillmentType === 'PICKUP' && order.status === 'READY_FOR_PICKUP');
  if (readyForSettlement && order.settlementStatus !== 'settled') {
    try {
      await settleFoodOrderOnDelivery(order._id);
    } catch (err) {
      console.error('Food settlement after payment error:', err);
    }
  }
}

function isHubtelConfigured() {
  return Boolean(
    (process.env.HUBTEL_API_ID && process.env.HUBTEL_API_KEY) ||
      (process.env.HUBTEL_CLIENT_ID && process.env.HUBTEL_CLIENT_SECRET)
  );
}

/** Credit driver balance when Hubtel confirms a debt top-up. */
async function completePendingTopUp(pending, hubtelResponse = null) {
  if (!pending?._id) return false;

  // Atomic claim — prevents double-credit from concurrent webhook + poll.
  const claimed = await PendingTopUp.findOneAndUpdate(
    { _id: pending._id, status: 'pending' },
    { $set: { status: 'completed', hubtelResponse: hubtelResponse || pending.hubtelResponse } },
    { new: true }
  );
  if (!claimed) return false;

  const driver = await User.findById(claimed.driver).select('balance driverDetails');
  if (!driver) {
    await PendingTopUp.findByIdAndUpdate(claimed._id, { status: 'failed' });
    return false;
  }

  const currentBalance = Number(driver.balance ?? 0);
  const newBalance = currentBalance + claimed.amount;
  await User.findByIdAndUpdate(claimed.driver, { balance: newBalance });
  await Transaction.create({
    driver: claimed.driver,
    amount: claimed.amount,
    type: 'TOP_UP',
    note: 'Clear debt (Hubtel)',
    reference: claimed.clientReference,
    balanceAfter: newBalance,
  });
  if (driver.driverDetails?.status === 'suspended_debt' && newBalance >= 0) {
    await User.findByIdAndUpdate(claimed.driver, { 'driverDetails.status': 'active' });
  }

  return true;
}

/** POST /ride/top-up — MoMo prompt to clear commission debt via Hubtel. */
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
  if (!user.phone) {
    throw new BadRequestError('Add a phone number to your profile before clearing debt');
  }

  const existingPending = await PendingTopUp.findOne({ driver: driverId, status: 'pending' });
  if (existingPending) {
    return res.status(StatusCodes.OK).json({
      message: 'Approve the MoMo prompt on your phone to clear your debt.',
      paymentRequired: true,
      pending: true,
      clientReference: existingPending.clientReference,
      amount: existingPending.amount,
      balance,
    });
  }

  const requested = requestedAmount ? Math.abs(Number(requestedAmount)) : 0;
  if (requestedAmount != null && (!Number.isFinite(requested) || requested <= 0)) {
    throw new BadRequestError('Invalid amount');
  }
  const amountToClear = requested > 0 ? Math.min(requested, Math.abs(balance)) : Math.abs(balance);
  const clientReference = makeShortHubtelRef('tu', driverId);

  const pending = await PendingTopUp.create({
    driver: driverId,
    amount: amountToClear,
    clientReference,
  });

  const callbackUrl = appendWebhookToken(
    `${getBaseUrl(req).replace(/\/$/, '')}/webhooks/hubtel`
  );

  const result = await receivePayment({
    CustomerName: user.name || 'Driver',
    CustomerMsisdn: user.phone,
    Amount: amountToClear,
    PrimaryCallbackUrl: callbackUrl,
    Description: 'QareGO Clear Commission Debt',
    ClientReference: clientReference,
    Channel: detectGhMomoChannel(user.phone),
  });

  if (!result.success) {
    pending.status = 'failed';
    pending.hubtelResponse = result.data || { error: result.error };
    await pending.save();
    throw new BadRequestError(result.error || 'Failed to initiate payment');
  }

  pending.hubtelResponse = result.data;
  await pending.save();

  // Local dev without Hubtel credentials: settle immediately.
  if (!isHubtelConfigured()) {
    await completePendingTopUp(pending, result.data);
    const updated = await User.findById(driverId).select('balance');
    return res.status(StatusCodes.OK).json({
      message: 'Debt cleared successfully',
      paymentRequired: false,
      amount: amountToClear,
      balance: Number(updated?.balance ?? 0),
      clientReference,
    });
  }

  res.status(StatusCodes.OK).json({
    message: 'Approve the MoMo prompt on your phone to clear your debt.',
    paymentRequired: true,
    amount: amountToClear,
    balance,
    clientReference,
  });
};

/** GET /ride/top-up/status — Poll pending debt payment status. */
export const getTopUpStatus = async (req, res) => {
  const driverId = req.user.id;
  const { ref } = req.query;

  let pending;
  if (ref) {
    pending = await PendingTopUp.findOne({ clientReference: String(ref), driver: driverId });
    if (!pending) throw new NotFoundError('Top-up not found');
  } else {
    pending = await PendingTopUp.findOne({ driver: driverId }).sort({ createdAt: -1 });
    if (!pending) {
      return res.status(StatusCodes.OK).json({ status: 'none' });
    }
  }

  const user = await User.findById(driverId).select('balance');
  res.status(StatusCodes.OK).json({
    status: pending.status,
    clientReference: pending.clientReference,
    amount: pending.amount,
    balance: Number(user?.balance ?? 0),
  });
};

/** POST /ride/cashout — Rider withdraws positive wallet balance to MoMo anytime. */
export const initiateCashout = async (req, res) => {
  const driverId = req.user.id;
  const { amount: requestedAmount } = req.body;

  const user = await User.findById(driverId).select('balance name phone role');
  if (!user || user.role !== 'rider') {
    throw new BadRequestError('Only riders can cash out');
  }

  const balance = Number(user.balance ?? 0);
  if (balance <= 0) {
    throw new BadRequestError('No wallet balance to cash out');
  }
  if (!user.phone) {
    throw new BadRequestError('Add a phone number to your profile before cashing out');
  }

  const settings = await getSettings();
  const minCashout = Number(settings.minCashoutAmount ?? 1);

  let amount;
  if (requestedAmount == null || requestedAmount === '') {
    amount = balance;
  } else {
    amount = Number(requestedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestError('Invalid amount');
    }
    if (amount > balance) {
      throw new BadRequestError('Amount exceeds wallet balance');
    }
  }

  if (amount < minCashout) {
    throw new BadRequestError(`Minimum cash out is GHS ${minCashout}`);
  }

  amount = Number(amount.toFixed(2));

  const updated = await User.findOneAndUpdate(
    { _id: driverId, role: 'rider', balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  );
  if (!updated) {
    throw new BadRequestError('Insufficient wallet balance');
  }

  const newBalance = Number(updated.balance);
  const clientReference = makeShortHubtelRef('co', driverId);

  await Transaction.create({
    driver: driverId,
    amount: -amount,
    type: 'PAYOUT',
    note: 'Wallet cash out (Hubtel)',
    reference: clientReference,
    balanceAfter: newBalance,
  });

  const callbackUrl = appendWebhookToken(
    `${getBaseUrl(req).replace(/\/$/, '')}/webhooks/hubtel-payout`
  );

  const result = await sendPayment({
    RecipientName: user.name || 'Driver',
    RecipientMsisdn: user.phone,
    Amount: amount,
    PrimaryCallbackUrl: callbackUrl,
    Description: 'QareGO Wallet Cash Out',
    ClientReference: clientReference,
    Channel: detectGhMomoChannel(user.phone),
  });

  if (!result.success) {
    const restoredBalance = newBalance + amount;
    await User.findByIdAndUpdate(driverId, { balance: restoredBalance });
    await Transaction.create({
      driver: driverId,
      amount,
      type: 'MANUAL_CREDIT',
      note: `Cash out failed — balance restored (${result.error})`,
      reference: `reversal_${clientReference}`,
      balanceAfter: restoredBalance,
    });
    throw new BadRequestError(result.error || 'Cash out failed. Your balance was restored.');
  }

  res.status(StatusCodes.OK).json({
    message: 'Cash out sent. Funds will arrive on your MoMo shortly.',
    amount,
    balance: newBalance,
    reference: clientReference,
  });
};

/** POST /food/orders/:id/payment/initiate */
export const initiateFoodOrderPayment = async (req, res) => {
  const order = await FoodOrder.findById(req.params.id).populate('restaurant');
  if (!order) throw new NotFoundError('Order not found');
  if (String(order.customer) !== String(req.user.id)) {
    throw new NotFoundError('Order not found');
  }
  if (order.paymentMethod !== 'MOBILE_MONEY') {
    throw new BadRequestError('This order is not configured for mobile money payment');
  }
  if (order.paymentStatus === 'PAID') {
    const payment = await FoodPayment.findOne({ order: order._id }).lean();
    return res.status(StatusCodes.OK).json({
      message: 'Order already paid',
      payment: {
        status: 'success',
        clientReference: payment?.clientReference || order.paymentReference,
        checkoutUrl: payment?.checkoutUrl || null,
        checkoutDirectUrl: payment?.checkoutDirectUrl || null,
      },
    });
  }

  const accountNumber = process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER;
  if (!accountNumber) {
    throw new BadRequestError('Hubtel merchant account number is missing on server');
  }

  let payment = await FoodPayment.findOne({ order: order._id });
  if (payment?.status === 'pending' && payment.checkoutDirectUrl) {
    order.paymentStatus = 'PENDING';
    await order.save();
    return res.status(StatusCodes.OK).json({
      message: 'Payment already initiated',
      payment: {
        status: payment.status,
        clientReference: payment.clientReference,
        checkoutId: payment.checkoutId,
        checkoutUrl: payment.checkoutUrl,
        checkoutDirectUrl: payment.checkoutDirectUrl,
      },
    });
  }

  const baseUrl = getBaseUrl(req);
  const clientReference = payment?.clientReference || makeFoodReference(order._id);
  const callbackUrl = appendWebhookToken(
    process.env.HUBTEL_CHECKOUT_CALLBACK_URL || `${baseUrl}/webhooks/hubtel`
  );
  const returnUrl =
    process.env.HUBTEL_CHECKOUT_RETURN_URL || `${baseUrl}/payments/return?ref=${clientReference}`;
  const cancellationUrl =
    process.env.HUBTEL_CHECKOUT_CANCEL_URL || `${baseUrl}/payments/cancel?ref=${clientReference}`;

  const checkout = await initiateOnlineCheckout({
    totalAmount: order.total,
    description: `QareGO order ${order._id}`,
    callbackUrl,
    returnUrl,
    cancellationUrl,
    merchantAccountNumber: accountNumber,
    clientReference,
    payeeName: req.user.name || 'Customer',
    payeeMobileNumber: req.user.phone || undefined,
    payeeEmail: req.user.email || undefined,
  });

  if (!checkout.success) {
    throw new BadRequestError(checkout.error || 'Failed to initiate checkout');
  }

  const responseData = checkout.data?.data || {};
  if (!payment) {
    payment = await FoodPayment.create({
      order: order._id,
      customer: order.customer,
      restaurant: order.restaurant?._id || order.restaurant,
      amount: Number(order.total),
      clientReference,
    });
  }

  payment.checkoutId = responseData.checkoutId || payment.checkoutId;
  payment.checkoutUrl = responseData.checkoutUrl || payment.checkoutUrl;
  payment.checkoutDirectUrl = responseData.checkoutDirectUrl || payment.checkoutDirectUrl;
  payment.status = 'pending';
  payment.callbackPayload = null;
  await payment.save();

  order.paymentStatus = 'PENDING';
  order.paymentReference = clientReference;
  await order.save();

  res.status(StatusCodes.OK).json({
    message: 'Checkout initiated',
    payment: {
      status: payment.status,
      clientReference: payment.clientReference,
      checkoutId: payment.checkoutId,
      checkoutUrl: payment.checkoutUrl,
      checkoutDirectUrl: payment.checkoutDirectUrl,
    },
  });
};

/** GET /food/orders/:id/payment-status */
export const getFoodOrderPaymentStatus = async (req, res) => {
  const order = await FoodOrder.findById(req.params.id);
  if (!order) throw new NotFoundError('Order not found');
  if (String(order.customer) !== String(req.user.id)) {
    throw new NotFoundError('Order not found');
  }

  const payment = await FoodPayment.findOne({ order: order._id }).lean();
  if (!payment) {
    return res.status(StatusCodes.OK).json({
      orderPaymentStatus: order.paymentStatus,
      payment: null,
    });
  }

  // Status-check reconciliation: don't rely solely on the async callback (it may
  // land on a different environment). Reconcile on poll, throttled to ~12s.
  const lastCheck = payment.lastStatusCheckAt
    ? new Date(payment.lastStatusCheckAt).getTime()
    : 0;
  const shouldReconcile =
    (payment.status === 'pending' || payment.status === 'initiated') &&
    !payment.statusCheckBlocked &&
    Date.now() - lastCheck >= 12 * 1000;
  if (shouldReconcile && process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER) {
    await FoodPayment.updateOne(
      { _id: payment._id },
      { $set: { lastStatusCheckAt: new Date() } }
    );
    const status = await checkOnlineCheckoutStatus({
      collectionAccountNumber: process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER,
      clientReference: payment.clientReference,
    });
    if (status.forbidden) {
      await FoodPayment.updateOne({ _id: payment._id }, { $set: { statusCheckBlocked: true } });
    }
    if (status.success) {
      const parsed = extractCheckoutStatusFromHubtelPayload(status.data);
      const hubStatus = normalizeCheckoutStatus(parsed.rawStatus);
      if (hubStatus !== 'pending') {
        const latest = await FoodPayment.findById(payment._id);
        if (latest) {
          latest.status = hubStatus;
          latest.statusPayload = status.data;
          await latest.save();
          if (hubStatus === 'success') {
            await processFoodPaymentSuccess(latest, {
              Data: {
                CheckoutId: parsed.transactionId,
                SalesInvoiceId: parsed.externalTransactionId,
                ClientReference: latest.clientReference,
                Status: 'Success',
                PaymentDetails: {
                  PaymentType: parsed.paymentMethod,
                  Channel: parsed.paymentChannel,
                },
              },
            });
          } else {
            await FoodOrder.findByIdAndUpdate(order._id, { paymentStatus: 'FAILED' });
          }
        }
      }
    }
  }

  const refreshedOrder = await FoodOrder.findById(order._id).select('paymentStatus paymentReference').lean();
  const refreshedPayment = await FoodPayment.findOne({ order: order._id })
    .select('status clientReference checkoutId checkoutUrl checkoutDirectUrl payoutStatus payoutError')
    .lean();

  return res.status(StatusCodes.OK).json({
    orderPaymentStatus: refreshedOrder?.paymentStatus || order.paymentStatus,
    payment: refreshedPayment,
  });
};

/** POST /ride/:rideId/payment/initiate - MoMo checkout for a completed ride/parcel. */
export const initiateRidePayment = async (req, res) => {
  const ride = await Ride.findById(req.params.rideId);
  if (!ride) throw new NotFoundError('Ride not found');
  if (String(ride.customer) !== String(req.user.id)) {
    throw new NotFoundError('Ride not found');
  }
  if (ride.paymentMethod !== 'MOBILE_MONEY') {
    throw new BadRequestError('This ride is not set to mobile money payment');
  }
  if (ride.status !== 'COMPLETED') {
    throw new BadRequestError('Payment is available once the trip is completed');
  }
  if (ride.paymentStatus === 'PAID') {
    return res.status(StatusCodes.OK).json({
      message: 'Ride already paid',
      payment: { status: 'success', clientReference: ride.paymentReference },
    });
  }

  const accountNumber = process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER;
  if (!accountNumber) {
    throw new BadRequestError('Hubtel merchant account number is missing on server');
  }

  const baseUrl = getBaseUrl(req);
  const clientReference = ride.paymentReference || makeRideReference(ride._id);
  const callbackUrl = appendWebhookToken(
    process.env.HUBTEL_CHECKOUT_CALLBACK_URL || `${baseUrl}/webhooks/hubtel`
  );
  const returnUrl =
    process.env.HUBTEL_CHECKOUT_RETURN_URL || `${baseUrl}/payments/return?ref=${clientReference}`;
  const cancellationUrl =
    process.env.HUBTEL_CHECKOUT_CANCEL_URL || `${baseUrl}/payments/cancel?ref=${clientReference}`;

  const label = ride.serviceType === 'DELIVERY' ? 'parcel delivery' : 'ride';
  const checkout = await initiateOnlineCheckout({
    totalAmount: ride.fare,
    description: `QareGO ${label} ${ride._id}`,
    callbackUrl,
    returnUrl,
    cancellationUrl,
    merchantAccountNumber: accountNumber,
    clientReference,
    payeeName: req.user.name || 'Customer',
    payeeMobileNumber: req.user.phone || undefined,
    payeeEmail: req.user.email || undefined,
  });

  if (!checkout.success) {
    throw new BadRequestError(checkout.error || 'Failed to initiate checkout');
  }

  const responseData = checkout.data?.data || {};
  ride.paymentReference = clientReference;
  ride.paymentStatus = 'PENDING';
  await ride.save();

  res.status(StatusCodes.OK).json({
    message: 'Checkout initiated',
    payment: {
      status: 'pending',
      clientReference,
      checkoutId: responseData.checkoutId || null,
      checkoutUrl: responseData.checkoutUrl || null,
      checkoutDirectUrl: responseData.checkoutDirectUrl || null,
    },
  });
};

/** GET /ride/:rideId/payment-status - poll + reconcile a ride MoMo payment. */
export const getRidePaymentStatus = async (req, res) => {
  const ride = await Ride.findById(req.params.rideId);
  if (!ride) throw new NotFoundError('Ride not found');
  if (String(ride.customer) !== String(req.user.id)) {
    throw new NotFoundError('Ride not found');
  }

  const lastCheck = ride.paymentLastCheckAt
    ? new Date(ride.paymentLastCheckAt).getTime()
    : 0;
  const shouldReconcile =
    ride.paymentStatus === 'PENDING' &&
    ride.paymentReference &&
    Date.now() - lastCheck >= 12 * 1000 &&
    process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER;
  if (shouldReconcile) {
    ride.paymentLastCheckAt = new Date();
    await ride.save();
    const status = await checkOnlineCheckoutStatus({
      collectionAccountNumber: process.env.HUBTEL_MERCHANT_ACCOUNT_NUMBER,
      clientReference: ride.paymentReference,
    });
    if (status.forbidden) {
      console.warn('[ride] Hubtel status check blocked (403) — set HUBTEL_CLIENT_ID/HUBTEL_CLIENT_SECRET');
    } else if (status.success) {
      const parsed = extractCheckoutStatusFromHubtelPayload(status.data);
      const hubStatus = normalizeCheckoutStatus(parsed.rawStatus);
      if (hubStatus === 'success') {
        await processRidePaymentSuccess(ride);
      } else if (hubStatus === 'failed') {
        ride.paymentStatus = 'FAILED';
        await ride.save();
      }
    }
  }

  const fresh = await Ride.findById(ride._id)
    .select('paymentStatus paymentMethod paymentReference fare serviceType')
    .lean();
  return res.status(StatusCodes.OK).json({
    ridePaymentStatus: fresh?.paymentStatus || ride.paymentStatus,
    paymentMethod: fresh?.paymentMethod || ride.paymentMethod,
    paymentReference: fresh?.paymentReference || ride.paymentReference,
  });
};

function isPayoutSuccess(status, responseCode) {
  const s = String(status || '').toLowerCase();
  if (['success', 'completed', 'paid', 'sent'].includes(s)) return true;
  if (!s && String(responseCode) === '0000') return true;
  return false;
}

/**
 * POST /webhooks/hubtel-payout - Hubtel disbursement (Send Money) callback.
 * Reconciles merchant payouts (fop_...) and driver weekly payouts (payout_...).
 */
export const hubtelPayoutWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const clientReference =
      body.ClientReference || body.Data?.ClientReference || body.Data?.clientReference;
    const responseCode = String(body.ResponseCode ?? body.Data?.ResponseCode ?? '');
    const status = (body.Status || body.Data?.Status || '').toString();

    if (!clientReference) {
      return res.status(StatusCodes.OK).json({ received: true });
    }

    const success = isPayoutSuccess(status, responseCode);
    const failureMsg =
      body.Message || body.Data?.Description || body.Data?.Message || 'Payout failed';

    // Legacy checkout-time merchant payout (fop_).
    if (String(clientReference).startsWith('fop_')) {
      const payment = await FoodPayment.findOne({ payoutReference: clientReference });
      if (payment && payment.payoutStatus !== 'sent') {
        payment.payoutResponse = body;
        if (success) {
          payment.payoutStatus = 'sent';
          payment.payoutCompletedAt = new Date();
          payment.payoutError = null;
        } else {
          payment.payoutStatus = 'failed';
          payment.payoutError = failureMsg;
        }
        await payment.save();
      }
      return res.status(StatusCodes.OK).json({ received: true });
    }

    // Delivery-time food settlement: restaurant (fosr_) or rider (fosd_) disbursement.
    if (
      String(clientReference).startsWith('fosr_') ||
      String(clientReference).startsWith('fosd_')
    ) {
      const field =
        String(clientReference).startsWith('fosr_') ? 'restaurant' : 'rider';
      const order = await FoodOrder.findOne({
        [`settlementDetails.${field}.reference`]: clientReference,
      });
      if (order) {
        const details = { ...(order.settlementDetails || {}) };
        const leg = { ...(details[field] || {}), response: body };
        if (success) {
          leg.status = 'sent';
          leg.error = null;
        } else {
          leg.status = 'failed';
          leg.error = failureMsg;
        }
        details[field] = leg;

        const restaurantOk =
          !details.restaurant ||
          ['sent', 'not_applicable'].includes(details.restaurant.status);
        const riderOk =
          !details.rider || ['sent', 'not_applicable'].includes(details.rider.status);
        const anyFailed =
          details.restaurant?.status === 'failed' || details.rider?.status === 'failed';

        order.settlementDetails = details;
        if (restaurantOk && riderOk && !anyFailed) {
          order.settlementStatus = 'settled';
          order.settledAt = order.settledAt || new Date();
          order.settlementError = null;
        } else if (anyFailed) {
          order.settlementStatus = 'failed';
          order.settlementError = failureMsg;
        }
        await order.save();
      }
      return res.status(StatusCodes.OK).json({ received: true });
    }

    // Driver payout (admin weekly or rider cash-out). On failure restore balance.
    // Legacy: payout_ / cashout_; short: po… / co…
    if (
      String(clientReference).startsWith('payout_') ||
      String(clientReference).startsWith('cashout_') ||
      String(clientReference).startsWith('po') ||
      String(clientReference).startsWith('co')
    ) {
      if (!success) {
        const reversalRef = `reversal_${clientReference}`.slice(0, 64);
        const alreadyReversed = await Transaction.findOne({ reference: reversalRef });
        const original = await Transaction.findOne({
          reference: clientReference,
          type: 'PAYOUT',
        });
        if (original && !alreadyReversed) {
          const restore = Math.abs(Number(original.amount) || 0);
          if (restore > 0) {
            const driver = await User.findById(original.driver).select('balance');
            const newBalance = Number(driver?.balance ?? 0) + restore;
            await User.findByIdAndUpdate(original.driver, { balance: newBalance });
            await Transaction.create({
              driver: original.driver,
              amount: restore,
              type: 'MANUAL_CREDIT',
              note: `Payout failed — balance restored (${failureMsg})`,
              reference: reversalRef,
              balanceAfter: newBalance,
            });
          }
        }
      }
      return res.status(StatusCodes.OK).json({ received: true });
    }

    return res.status(StatusCodes.OK).json({ received: true });
  } catch (err) {
    console.error('Hubtel payout webhook error:', err);
    return res.status(StatusCodes.OK).json({ received: true });
  }
};

/**
 * POST /webhooks/hubtel - Hubtel callback when payment succeeds/fails.
 * Body shape may vary; common: ClientReference, Status, Data.
 */
export const hubtelWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const clientReference =
      body.ClientReference ||
      body.clientReference ||
      body.Data?.ClientReference ||
      body.data?.clientReference;
    const responseCode = String(body.ResponseCode ?? body.Data?.ResponseCode ?? body.responseCode ?? '');
    let status = (body.Status || body.Data?.Status || body.data?.status || '').toString().toLowerCase();
    // Hubtel Online Checkout signals success with ResponseCode "0000".
    if (!status && responseCode === '0000') status = 'success';

    if (!clientReference) {
      return res.status(StatusCodes.OK).json({ received: true });
    }

    // Legacy topup_… or short tu… references.
    if (
      String(clientReference).startsWith('topup_') ||
      String(clientReference).startsWith('tu')
    ) {
      const pending = await PendingTopUp.findOne({ clientReference, status: 'pending' });
      if (!pending) {
        return res.status(StatusCodes.OK).json({ received: true });
      }

      if (status === 'success' || status === 'completed') {
        await completePendingTopUp(pending, body);
      } else {
        pending.status = 'failed';
        pending.hubtelResponse = body;
        await pending.save();
      }
      return res.status(StatusCodes.OK).json({ received: true });
    }

    // Ride / parcel mobile-money payment (client reference prefixed with "rd").
    if (String(clientReference).startsWith('rd')) {
      const ride = await Ride.findOne({ paymentReference: clientReference });
      if (ride) {
        const normalized = normalizeCheckoutStatus(status);
        if (normalized === 'success') {
          await processRidePaymentSuccess(ride);
        } else if (normalized === 'failed' || normalized === 'cancelled') {
          if (ride.paymentStatus !== 'PAID') {
            ride.paymentStatus = normalized === 'cancelled' ? 'UNPAID' : 'FAILED';
            await ride.save();
          }
        }
      }
      return res.status(StatusCodes.OK).json({ received: true });
    }

    const payment = await FoodPayment.findOne({ clientReference });
    if (!payment) {
      return res.status(StatusCodes.OK).json({ received: true });
    }
    const normalized = normalizeCheckoutStatus(status);
    if (normalized === 'success') {
      await processFoodPaymentSuccess(payment, body);
    } else {
      if (payment.status !== 'success') {
        payment.status = normalized === 'pending' ? 'pending' : normalized;
        payment.callbackPayload = body;
        await payment.save();
      }
      if (normalized === 'failed' || normalized === 'cancelled') {
        await FoodOrder.findByIdAndUpdate(payment.order, {
          paymentStatus: normalized === 'cancelled' ? 'UNPAID' : 'FAILED',
        });
      }
    }
  } catch (err) {
    console.error('Hubtel webhook error:', err);
  }
  res.status(StatusCodes.OK).json({ received: true });
};
