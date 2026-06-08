import mongoose from "mongoose";

const { Schema } = mongoose;

/** Merchant-defined menu section for one store (e.g. "Jollof", "Drinks"). */
const menuCategorySchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
    name: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    /** How items render in the customer app for this category */
    displayLayout: {
      type: String,
      enum: ["row", "column"],
      default: "column",
    },
  },
  { timestamps: true }
);

menuCategorySchema.index({ restaurant: 1, name: 1 }, { unique: true });

const MenuCategory = mongoose.model("MenuCategory", menuCategorySchema);
export default MenuCategory;
