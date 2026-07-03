import mongoose from 'mongoose';

const { Schema } = mongoose;

const foodPaymentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'FoodOrder', required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    amount: { type: Number, required: true, min: 0 },
    clientReference: { type: String, required: true, unique: true, index: true },
    checkoutId: { type: String, default: null },
    checkoutUrl: { type: String, default: null },
    checkoutDirectUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ['initiated', 'pending', 'success', 'failed', 'cancelled'],
      default: 'initiated',
      index: true,
    },
    paymentMethod: { type: String, default: null },
    paymentChannel: { type: String, default: null },
    hubtelTransactionId: { type: String, default: null },
    externalTransactionId: { type: String, default: null },
    callbackPayload: { type: Schema.Types.Mixed, default: null },
    statusPayload: { type: Schema.Types.Mixed, default: null },
    lastStatusCheckAt: { type: Date, default: null },
    payoutStatus: {
      type: String,
      enum: ['not_applicable', 'pending', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    payoutReference: { type: String, default: null },
    payoutAmount: { type: Number, default: 0 },
    payoutError: { type: String, default: null },
    payoutResponse: { type: Schema.Types.Mixed, default: null },
    payoutAttemptedAt: { type: Date, default: null },
    payoutCompletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

foodPaymentSchema.index({ restaurant: 1, createdAt: -1 });
foodPaymentSchema.index({ customer: 1, createdAt: -1 });

const FoodPayment = mongoose.model('FoodPayment', foodPaymentSchema);
export default FoodPayment;
