import mongoose from 'mongoose';

const { Schema } = mongoose;

/** A rider's commission-debt payment on Paystack's checkout; the balance is credited once Paystack confirms it. */
const pendingTopUpSchema = new Schema(
  {
    driver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    clientReference: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    /** Paystack's verify response once paid. */
    providerResponse: { type: Schema.Types.Mixed },
    provider: { type: String, enum: ['paystack'], default: 'paystack' },
    /** Paystack checkout the rider pays on (reused while unpaid). */
    checkoutUrl: { type: String, default: null },
  },
  { timestamps: true }
);

pendingTopUpSchema.index({ driver: 1, status: 1 });

const PendingTopUp = mongoose.model('PendingTopUp', pendingTopUpSchema);
export default PendingTopUp;
