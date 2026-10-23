import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Ledger: every balance-changing event is recorded.
 * Types: COMMISSION_DEBIT (driver owes platform), DIGITAL_EARNING (driver share from wallet/card),
 * TOP_UP (driver paid debt), PAYOUT (weekly payout), MANUAL_CREDIT (admin adjustment),
 * CANCELLATION_CREDIT (trip pay when a store/admin cancels after the courier started).
 */
const TRANSACTION_TYPES = [
  'COMMISSION_DEBIT',
  'DIGITAL_EARNING',
  'TOP_UP',
  'PAYOUT',
  'MANUAL_CREDIT',
  'MANUAL_DEBIT',
  'CANCELLATION_CREDIT',
  // Laundry trips done by two riders: half the delivery pay moves from the returning rider
  // (who took the customer's cash) to the one who collected the bag.
  'TRIP_SHARE_CREDIT',
  'TRIP_SHARE_DEBIT',
  // MoMo store orders: the rider's delivery pay. DELIVERY_PAY is a wallet credit, used when the
  // MoMo transfer failed. DIRECT_PAYOUT only shows the rider the pay sent straight to their MoMo:
  // it does not change the balance.
  'DELIVERY_PAY',
  'DIRECT_PAYOUT',
];

const transactionSchema = new Schema(
  {
    ride: {
      type: Schema.Types.ObjectId,
      ref: 'Ride',
      default: null,
    },
    driver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      // Positive = credit to driver balance, Negative = debit (e.g. commission owed)
    },
    type: {
      type: String,
      enum: TRANSACTION_TYPES,
      required: true,
    },
    note: {
      type: String,
      default: null,
    },
    /** Payment reference (e.g. the Paystack transfer or top-up reference) for reconciliation. */
    reference: {
      type: String,
      default: null,
      index: true,
    },
    balanceAfter: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

transactionSchema.index({ driver: 1, createdAt: -1 });
transactionSchema.index({ ride: 1 });
// One wallet credit and one MoMo line per payout, however often settlement runs. (Different key
// orders so older MongoDB versions accept two partial indexes on the same fields.)
transactionSchema.index(
  { reference: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'DELIVERY_PAY' }, name: 'uniq_delivery_pay' }
);
transactionSchema.index(
  { type: 1, reference: 1 },
  { unique: true, partialFilterExpression: { type: 'DIRECT_PAYOUT' }, name: 'uniq_direct_payout' }
);

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
export { TRANSACTION_TYPES };
