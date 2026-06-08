import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Pending top-up: driver initiated payment; webhook will credit balance when Hubtel confirms */
const pendingTopUpSchema = new Schema(
  {
    driver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    clientReference: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    hubtelResponse: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

pendingTopUpSchema.index({ clientReference: 1 });
pendingTopUpSchema.index({ driver: 1, status: 1 });

const PendingTopUp = mongoose.model('PendingTopUp', pendingTopUpSchema);
export default PendingTopUp;
