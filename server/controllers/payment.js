import { assertMomoEnabled } from "../utils/momoAvailability.js";
/**
 * Mobile money and card payments through Paystack: store orders, rides and parcels, rider
 * top-ups and cash-outs, and the Paystack webhook (payments, transfers, refunds).
 */
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import PendingTopUp from '../models/PendingTopUp.js';
import FoodOrder from '../models/FoodOrder.js';
import FoodPayment from '../models/FoodPayment.js';
import Ride from '../models/Ride.js';
import { StatusCodes } from 'http-status-codes';
import { BadRequestError, NotFoundError } from '../errors/index.js';
import { makePaymentRef } from '../utils/momo.js';
import { getSettings } from '../utils/tripSettlement.js';
import { settleFoodOrderOnDelivery, settlementStatusFor, syncRiderDeliveryPay } from '../utils/foodOrderSettlement.js';
import { applyRefundOutcome, startRefundIfDue } from '../utils/orderRefunds.js';
import { reconcilePaystackRidePayment } from '../utils/ridePayments.js';
import { reconcileStorePayment } from '../utils/storePayments.js';
import StorePayment from '../models/StorePayment.js';
import { payOutRiderBalance } from '../utils/riderPayout.js';
import {
  initializePaystackCheckout,
  isPaystackConfigured,
  isValidPaystackSignature,
  paystackEmailFor,
  verifyPaystackTransaction,
} from '../utils/paystackService.js';

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  if (process.env.PUBLIC_API_URL) return process.env.PUBLIC_API_URL;
  return `${req.protocol}://${req.get('host')}`;
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
 * A store order's payment is confirmed: mark the order paid, refund it straight away if the
 * order was cancelled meanwhile, and settle it if it's already been delivered or collected.
 * `payment` must already be saved with status "success".
 */
async function processFoodPaymentSuccess(payment) {
  const order = await FoodOrder.findById(payment.order);
  if (!order) return;
  if (order.paymentStatus !== 'PAID') {
    order.paymentStatus = 'PAID';
    order.paymentReference = payment.clientReference;
    // Payment landed after the order was cancelled: the customer is owed a refund.
    if (order.status === 'CANCELLED' && order.refundStatus !== 'REFUNDED') {
      order.refundStatus = 'DUE';
    }
    await order.save();
    if (order.refundStatus === 'DUE') {
      try {
        await startRefundIfDue(order._id);
      } catch (err) {
        console.warn('[refund] start failed:', String(order._id), err.message);
      }
    }
  }

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


/* ---------------- Paystack (customer payments) ---------------- */

/** The app's payment screen closes when the checkout redirects to one of these. */
function checkoutReturnUrls(baseUrl, reference) {
  return {
    returnUrl: `${baseUrl}/payments/return?ref=${reference}`,
    cancelUrl: `${baseUrl}/payments/cancel?ref=${reference}`,
  };
}

/** Paid at least what we asked for (cedis, to the pesewa). */
const paidEnough = (paid, expected) => Number(paid) + 0.005 >= Number(expected);

/** Ask Paystack about a food payment and apply the result. Safe to call repeatedly. */
async function reconcilePaystackFoodPayment(payment) {
  if (!payment || payment.status === 'success') return;
  const result = await verifyPaystackTransaction(payment.clientReference);
  // A declined attempt isn't final: the customer can retry on the same checkout, so only a
  // confirmed (and big enough) payment changes anything.
  if (result.status !== 'success') return;
  const latest = await FoodPayment.findById(payment._id);
  if (!latest || latest.status === 'success') return;
  if (paidEnough(result.amount, latest.amount)) {
    latest.status = 'success';
    latest.statusPayload = result.raw;
    latest.paymentMethod = result.channel || latest.paymentMethod;
    latest.paymentChannel = result.channel || latest.paymentChannel;
    latest.providerTransactionId = result.id ? String(result.id) : latest.providerTransactionId;
    await latest.save();
    await processFoodPaymentSuccess(latest);
    return;
  }
  // Paid less than the order total: keep it open and flag it for support.
  latest.statusPayload = result.raw;
  await latest.save();
  console.warn('[paystack] food payment amount mismatch:', latest.clientReference, result.amount, latest.amount);
}

async function startPaystackCheckout(req, { amount, reference, label, metadata }) {
  if (!isPaystackConfigured()) {
    throw new Error("Mobile money payments aren't set up yet. Please pay in cash.");
  }
  const { returnUrl, cancelUrl } = checkoutReturnUrls(getBaseUrl(req), reference);
  const user = await User.findById(req.user.id).select('email phone').lean();
  return initializePaystackCheckout({
    amount,
    email: paystackEmailFor({ ...user, id: req.user.id }),
    reference,
    callbackUrl: returnUrl,
    cancelUrl,
    metadata: { ...metadata, label },
  });
}

/** Credit the rider's balance once Paystack confirms a debt top-up. */
async function completePendingTopUp(pending, providerResponse = null) {
  if (!pending?._id) return false;

  // Atomic claim — prevents double-credit from concurrent webhook + poll.
  const claimed = await PendingTopUp.findOneAndUpdate(
    { _id: pending._id, status: 'pending' },
    { $set: { status: 'completed', providerResponse: providerResponse || pending.providerResponse } },
    { new: true }
  );
  if (!claimed) return false;

  const driver = await User.findById(claimed.driver).select('balance driverDetails');
  if (!driver) {
    await PendingTopUp.findByIdAndUpdate(claimed._id, { status: 'failed' });
    return false;
  }

  const currentBalance = Number(driver.balance ?? 0);
  // Round to the pesewa: float leftovers (e.g. -42.230000000000004 + 42.23) must not leave a
  // tiny "debt" that keeps the rider blocked.
  const newBalance = Math.round((currentBalance + claimed.amount) * 100) / 100;
  await User.findByIdAndUpdate(claimed.driver, { balance: newBalance });
  await Transaction.create({
    driver: claimed.driver,
    amount: claimed.amount,
    type: 'TOP_UP',
    note: 'Clear debt (Paystack)',
    reference: claimed.clientReference,
    balanceAfter: newBalance,
  });
  if (driver.driverDetails?.status === 'suspended_debt' && newBalance >= 0) {
    await User.findByIdAndUpdate(claimed.driver, { 'driverDetails.status': 'active' });
  }

  return true;
}

/** Ask Paystack about a rider top-up and credit the balance once it's paid in full. */
async function reconcilePaystackTopUp(pending) {
  if (!pending || pending.status !== 'pending' || pending.provider !== 'paystack') return;
  const result = await verifyPaystackTransaction(pending.clientReference);
  if (result.status !== 'success') return;
  if (!paidEnough(result.amount, pending.amount)) {
    console.warn('[paystack] top-up amount mismatch:', pending.clientReference, result.amount, pending.amount);
    return;
  }
  await completePendingTopUp(pending, result.raw);
}

/** POST /ride/top-up — pay commission debt on Paystack's checkout. */
export const initiateTopUp = async (req, res) => {
  assertMomoEnabled();
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

  // An open checkout is reused (after checking it wasn't paid meanwhile).
  let open = await PendingTopUp.findOne({ driver: driverId, status: 'pending', provider: 'paystack' });
  if (open) {
    await reconcilePaystackTopUp(open);
    open = await PendingTopUp.findById(open._id);
  }
  if (open?.status === 'completed') {
    const fresh = await User.findById(driverId).select('balance');
    return res.status(StatusCodes.OK).json({
      message: 'Debt cleared successfully',
      paymentRequired: false,
      amount: open.amount,
      balance: Number(fresh?.balance ?? 0),
      clientReference: open.clientReference,
    });
  }
  const owed = Math.round(Math.abs(balance) * 100) / 100;
  if (open?.checkoutUrl && Math.abs(open.amount - owed) < 0.005) {
    return res.status(StatusCodes.OK).json({
      message: 'Pay on the secure page to clear your debt.',
      paymentRequired: true,
      pending: true,
      clientReference: open.clientReference,
      checkoutUrl: open.checkoutUrl,
      amount: open.amount,
      balance,
    });
  }
  // The debt changed since that checkout was made: retire it and start a fresh one.
  if (open) await PendingTopUp.updateOne({ _id: open._id, status: 'pending' }, { $set: { status: 'failed' } });

  const requested = requestedAmount ? Math.abs(Number(requestedAmount)) : 0;
  if (requestedAmount != null && (!Number.isFinite(requested) || requested <= 0)) {
    throw new BadRequestError('Invalid amount');
  }
  const amount = Math.round((requested > 0 ? Math.min(requested, owed) : owed) * 100) / 100;
  const reference = makePaymentRef('tu', driverId);
  let checkout;
  try {
    checkout = await startPaystackCheckout(req, {
      amount,
      reference,
      label: 'QareGO commission debt',
      metadata: { kind: 'top_up', driverId: String(driverId) },
    });
  } catch (err) {
    throw new BadRequestError(err.message || 'Could not start the payment. Please try again.');
  }
  await PendingTopUp.create({
    driver: driverId,
    amount,
    clientReference: reference,
    provider: 'paystack',
    checkoutUrl: checkout.authorizationUrl,
  });
  return res.status(StatusCodes.OK).json({
    message: 'Pay on the secure page to clear your debt.',
    paymentRequired: true,
    clientReference: reference,
    checkoutUrl: checkout.authorizationUrl,
    amount,
    balance,
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

  if (pending.status === 'pending' && pending.provider === 'paystack') {
    try {
      await reconcilePaystackTopUp(pending);
      pending = await PendingTopUp.findById(pending._id);
    } catch (err) {
      console.warn('[paystack] top-up status check failed:', err.message);
    }
  }

  const user = await User.findById(driverId).select('balance driverDetails.status');
  res.status(StatusCodes.OK).json({
    status: pending.status,
    clientReference: pending.clientReference,
    amount: pending.amount,
    balance: Number(user?.balance ?? 0),
    driverStatus:
      pending.status === 'completed' ? user?.driverDetails?.status || 'active' : undefined,
  });
};

/** POST /ride/cashout — Rider withdraws positive wallet balance to MoMo anytime. */
export const initiateCashout = async (req, res) => {
  assertMomoEnabled();
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
  const payout = await payOutRiderBalance({
    riderId: driverId,
    amount,
    refPrefix: 'co',
    note: 'Wallet cash out',
    reason: 'QareGO wallet cash out',
  });
  if (!payout.ok) {
    throw new BadRequestError(
      payout.error === 'Not enough in the wallet'
        ? 'Insufficient wallet balance'
        : `${payout.error || 'Cash out failed'}. Your balance was restored.`
    );
  }
  const newBalance = payout.balance;
  const clientReference = payout.reference;

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

  let payment = await FoodPayment.findOne({ order: order._id });
  // An open checkout is reused; a failed one gets a fresh reference (Paystack refuses repeats).
  if (payment?.status === 'pending' && payment.checkoutUrl) {
    await reconcilePaystackFoodPayment(payment);
    payment = await FoodPayment.findById(payment._id);
  }
  if (payment?.status === 'pending' && payment.checkoutUrl) {
    return res.status(StatusCodes.OK).json({
      message: 'Payment already initiated',
      payment: {
        status: 'pending',
        clientReference: payment.clientReference,
        checkoutUrl: payment.checkoutUrl,
        checkoutDirectUrl: payment.checkoutUrl,
      },
    });
  }
  if (payment?.status === 'success') {
    return res.status(StatusCodes.OK).json({
      message: 'Order already paid',
      payment: { status: 'success', clientReference: payment.clientReference },
    });
  }
  const reference = makeFoodReference(order._id);
  let checkout;
  try {
    checkout = await startPaystackCheckout(req, {
      amount: order.total,
      reference,
      label: `QareGO order ${order._id}`,
      metadata: { kind: 'food_order', orderId: String(order._id) },
    });
  } catch (err) {
    throw new BadRequestError(err.message || 'Could not start the payment. Please try again.');
  }
  if (!payment) {
    payment = new FoodPayment({
      order: order._id,
      customer: order.customer,
      restaurant: order.restaurant?._id || order.restaurant,
      amount: Number(order.total),
      clientReference: reference,
    });
  }
  payment.clientReference = reference;
  payment.amount = Number(order.total);
  payment.checkoutId = checkout.accessCode;
  payment.checkoutUrl = checkout.authorizationUrl;
  payment.checkoutDirectUrl = checkout.authorizationUrl;
  payment.status = 'pending';
  payment.statusPayload = null;
  await payment.save();
  order.paymentStatus = 'PENDING';
  order.paymentReference = reference;
  await order.save();
  return res.status(StatusCodes.OK).json({
    message: 'Checkout initiated',
    payment: {
      status: 'pending',
      clientReference: reference,
      checkoutId: checkout.accessCode,
      checkoutUrl: checkout.authorizationUrl,
      checkoutDirectUrl: checkout.authorizationUrl,
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

  const since = payment.lastStatusCheckAt ? Date.now() - new Date(payment.lastStatusCheckAt).getTime() : Infinity;
  if (payment.status === 'pending' && since >= 4000) {
    await FoodPayment.updateOne({ _id: payment._id }, { $set: { lastStatusCheckAt: new Date() } });
    try {
      await reconcilePaystackFoodPayment(payment);
    } catch (err) {
      console.warn('[paystack] food status check failed:', err.message);
    }
  }
  const freshOrder = await FoodOrder.findById(order._id).select('paymentStatus').lean();
  const freshPayment = await FoodPayment.findById(payment._id)
    .select('status clientReference checkoutId checkoutUrl checkoutDirectUrl payoutStatus payoutError')
    .lean();
  return res.status(StatusCodes.OK).json({
    orderPaymentStatus: freshOrder?.paymentStatus || order.paymentStatus,
    payment: freshPayment,
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

  if (ride.paymentStatus === 'PENDING' && ride.paymentReference && ride.paymentCheckoutUrl) {
    await reconcilePaystackRidePayment(ride, req.io);
    if (ride.paymentStatus === 'PAID') {
      return res.status(StatusCodes.OK).json({
        message: 'Ride already paid',
        payment: { status: 'success', clientReference: ride.paymentReference },
      });
    }
    if (ride.paymentStatus === 'PENDING') {
      return res.status(StatusCodes.OK).json({
        message: 'Payment already initiated',
        payment: {
          status: 'pending',
          clientReference: ride.paymentReference,
          checkoutUrl: ride.paymentCheckoutUrl,
          checkoutDirectUrl: ride.paymentCheckoutUrl,
        },
      });
    }
  }
  const reference = makeRideReference(ride._id);
  const label = ride.serviceType === 'DELIVERY' ? 'parcel delivery' : 'ride';
  let checkout;
  try {
    checkout = await startPaystackCheckout(req, {
      amount: ride.fare,
      reference,
      label: `QareGO ${label} ${ride._id}`,
      metadata: { kind: 'ride', rideId: String(ride._id) },
    });
  } catch (err) {
    throw new BadRequestError(err.message || 'Could not start the payment. Please try again.');
  }
  ride.paymentReference = reference;
  ride.paymentCheckoutUrl = checkout.authorizationUrl;
  ride.paymentStatus = 'PENDING';
  await ride.save();
  return res.status(StatusCodes.OK).json({
    message: 'Checkout initiated',
    payment: {
      status: 'pending',
      clientReference: reference,
      checkoutId: checkout.accessCode,
      checkoutUrl: checkout.authorizationUrl,
      checkoutDirectUrl: checkout.authorizationUrl,
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

  const since = ride.paymentLastCheckAt ? Date.now() - new Date(ride.paymentLastCheckAt).getTime() : Infinity;
  if (ride.paymentStatus === 'PENDING' && ride.paymentReference && since >= 4000) {
    ride.paymentLastCheckAt = new Date();
    await ride.save();
    try {
      await reconcilePaystackRidePayment(ride, req.io);
    } catch (err) {
      console.warn('[paystack] ride status check failed:', err.message);
    }
  }
  const fresh = await Ride.findById(ride._id).select('paymentStatus paymentMethod paymentReference').lean();
  return res.status(StatusCodes.OK).json({
    ridePaymentStatus: fresh?.paymentStatus || ride.paymentStatus,
    paymentMethod: fresh?.paymentMethod || ride.paymentMethod,
    paymentReference: fresh?.paymentReference || ride.paymentReference,
  });
};

/**
 * Apply a payout's final result (Paystack transfer webhook): mark store/rider settlement legs
 * sent or failed, and give a rider their money back when a cash-out or admin payout fails.
 */
async function applyPayoutOutcome(clientReference, success, failureMsg, body) {
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
      // A rider transfer that failed puts the pay in their wallet instead.
      if (field === 'rider') {
        try {
          await syncRiderDeliveryPay(order, details);
        } catch (err) {
          console.error('[payout] rider pay record failed for order', String(order._id), err.message);
        }
      }

      order.settlementDetails = details;
      const next = settlementStatusFor(details);
      if (next && next.status !== 'processing') {
        order.settlementStatus = next.status;
        order.settlementError = next.error;
        if (next.status === 'settled') order.settledAt = order.settledAt || new Date();
      }
      await order.save();
    }
    return;
  }

  // Rider payout (admin payout po…, rider cash-out co…; older payout_ / cashout_).
  // On failure, give the money back.
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
          // $inc so a trip settling at the same moment isn't overwritten.
          const updated = await User.findByIdAndUpdate(
            original.driver,
            { $inc: { balance: restore } },
            { new: true }
          ).select('balance');
          const newBalance = Math.round(Number(updated?.balance ?? 0) * 100) / 100;
          if (newBalance !== Number(updated?.balance)) {
            await User.updateOne({ _id: original.driver }, { $set: { balance: newBalance } });
          }
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
    return;
  }
}

/**
 * POST /webhooks/paystack — Paystack's signed event. The payload is only a hint: the
 * transaction is re-checked with Paystack before anything is marked paid.
 */
export const paystackWebhook = async (req, res) => {
  if (!isValidPaystackSignature(req.rawBody, req.headers['x-paystack-signature'])) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid signature' });
  }
  const event = req.body?.event;
  const reference = req.body?.data?.reference;
  // Answer straight away; Paystack retries slow or failed webhooks.
  res.status(StatusCodes.OK).json({ received: true });
  // Refunds report the original payment's reference.
  if (['refund.processed', 'refund.failed'].includes(event)) {
    const txRef = req.body?.data?.transaction_reference || req.body?.data?.transaction?.reference;
    if (txRef) {
      try {
        await applyRefundOutcome(txRef, event === 'refund.processed' ? 'processed' : 'failed', req.body?.data?.merchant_note);
      } catch (err) {
        console.error('[paystack] refund webhook handling failed:', txRef, err.message);
      }
    }
    return;
  }
  if (!reference) return;
  // Payouts (rider cash-out, admin payout, store settlement): the event is signed, and a
  // failure only gives money back, so it's applied as sent.
  if (['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(event)) {
    try {
      const ok = event === 'transfer.success';
      const reason = req.body?.data?.reason || req.body?.data?.gateway_response || 'Transfer failed';
      await applyPayoutOutcome(reference, ok, ok ? null : `Paystack: ${reason}`, req.body);
    } catch (err) {
      console.error('[paystack] transfer webhook handling failed:', reference, err.message);
    }
    return;
  }
  if (!['charge.success', 'charge.failed'].includes(event)) return;
  try {
    const payment = await FoodPayment.findOne({ clientReference: reference });
    if (payment) {
      await reconcilePaystackFoodPayment(payment);
      return;
    }
    const ride = await Ride.findOne({ paymentReference: reference });
    if (ride) {
      await reconcilePaystackRidePayment(ride, req.io);
      return;
    }
    const topUp = await PendingTopUp.findOne({ clientReference: reference });
    if (topUp) {
      await reconcilePaystackTopUp(topUp);
      return;
    }
    const storePayment = await StorePayment.findOne({ clientReference: reference });
    if (storePayment) await reconcileStorePayment(storePayment);
  } catch (err) {
    console.error('[paystack] webhook handling failed:', reference, err.message);
  }
};
