import FoodPayment from '../models/FoodPayment.js';
import Ride from '../models/Ride.js';
import PendingTopUp from '../models/PendingTopUp.js';

/** True when Hubtel callback references an in-flight payment we initiated. */
export async function isKnownPendingHubtelReference(clientReference) {
  const ref = String(clientReference || '').trim();
  if (!ref) return false;

  if (ref.startsWith('topup_')) {
    return Boolean(
      await PendingTopUp.findOne({ clientReference: ref, status: 'pending' }).select('_id').lean()
    );
  }

  if (ref.startsWith('rd')) {
    return Boolean(
      await Ride.findOne({
        paymentReference: ref,
        paymentStatus: { $in: ['UNPAID', 'PENDING', null] },
      })
        .select('_id')
        .lean()
    );
  }

  const foodPayment = await FoodPayment.findOne({ clientReference: ref }).select('status').lean();
  if (foodPayment) return foodPayment.status !== 'success';

  return false;
}
