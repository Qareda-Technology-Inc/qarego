import mongoose from "mongoose";

const { Schema } = mongoose;

/** A business asking to sell on QareGO, from the "List your store" form on the website. */
const vendorApplicationSchema = new Schema(
  {
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    contactName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true, maxlength: 120 },
    storeType: { type: String, enum: ["FOOD", "GROCERY", "PHARMACY", "GAS", "OTHER"], required: true },
    area: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, default: "", trim: true, maxlength: 1000 },
    /** new → contacted → invited (vendor account created) | declined */
    status: {
      type: String,
      enum: ["new", "contacted", "invited", "declined"],
      default: "new",
      index: true,
    },
    /** Admin's private note (call outcome, why declined, …). */
    note: { type: String, default: null, maxlength: 1000 },
    vendor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    handledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("VendorApplication", vendorApplicationSchema);
