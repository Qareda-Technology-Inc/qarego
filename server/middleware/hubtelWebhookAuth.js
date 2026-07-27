/**
 * Security for Hubtel webhook endpoints.
 *
 * Hubtel Online Checkout does not sign its callbacks, so we protect the
 * endpoint two ways:
 *  1. A shared secret embedded in the callbackUrl we send to Hubtel
 *     (?token=...) and verified here. This is the primary defence.
 *  2. Fallback: accept callbacks whose ClientReference matches a pending payment.
 *  3. An optional IP allowlist (HUBTEL_WEBHOOK_ALLOWED_IPS).
 */
import { isKnownPendingHubtelReference } from '../utils/hubtelPendingReference.js';

function normalizeIp(ip) {
  if (!ip) return ip;
  return String(ip).trim().replace(/^::ffff:/, '');
}

function getClientIps(req) {
  const list = [];
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) {
    list.push(...xff.split(','));
  }
  if (req.ip) list.push(req.ip);
  if (req.socket?.remoteAddress) list.push(req.socket.remoteAddress);
  return [...new Set(list.map(normalizeIp).filter(Boolean))];
}

/**
 * Append the webhook secret token to a callback URL so incoming callbacks
 * can be authenticated. No-op when no secret is configured.
 */
export function appendWebhookToken(url) {
  const secret = process.env.HUBTEL_WEBHOOK_SECRET;
  if (!secret || !url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(secret)}`;
}

export default async function verifyHubtelWebhook(req, res, next) {
  const secret = process.env.HUBTEL_WEBHOOK_SECRET;
  const allowedIpsRaw = process.env.HUBTEL_WEBHOOK_ALLOWED_IPS;

  if (secret) {
    const provided =
      req.query?.token ||
      req.headers['x-webhook-token'] ||
      req.headers['x-hubtel-token'];
    if (provided && String(provided) === String(secret)) {
      return next();
    }

    // Hubtel Online Checkout often POSTs without preserving ?token= on callbackUrl.
    const clientReference =
      req.body?.ClientReference ||
      req.body?.clientReference ||
      req.body?.Data?.ClientReference ||
      req.body?.data?.clientReference;
    if (clientReference) {
      try {
        const known = await isKnownPendingHubtelReference(clientReference);
        if (known) {
          console.warn('[webhook] accepted via pending clientReference (no token in callback)', {
            clientReference: `${String(clientReference).slice(0, 12)}…`,
          });
          return next();
        }
      } catch (err) {
        console.error('[webhook] pending reference check failed:', err);
      }
    }

    console.warn('[webhook] rejected: invalid or missing token', {
      ips: getClientIps(req),
      path: req.originalUrl,
    });
    return res.status(401).json({ received: false });
  }

  if (allowedIpsRaw) {
    const allowed = allowedIpsRaw
      .split(',')
      .map((s) => normalizeIp(s))
      .filter(Boolean);
    const ips = getClientIps(req);
    const ok = ips.some((ip) => allowed.includes(ip));
    if (!ok) {
      console.warn('[webhook] rejected: source IP not allowlisted', {
        ips,
        allowed,
      });
      return res.status(403).json({ received: false });
    }
  }

  if (!secret && !allowedIpsRaw) {
    console.warn(
      '[webhook] UNSECURED — set HUBTEL_WEBHOOK_SECRET to protect this endpoint from spoofed payment callbacks'
    );
  }

  return next();
}
