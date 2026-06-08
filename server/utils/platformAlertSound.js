/** Resolve platform alert sound URLs for merchant kitchen / rider offers. */

function resolvePath(raw, req) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const pathPart = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const base =
    process.env.PUBLIC_API_URL?.replace(/\/$/, '') ||
    `${req.protocol}://${req.get('host')}`;
  return `${base}${pathPart}`;
}

export function resolveKitchenAlertSoundUrl(settings, req) {
  return resolvePath(settings?.kitchenAlertSoundUrl || '/sounds/new-order.mp3', req);
}

export function resolveRiderAlertSoundUrl(settings, req) {
  return resolvePath(settings?.riderAlertSoundUrl || '/sounds/rider.mp3', req);
}
