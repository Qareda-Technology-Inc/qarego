import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Platform store type — created by admin.
 * Defines which commerce module a store belongs to (Food, Grocery, Pharmacy).
 * Examples: Restaurant, Drinks, Bar (FOOD); Supermarket (GROCERY); Pharmacy (PHARMACY).
 */
const commerceStoreTypeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    vertical: {
      type: String,
      enum: ["FOOD", "GROCERY", "PHARMACY"],
      required: true,
    },
    emoji: { type: String, default: "🍽️", trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

commerceStoreTypeSchema.index({ vertical: 1, name: 1 }, { unique: true });

const CommerceStoreType = mongoose.model("CommerceStoreType", commerceStoreTypeSchema);
export default CommerceStoreType;
