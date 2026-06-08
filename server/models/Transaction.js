import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Ledger: every balance-changing event is recorded.
 * Types: COMMISSION_DEBIT (driver owes platform), DIGITAL_EARNING (driver share from wallet/card),
 * TOP_UP (driver paid debt), PAYOUT (weekly payout), MANUAL_CREDIT (admin adjustment).
 */
const TRANSACTION_TYPES = [
  'COMMISSION_DEBIT',
  'DIGITAL_EARNING',
  'TOP_UP',
  'PAYOUT',
  'MANUAL_CREDIT',
  'MANUAL_DEBIT',
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
    balanceAfter: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

transactionSchema.index({ driver: 1, createdAt: -1 });
transactionSchema.index({ ride: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
export { TRANSACTION_TYPES };
