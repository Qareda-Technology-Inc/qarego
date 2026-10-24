import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Money a store owes QareGO, and what it has paid back. Cash pickup orders leave QareGO's share
 * (commission + service fee) with the store. The store pays it back by MoMo/card in the merchant
 * portal, or in cash that admin records.
 * amount > 0 = store now owes more; amount < 0 = payment received.
 */
const storeLedgerEntrySchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    foodOrder: { type: Schema.Types.ObjectId, ref: "FoodOrder", default: null },
    // MOMO_PAYMENT: paid by the store in the merchant portal (Paystack). CASH_PAYMENT: recorded by admin.
    type: { type: String, enum: ["PICKUP_COMMISSION", "CASH_PAYMENT", "MOMO_PAYMENT", "CANCELLATION_FEE"], required: true },
    amount: { type: Number, required: true },
    owedAfter: { type: Number, required: true },
    note: { type: String, default: null },
  },
  { timestamps: true }
);

// One commission entry per order, so a retried settlement can't charge twice.
storeLedgerEntrySchema.index(
  { foodOrder: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: "PICKUP_COMMISSION" } }
);

export default mongoose.model("StoreLedgerEntry", storeLedgerEntrySchema);
