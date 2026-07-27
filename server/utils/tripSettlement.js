/**
 * Trip completion settlement: commission split, ledger entries, balance update, debt check.
 * Called when a ride status is set to COMPLETED.
 *
 * Cash: rider keeps the fare in hand; we only debit commission from virtual balance.
 * MoMo: QareGO collected the fare; credit full fare then debit commission → net = driver share.
 */
import Settings from '../models/Settings.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const DEFAULT_COMMISSION_RATE = 0.15;
const DEFAULT_DEBT_LIMIT = -100;
const VALID_SERVICE_TYPES = ["RIDE", "DELIVERY", "FOOD"];

function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

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
 * Idempotent: skips if transactions for this ride already exist.
 */
export async function settleTrip(ride) {
  if (!ride.rider || !ride.fare) return;

  const riderId = ride.rider._id || ride.rider;
  const rideId = ride._id;

  const existing = await Transaction.findOne({ ride: rideId });
  if (existing) return;

  const settings = await getSettings();
  const commissionRate = getCommissionRateForService(settings, ride.serviceType);
  const debtLimit = settings.debtLimit ?? DEFAULT_DEBT_LIMIT;

  const fare = roundMoney(ride.fare);
  const qaregoShare = roundMoney(fare * commissionRate);
  const driverShare = roundMoney(fare - qaregoShare);

  const paymentMethod = ride.paymentMethod || 'CASH';

  const driver = await User.findById(riderId);
  if (!driver) return;

  let balance = roundMoney(driver.balance ?? 0);

  // MoMo: QareGO holds the full fare — credit it first, then take commission.
  // Net wallet change = driverShare. (Previously credited only driverShare AFTER
  // also debiting commission → undercredit of one commission amount.)
  if (paymentMethod === 'MOBILE_MONEY') {
    balance = roundMoney(balance + fare);
    await Transaction.create({
      ride: rideId,
      driver: riderId,
      amount: fare,
      type: 'DIGITAL_EARNING',
      note: `Trip fare collected via MoMo (net after commission: ${driverShare.toFixed(2)})`,
      balanceAfter: balance,
    });
  }

  // Commission always debited from virtual balance (cash or MoMo).
  balance = roundMoney(balance - qaregoShare);
  await Transaction.create({
    ride: rideId,
    driver: riderId,
    amount: -qaregoShare,
    type: 'COMMISSION_DEBIT',
    note: `${(commissionRate * 100).toFixed(0)}% of ${fare.toFixed(2)}`,
    balanceAfter: balance,
  });

  await User.findByIdAndUpdate(riderId, { balance });

  if (balance < debtLimit) {
    await User.findByIdAndUpdate(riderId, {
      'driverDetails.status': 'suspended_debt',
    });
  }
}
