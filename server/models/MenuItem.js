import mongoose from "mongoose";

const { Schema } = mongoose;

const modifierOptionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    priceDelta: { type: Number, default: 0, min: 0 },
    isDefault: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

const modifierGroupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** choose_one = Fried or Grilled; add_ons = Extra Shito, Add Egg */
    kind: { type: String, enum: ["choose_one", "add_ons"], default: "choose_one" },
    required: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    options: { type: [modifierOptionSchema], default: [] },
  },
  { _id: true }
);

const menuItemSchema = new Schema(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, default: "Mains", trim: true },
    menuCategory: { type: Schema.Types.ObjectId, ref: "MenuCategory", default: null },
    isAvailable: { type: Boolean, default: true },
    /** Item photo (Cloudinary URL or /uploads path) */
    imageUrl: { type: String, default: null },
    /** e.g. popular, new, spicy */
    tags: { type: [String], default: [] },
    /** Merchant discount badge on the item card */
    badge: { type: String, enum: ["discount", null], default: null },
    /** e.g. -30% (auto-generated from discountPercent when possible) */
    discountLabel: { type: String, default: null, trim: true },
    /** Discount 1–99 — sale price = originalPrice × (1 - percent/100) */
    discountPercent: { type: Number, default: null, min: 1, max: 99 },
    /** Original price before discount (shown struck through) */
    originalPrice: { type: Number, default: null, min: 0 },
    /** Per-dish customization groups (add-ons, preparation choices) */
    modifierGroups: { type: [modifierGroupSchema], default: [] },
  },
  { timestamps: true }
);

menuItemSchema.index({ restaurant: 1, category: 1 });

const MenuItem = mongoose.model("MenuItem", menuItemSchema);
export default MenuItem;
