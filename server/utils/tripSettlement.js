/**
 * Trip completion settlement: commission split, ledger entries, balance update, debt check.
 * Called when a ride status is set to COMPLETED.
 */
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const DEFAULT_COMMISSION_RATE = 0.15;
const DEFAULT_DEBT_LIMIT = -100;
const VALID_SERVICE_TYPES = ["RIDE", "DELIVERY", "FOOD"];

export function getCommissionRateForService(settings, serviceType) {
  const normalizedType = VALID_SERVICE_TYPES.includes(serviceType) ? serviceType : "RIDE";
  const fallback = Number(settings?.commissionRate ?? DEFAULT_COMMISSION_RATE);
  const map = settings?.commissionByService;
  if (!map || typeof map !== "object") return fallback;
  const serviceRate = Number(map[normalizedType]);
  if (!Number.isFinite(serviceRate) || serviceRate < 0 || serviceRate > 1) return fallback;
  return serviceRate;
}

/** Get global settings (create default if missing) */
export async function getSettings() {
  let settings = await Settings.findOne({ key: 'global' });
  if (!settings) {
    settings = await Settings.create({
      key: 'global',
      commissionRate: DEFAULT_COMMISSION_RATE,
      debtLimit: DEFAULT_DEBT_LIMIT,
    });
  }
  return settings;
}

/**
 * Run settlement for a completed ride.
 * - Fetches fare and commission rate
 * - Creates ledger entries (COMMISSION_DEBIT; DIGITAL_EARNING if WALLET/CARD)
 * - Updates driver balance
 * - Checks debt limit and suspends driver if needed
 * Idempotent: skips if transactions for this ride already exist.
 */
export async function settleTrip(ride) {
  if (!ride.rider || !ride.fare) return;

  const riderId = ride.rider._id || ride.rider;
  const rideId = ride._id;

  // Idempotent: already settled?
  const existing = await Transaction.findOne({ ride: rideId });
  if (existing) return;

  const settings = await getSettings();
  const commissionRate = getCommissionRateForService(settings, ride.serviceType);
  const debtLimit = settings.debtLimit ?? DEFAULT_DEBT_LIMIT;

  const fare = Number(ride.fare);
  const qaregoShare = fare * commissionRate;
  const driverShare = fare - qaregoShare;

  const paymentMethod = ride.paymentMethod || 'CASH';

  const driver = await User.findById(riderId);
  if (!driver) return;

  let balance = Number(driver.balance ?? 0);

  // 1) COMMISSION_DEBIT: driver owes platform (always, for cash or digital)
  balance -= qaregoShare;
  await Transaction.create({
    ride: rideId,
    driver: riderId,
    amount: -qaregoShare,
    type: 'COMMISSION_DEBIT',
    note: `${(commissionRate * 100).toFixed(0)}% of ${fare.toFixed(2)}`,
    balanceAfter: balance,
  });

  // 2) DIGITAL_EARNING: only if paid via MOBILE_MONEY (QareGO holds the fare, driver gets share)
  if (paymentMethod === 'MOBILE_MONEY') {
    balance += driverShare;
    await Transaction.create({
      ride: rideId,
      driver: riderId,
      amount: driverShare,
      type: 'DIGITAL_EARNING',
      note: `Driver share (${paymentMethod})`,
      balanceAfter: balance,
    });
  }
  // If CASH: driver keeps full fare; we only debited commission, no credit

  await User.findByIdAndUpdate(riderId, { balance });

  // 3) Safety valve: suspend if balance below debt limit
  if (balance < debtLimit) {
    await User.findByIdAndUpdate(riderId, {
      'driverDetails.status': 'suspended_debt',
    });
    // TODO: send_notification("Your balance is too low. Top up to continue receiving rides.")
  }
}
