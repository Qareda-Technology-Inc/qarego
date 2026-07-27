/**
 * Hubtel API: receive (collect from customer/driver) and send (disburse to driver).
 * Env: HUBTEL_CLIENT_ID, HUBTEL_CLIENT_SECRET, HUBTEL_API_URL (e.g. https://api.hubtel.com/v1)
 * Docs: https://developers.hubtel.com
 */
import axios from 'axios';

function buildBasicAuth(username, password) {
  if (!username || !password) return null;
  const token = Buffer.from(`${username}:${password}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

/** Collection / checkout / receivables credentials. */
const getAuthHeader = () => {
  const apiId = process.env.HUBTEL_API_ID;
  const apiKey = process.env.HUBTEL_API_KEY;
  const clientId = process.env.HUBTEL_CLIENT_ID;
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
  return buildBasicAuth(apiId || clientId, apiKey || clientSecret);
};

/**
 * Disbursement wallet credentials (Send Money).
 * Hubtel often issues separate API keys for the disbursement account — set
 * HUBTEL_DISBURSEMENT_API_ID / HUBTEL_DISBURSEMENT_API_KEY, or collection keys are used.
 */
const getDisbursementAuthHeader = () => {
  const apiId =
    process.env.HUBTEL_DISBURSEMENT_API_ID ||
    process.env.HUBTEL_DISBURSEMENT_CLIENT_ID ||
    process.env.HUBTEL_API_ID;
  const apiKey =
    process.env.HUBTEL_DISBURSEMENT_API_KEY ||
    process.env.HUBTEL_DISBURSEMENT_CLIENT_SECRET ||
    process.env.HUBTEL_API_KEY;
  const clientId = process.env.HUBTEL_CLIENT_ID;
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
  return buildBasicAuth(apiId || clientId, apiKey || clientSecret);
};

function isHubtelPayoutAccepted(data) {
  const code = String(data?.ResponseCode ?? data?.responseCode ?? '').trim();
  if (code === '0000') return true;
  const status = String(data?.Status ?? data?.status ?? '').toLowerCase();
  return ['success', 'completed', 'pending', 'paid', 'sent'].includes(status);
}

function hubtelResponseError(data, fallback = 'Hubtel rejected the request') {
  return (
    data?.Message ||
    data?.message ||
    data?.Data?.Description ||
    data?.status ||
    data?.Status ||
    fallback
  );
}

const getBaseUrl = () => process.env.HUBTEL_API_URL || 'https://api.hubtel.com/v1';
const getCheckoutBaseUrl = () =>
  process.env.HUBTEL_CHECKOUT_API_URL || 'https://payproxyapi.hubtel.com';
const getStatusBaseUrl = () =>
  process.env.HUBTEL_STATUS_API_URL || 'https://api-txnstatus.hubtel.com';

function normalizeMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(2));
}

function extractHubtelError(err, fallback = 'Hubtel request failed') {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  return (
    data?.message ||
    data?.Message ||
    data?.status ||
    data?.Status ||
    data?.Data?.Description ||
    err?.message ||
    fallback
  );
}

/**
 * Normalize Ghana phone to Hubtel format (233XXXXXXXXX, no +).
 */
export function formatPhoneForHubtel(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith('233')) cleaned = '233' + cleaned;
  return cleaned;
}

/**
 * Receive payment (collect from driver for top-up). Driver gets MoMo prompt.
 * @param {Object} opts - CustomerMsisdn (233...), Amount, PrimaryCallbackUrl, Description, ClientReference, CustomerName
 * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
 */
export async function receivePayment(opts) {
  const auth = getAuthHeader();
  if (!auth) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Hubtel] Receive (mock):', opts);
      return { success: true, data: { Status: 'Pending', Data: { ClientReference: opts.ClientReference } } };
    }
    return { success: false, error: 'Hubtel not configured' };
  }

  try {
    const url = `${getBaseUrl()}/receivables/mobilemoney`;
    const payload = {
      CustomerName: opts.CustomerName || 'Driver',
      CustomerMsisdn: formatPhoneForHubtel(opts.CustomerMsisdn),
      Amount: normalizeMoney(opts.Amount),
      PrimaryCallbackUrl: opts.PrimaryCallbackUrl,
      Description: opts.Description || 'QareGO Clear Debt',
      ClientReference: opts.ClientReference,
      Channel: opts.Channel || 'mtn-gh',
    };
    const res = await axios.post(url, payload, {
      headers: { ...auth, 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    return { success: true, data: res.data };
  } catch (err) {
    const msg = extractHubtelError(err, 'Hubtel receive request failed');
    console.error('Hubtel receive error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Send payment (disburse to driver for weekly payout).
 * @param {Object} opts - RecipientMsisdn (233...), Amount, PrimaryCallbackUrl, Description, ClientReference, RecipientName
 * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
 */
export async function sendPayment(opts) {
  const auth = getDisbursementAuthHeader();
  if (!auth) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Hubtel] Send (mock):', opts);
      return { success: true, data: { Status: 'Pending', Data: { ClientReference: opts.ClientReference } } };
    }
    return { success: false, error: 'Hubtel disbursement not configured' };
  }

  try {
    const url = `${getBaseUrl()}/disbursements/mobilemoney`;
    const payload = {
      RecipientName: opts.RecipientName || 'Driver',
      RecipientMsisdn: formatPhoneForHubtel(opts.RecipientMsisdn),
      Amount: normalizeMoney(opts.Amount),
      PrimaryCallbackUrl: opts.PrimaryCallbackUrl,
      Description: opts.Description || 'QareGO Weekly Payout',
      ClientReference: opts.ClientReference,
      Channel: opts.Channel || 'mtn-gh',
    };
    const res = await axios.post(url, payload, {
      headers: { ...auth, 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    if (!isHubtelPayoutAccepted(res.data)) {
      const msg = hubtelResponseError(res.data, 'Hubtel disbursement rejected');
      console.error('[Hubtel] Send rejected:', msg, {
        clientReference: opts.ClientReference,
        amount: payload.Amount,
        response: res.data,
      });
      return { success: false, error: msg, data: res.data };
    }
    return { success: true, data: res.data };
  } catch (err) {
    const msg = extractHubtelError(err, 'Hubtel payout request failed');
    console.error('[Hubtel] Send error:', msg, {
      clientReference: opts.ClientReference,
      status: err?.response?.status,
      responseBody: err?.response?.data,
    });
    return { success: false, error: msg, data: err?.response?.data };
  }
}

/**
 * Online checkout initiation (QareGO collects from customer).
 */
export async function initiateOnlineCheckout(opts) {
  const auth = getAuthHeader();
  if (!auth) return { success: false, error: 'Hubtel not configured' };

  const url = `${getCheckoutBaseUrl()}/items/initiate`;
  const totalAmount = normalizeMoney(opts.totalAmount);
  if (totalAmount == null || totalAmount <= 0) {
    return { success: false, error: 'Invalid totalAmount for checkout' };
  }
  // Hubtel's items/initiate expects merchantAccountNumber as a STRING.
  const merchantAccountNumber = String(opts.merchantAccountNumber ?? '').trim();
  const payload = {
    totalAmount,
    description: opts.description,
    callbackUrl: opts.callbackUrl,
    returnUrl: opts.returnUrl,
    cancellationUrl: opts.cancellationUrl,
    merchantAccountNumber,
    clientReference: opts.clientReference,
    payeeName: opts.payeeName || undefined,
    payeeMobileNumber: opts.payeeMobileNumber
      ? formatPhoneForHubtel(opts.payeeMobileNumber)
      : undefined,
    payeeEmail: opts.payeeEmail || undefined,
  };

  try {
    const res = await axios.post(url, payload, {
      headers: { ...auth, 'Content-Type': 'application/json', Accept: 'application/json' },
      timeout: 15000,
    });
    const responseCode = String(res.data?.responseCode || '');
    if (responseCode !== '0000') {
      return {
        success: false,
        error: res.data?.message || res.data?.status || 'Checkout initiation rejected',
        data: res.data,
      };
    }
    return { success: true, data: res.data };
  } catch (err) {
    const msg = extractHubtelError(err, 'Hubtel checkout initiate request failed');
    console.error('Hubtel checkout initiate error:', msg, {
      status: err?.response?.status,
      url,
      responseBody: err?.response?.data,
      sentPayload: {
        totalAmount: payload.totalAmount,
        merchantAccountNumber: payload.merchantAccountNumber,
        merchantAccountType: typeof payload.merchantAccountNumber,
        callbackUrl: payload.callbackUrl,
        returnUrl: payload.returnUrl,
        cancellationUrl: payload.cancellationUrl,
        clientReference: payload.clientReference,
      },
    });
    return { success: false, error: msg };
  }
}

/**
 * Online checkout transaction status lookup (fallback when webhook delays).
 * Hubtel txnstatus usually requires HTTP REST API credentials (CLIENT_ID/SECRET),
 * not always the same Sales API_ID/API_KEY used for items/initiate.
 */
function getStatusAuthCandidates() {
  const seen = new Set();
  const candidates = [];
  const add = (username, password, label) => {
    if (!username || !password) return;
    const key = `${username}:${password}`;
    if (seen.has(key)) return;
    seen.add(key);
    const auth = buildBasicAuth(username, password);
    if (auth) candidates.push({ auth, label });
  };

  add(process.env.HUBTEL_CLIENT_ID, process.env.HUBTEL_CLIENT_SECRET, 'client');
  add(process.env.HUBTEL_STATUS_API_ID, process.env.HUBTEL_STATUS_API_KEY, 'status');
  add(process.env.HUBTEL_API_ID, process.env.HUBTEL_API_KEY, 'sales');

  return candidates;
}

export function extractCheckoutStatusFromHubtelPayload(data) {
  const inner = data?.data || data?.Data || {};
  const rawStatus =
    inner.status ||
    inner.Status ||
    data?.status ||
    data?.Status ||
    inner.paymentStatus ||
    '';
  const responseCode = String(data?.responseCode ?? data?.ResponseCode ?? '').trim();
  return {
    rawStatus,
    responseCode,
    transactionId: inner.transactionId || inner.TransactionId || inner.checkoutId || null,
    externalTransactionId:
      inner.externalTransactionId || inner.ExternalTransactionId || inner.salesInvoiceId || null,
    paymentMethod: inner.paymentMethod || inner.paymentType || inner.PaymentType || null,
    paymentChannel: inner.paymentChannel || inner.channel || inner.Channel || null,
  };
}

export async function checkOnlineCheckoutStatus(opts) {
  const account = String(opts.collectionAccountNumber || '').trim();
  const clientReference = String(opts.clientReference || '').trim();
  if (!account || !clientReference) {
    return { success: false, error: 'Missing account or clientReference' };
  }

  const candidates = getStatusAuthCandidates();
  if (!candidates.length) {
    return { success: false, error: 'Hubtel not configured' };
  }

  const ref = encodeURIComponent(clientReference);
  const url = `${getStatusBaseUrl()}/transactions/${encodeURIComponent(account)}/status?clientReference=${ref}`;

  let lastError = 'Status check failed';
  let forbidden = false;

  for (const { auth, label } of candidates) {
    try {
      const res = await axios.get(url, {
        headers: { ...auth, Accept: 'application/json' },
        timeout: 15000,
        validateStatus: (status) => status < 500,
      });

      if (res.status === 401 || res.status === 403) {
        forbidden = true;
        lastError = `HTTP ${res.status} with ${label} credentials`;
        continue;
      }

      if (res.status >= 400) {
        lastError = `HTTP ${res.status} with ${label} credentials`;
        continue;
      }

      const responseCode = String(res.data?.responseCode ?? res.data?.ResponseCode ?? '').trim();
      if (responseCode && responseCode !== '0000') {
        lastError =
          res.data?.message ||
          res.data?.Message ||
          `Hubtel responseCode ${responseCode} (${label})`;
        continue;
      }

      return { success: true, data: res.data, authLabel: label };
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) forbidden = true;
      lastError = extractHubtelError(err, `Status check failed (${label})`);
    }
  }

  if (forbidden) {
    console.error('[Hubtel] checkout status forbidden for all credential types — set HUBTEL_CLIENT_ID/HUBTEL_CLIENT_SECRET (HTTP REST API) in Render env', {
      url,
      account,
      clientReference: clientReference.slice(0, 12) + '…',
    });
  }

  return { success: false, error: lastError, forbidden };
}
