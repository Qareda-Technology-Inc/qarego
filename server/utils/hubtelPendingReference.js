import FoodPayment from '../models/FoodPayment.js';
import FoodOrder from '../models/FoodOrder.js';
import Ride from '../models/Ride.js';
import PendingTopUp from '../models/PendingTopUp.js';
import Transaction from '../models/Transaction.js';

/** True when Hubtel callback references an in-flight payment or disbursement we initiated. */
export async function isKnownPendingHubtelReference(clientReference) {
  const ref = String(clientReference || '').trim();
  if (!ref) return false;

  if (ref.startsWith('topup_') || ref.startsWith('tu')) {
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

  // Delivery-time food settlement legs (restaurant / rider disbursement).
  if (ref.startsWith('fosr_') || ref.startsWith('fosd_')) {
    const field = ref.startsWith('fosr_') ? 'restaurant' : 'rider';
    return Boolean(
      await FoodOrder.findOne({
        [`settlementDetails.${field}.reference`]: ref,
        [`settlementDetails.${field}.status`]: { $in: ['pending', 'sent', 'failed'] },
      })
        .select('_id')
        .lean()
    );
  }

  // Legacy checkout-time merchant payout.
  if (ref.startsWith('fop_')) {
    return Boolean(
      await FoodPayment.findOne({
        payoutReference: ref,
        payoutStatus: { $in: ['pending', 'failed', 'sent'] },
      })
        .select('_id')
        .lean()
    );
  }

  // Rider cash-out or admin weekly payout — look up the PAYOUT ledger row.
  if (ref.startsWith('cashout_') || ref.startsWith('co') || ref.startsWith('payout_') || ref.startsWith('po')) {
    return Boolean(
      await Transaction.findOne({ reference: ref, type: 'PAYOUT' }).select('_id').lean()
    );
  }

  const foodPayment = await FoodPayment.findOne({ clientReference: ref }).select('status').lean();
  if (foodPayment) return foodPayment.status !== 'success';

  return false;
}
