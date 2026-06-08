import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * A merchant-defined store category (e.g. "Restaurant", "Pizza", "Pharmacy").
 * Categories are scoped to the vendor who created them and reused when they
 * open new stores.
 */
const storeCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// One category name per vendor
storeCategorySchema.index({ owner: 1, name: 1 }, { unique: true });

const StoreCategory = mongoose.model("StoreCategory", storeCategorySchema);
export default StoreCategory;
