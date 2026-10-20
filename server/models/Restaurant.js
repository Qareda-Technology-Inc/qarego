import mongoose from "mongoose";

const { Schema } = mongoose;

const restaurantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    /** High-level store type / section, e.g. Restaurant, Drinks, Bar — from admin catalog */
    category: { type: String, default: "Restaurant", trim: true },
    /** Commerce module: Food, Grocery, or Pharmacy */
    vertical: {
      type: String,
      enum: ["FOOD", "GROCERY", "PHARMACY", "GAS"],
      default: "FOOD",
    },
    /** Primary catalog tag (legacy display) — first entry in tags */
    storeType: { type: Schema.Types.ObjectId, ref: "CommerceStoreType", default: null },
    /** All selected CommerceStoreType ids */
    storeTypes: [{ type: Schema.Types.ObjectId, ref: "CommerceStoreType" }],
    /** Human-readable tag names — e.g. Pizza, Fast Food & Burgers */
    tags: [{ type: String, trim: true }],
    cuisine: { type: String, default: "Local" },
    imageEmoji: { type: String, default: "🍽️" },
    /** Cover/logo photo (Cloudinary URL or /uploads path) */
    imageUrl: { type: String, default: null },
    rating: { type: Number, default: 4.5, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    /**
     * Platform-managed display value (legacy). Actual delivery pricing is distance-based at checkout.
     * Kept for backward compatibility with existing UI / DB records.
     */
    deliveryFee: { type: Number, default: 0, min: 0 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    estimatedPrepMinutes: { type: Number, default: 25, min: 5 },
    isActive: { type: Boolean, default: true },
    address: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    /** Merchant (vendor) who owns/operates this restaurant. Null for seeded/unassigned. */
    owner: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** Vendor can pause accepting new orders without going inactive platform-wide */
    isAcceptingOrders: { type: Boolean, default: true },
    /** QareGO's share still owed by the store from cash pickup orders (see StoreLedgerEntry). */
    commissionOwed: { type: Number, default: 0 },
    /** Merchant instant settlement destination (QareGO collect -> Hubtel send). */
    payoutConfig: {
      instantPayoutEnabled: { type: Boolean, default: false },
      recipientName: { type: String, default: null },
      recipientMsisdn: { type: String, default: null },
      channel: { type: String, default: 'mtn-gh' },
    },
    /** Customer can collect orders in-store (no delivery fee) */
    allowsPickup: { type: Boolean, default: false },
    /**
     * Weekly opening hours, indexed by JS getDay() (0 = Sun … 6 = Sat).
     * Undefined/empty means "always within hours" (only the pause flag gates it).
     */
    /**
     * QareGO's check before a store goes live. Stores a vendor creates start as "draft"
     * (hidden); stores created by an admin, and stores from before reviews existed (no
     * review at all), count as approved.
     */
    review: {
      status: {
        type: String,
        enum: ["draft", "pending", "changes_requested", "approved"],
      },
      note: { type: String, default: null },
      submittedAt: { type: Date, default: null },
      decidedAt: { type: Date, default: null },
      by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    /** Operating licence photo — required for pharmacies (Pharmacy Council) and gas (NPA). */
    licence: {
      url: { type: String, default: null },
      number: { type: String, default: null, trim: true },
      uploadedAt: { type: Date, default: null },
    },
    openingHours: {
      type: [
        {
          _id: false,
          closed: { type: Boolean, default: false },
          open: { type: String, default: "08:00" },
          close: { type: String, default: "22:00" },
        },
      ],
      default: undefined,
    },
  },
  { timestamps: true }
);

const Restaurant = mongoose.model("Restaurant", restaurantSchema);
export default Restaurant;
