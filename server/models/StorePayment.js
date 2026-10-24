import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * A store paying what it owes QareGO, on Paystack's checkout (merchant portal → Pay QareGO).
 * The store's balance drops once Paystack confirms it (utils/storePayments.js).
 */
const storePaymentSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    /** The vendor account that started it. */
    paidBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    amount: { type: Number, required: true, min: 0 },
    clientReference: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "pending", index: true },
    checkoutUrl: { type: String, default: null },
    channel: { type: String, default: null },
    providerResponse: { type: Schema.Types.Mixed, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

storePaymentSchema.index({ restaurant: 1, status: 1 });

export default mongoose.model("StorePayment", storePaymentSchema);
