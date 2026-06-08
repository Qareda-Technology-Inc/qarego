/**
 * Hubtel API: receive (collect from customer/driver) and send (disburse to driver).
 * Env: HUBTEL_CLIENT_ID, HUBTEL_CLIENT_SECRET, HUBTEL_API_URL (e.g. https://api.hubtel.com/v1)
 * Docs: https://developers.hubtel.com
 */
import axios from 'axios';

const getAuthHeader = () => {
  const clientId = process.env.HUBTEL_CLIENT_ID;
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const token = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  return { Authorization: `Basic ${token}` };
};

const getBaseUrl = () => process.env.HUBTEL_API_URL || 'https://api.hubtel.com/v1';

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
      Amount: Number(opts.Amount).toFixed(2),
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
    const msg = err.response?.data?.message || err.response?.data?.Data?.Description || err.message;
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
  const auth = getAuthHeader();
  if (!auth) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Hubtel] Send (mock):', opts);
      return { success: true, data: { Status: 'Pending', Data: { ClientReference: opts.ClientReference } } };
    }
    return { success: false, error: 'Hubtel not configured' };
  }

  try {
    const url = `${getBaseUrl()}/disbursements/mobilemoney`;
    const payload = {
      RecipientName: opts.RecipientName || 'Driver',
      RecipientMsisdn: formatPhoneForHubtel(opts.RecipientMsisdn),
      Amount: Number(opts.Amount).toFixed(2),
      PrimaryCallbackUrl: opts.PrimaryCallbackUrl,
      Description: opts.Description || 'QareGO Weekly Payout',
      ClientReference: opts.ClientReference,
      Channel: opts.Channel || 'mtn-gh',
    };
    const res = await axios.post(url, payload, {
      headers: { ...auth, 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    return { success: true, data: res.data };
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.Data?.Description || err.message;
    console.error('Hubtel send error:', msg);
    return { success: false, error: msg };
  }
}
