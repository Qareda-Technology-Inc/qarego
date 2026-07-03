/**
 * Top-up (clear debt) and Hubtel webhook.
 */
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import PendingTopUp from '../models/PendingTopUp.js';
import FoodOrder from '../models/FoodOrder.js';
import FoodPayment from '../models/FoodPayment.js';
import Restaurant from '../models/Restaurant.js';
import { StatusCodes } from 'http-status-codes';
import { BadRequestError, NotFoundError } from '../errors/index.js';
import {
  checkOnlineCheckoutStatus,
  formatPhoneForHubtel,
  initiateOnlineCheckout,
  sendPayment,
} from '../utils/hubtelService.js';
import { getCommissionRateForService, getSettings } from '../utils/tripSettlement.js';

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

function computeRestaurantPayout(order, settings) {
  const subtotal = Number(order?.subtotal ?? 0);
  const commissionRate = getCommissionRateForService(settings, 'FOOD');
  const commission = subtotal * commissionRate;
  const payoutAmount = Math.max(0, Number((subtotal - commission).toFixed(2)));
  return { payoutAmount, commissionRate, commission };
}

async function processFoodPaymentSuccess(payment, payload) {
  if (!payment) return;
  if (payment.status === 'success' && payment.payoutStatus === 'sent') return;

  const order = await FoodOrder.findById(payment.order);
  if (!order) return;
  const restaurant = await Restaurant.findById(payment.restaurant).lean();
  if (!restaurant) return;

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

  const instantEnabled = Boolean(restaurant?.payoutConfig?.instantPayoutEnabled);
  const recipientMsisdn = formatPhoneForHubtel(restaurant?.payoutConfig?.recipientMsisdn || '');
  const recipientName = restaurant?.payoutConfig?.recipientName || restaurant?.name || 'Merchant';
  const channel = restaurant?.payoutConfig?.channel || 'mtn-gh';

  if (!instantEnabled || !recipientMsisdn) {
    payment.payoutStatus = 'not_applicable';
    await payment.save();
    return;
  }

  if (payment.payoutStatus === 'sent') {
    await payment.save();
    return;
  }

  const settings = await getSettings();
  const { payoutAmount } = computeRestaurantPayout(order, settings);
  if (payoutAmount <= 0) {
    payment.payoutStatus = 'not_applicable';
    payment.payoutAmount = 0;
    await payment.save();
    return;
  }

  payment.payoutAmount = payoutAmount;
  payment.payoutStatus = 'pending';
  payment.payoutAttemptedAt = new Date();
  if (!payment.payoutReference) {
    payment.payoutReference = `fop_${payment.clientReference}`.slice(0, 32);
  }
  await payment.save();

  const callback =
    process.env.HUBTEL_PAYOUT_CALLBACK_URL ||
    (process.env.BASE_URL ? `${process.env.BASE_URL}/webhooks/hubtel-payout` : null);
  const payout = await sendPayment({
    RecipientName: recipientName,
    RecipientMsisdn: recipientMsisdn,
    Amount: payoutAmount,
    PrimaryCallbackUrl: callback || undefined,
    Description: `QareGO order payout ${order._id}`,
    ClientReference: payment.payoutReference,
    Channel: channel,
  });

  payment.payoutResponse = payout.data || null;
  if (payout.success) {
    payment.payoutStatus = 'sent';
    payment.payoutCompletedAt = new Date();
    payment.payoutError = null;
  } else {
    payment.payoutStatus = 'failed';
    payment.payoutError = payout.error || 'Payout failed';
  }
  await payment.save();
}

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
  const callbackUrl = process.env.HUBTEL_CHECKOUT_CALLBACK_URL || `${baseUrl}/webhooks/hubtel`;
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
    if (status.success) {
      const hubStatus = normalizeCheckoutStatus(status.data?.data?.status);
      if (hubStatus !== 'pending') {
        const latest = await FoodPayment.findById(payment._id);
        if (latest) {
          latest.status = hubStatus;
          latest.statusPayload = status.data;
          await latest.save();
          if (hubStatus === 'success') {
            await processFoodPaymentSuccess(latest, {
              Data: {
                CheckoutId: status.data?.data?.transactionId,
                SalesInvoiceId: status.data?.data?.externalTransactionId,
                ClientReference: latest.clientReference,
                Status: 'Success',
                PaymentDetails: {
                  PaymentType: status.data?.data?.paymentMethod,
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

/**
 * POST /webhooks/hubtel - Hubtel callback when payment succeeds/fails.
 * Body shape may vary; common: ClientReference, Status, Data.
 */
export const hubtelWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const clientReference = body.ClientReference || body.Data?.ClientReference;
    const responseCode = String(body.ResponseCode ?? body.Data?.ResponseCode ?? '');
    let status = (body.Status || body.Data?.Status || '').toString().toLowerCase();
    // Hubtel Online Checkout signals success with ResponseCode "0000".
    if (!status && responseCode === '0000') status = 'success';

    if (!clientReference) {
      return res.status(StatusCodes.OK).json({ received: true });
    }

    if (String(clientReference).startsWith('topup_')) {
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
