import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Global settings (admin-editable). Single document for platform config.
 * commission_rate: e.g. 0.15 = 15%. Driver keeps (1 - commission_rate) * fare.
 * debt_limit: negative balance threshold (e.g. -100). If driver_balance < debt_limit, suspend (SUSPENDED_DEBT).
 */
const settingsSchema = new Schema(
  {
    key: {
      type: String,
      default: 'global',
      unique: true,
    },
    commissionRate: {
      type: Number,
      default: 0.15,
      min: 0,
      max: 1,
    },
    /** Optional per-service commission override: { RIDE, DELIVERY, FOOD } */
    commissionByService: {
      type: Schema.Types.Mixed,
      default: null,
    },
    debtLimit: {
      type: Number,
      default: -100,
      // Negative number: e.g. -100 means driver blocked when balance < -100 (owes more than 100)
    },
    /** Per-vehicle fare: { motorcycle: { baseFare, perKmRate, minimumFare }, pragya, comfort } */
    fareRates: {
      type: Schema.Types.Mixed,
      default: null,
    },
    /** Food checkout platform service fee: subtotal * rate, clamped by min/max */
    foodServiceFeeRate: {
      type: Number,
      default: 0.08,
      min: 0,
      max: 1,
    },
    foodServiceFeeMin: {
      type: Number,
      default: 2,
      min: 0,
    },
    foodServiceFeeMax: {
      type: Number,
      default: 12,
      min: 0,
    },
    /** URL path or absolute URL for merchant kitchen new-order alert (looped mp3) */
    kitchenAlertSoundUrl: {
      type: String,
      default: '/sounds/new-order.mp3',
    },
    /** Rider app: loops while ride/food offers are waiting for acceptance */
    riderAlertSoundUrl: {
      type: String,
      default: '/sounds/rider.mp3',
    },
    /** Admin: allow pragya/comfort to receive food courier offers */
    vehicleCapabilityPolicy: {
      type: Schema.Types.Mixed,
      default: () => ({ pragyaFoodEnabled: false, comfortFoodEnabled: false }),
    },
    /** Per-service maintenance: { RIDE, DELIVERY, FOOD } — true = offers paused */
    serviceMaintenance: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    /** Dispatch score tuning: fareWeight, pickupPenaltyPerKm, etc. */
    dispatchRankingWeights: {
      type: Schema.Types.Mixed,
      default: null,
    },
    /** Per-service strike rules: strikesBeforePause, pauseDurationHours, etc. */
    reliabilityPolicy: {
      type: Schema.Types.Mixed,
      default: () => ({
        strikesBeforePause: 5,
        pauseDurationHours: 24,
        strikeDecayOnCompletion: 1,
      }),
    },
    /** Admin-editable FCM templates: { [templateKey]: { title, body, enabled } } */
    pushNotificationTemplates: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    /**
     * Default customer menu layout per category name (row = horizontal scroll, column = grid).
     * [{ name: "Drinks", displayLayout: "row" }, ...]
     */
    menuCategoryLayouts: {
      type: Schema.Types.Mixed,
      default: () => [
        { name: "Drinks", displayLayout: "row" },
        { name: "Sides", displayLayout: "row" },
        { name: "Mains", displayLayout: "column" },
      ],
    },
    /**
     * Customer food/grocery/pharmacy home promos — admin uploads images.
     * [{ imageUrl, vertical?: FOOD|GROCERY|PHARMACY|ALL, enabled, sortOrder }]
     */
    foodPromoBanners: {
      type: Schema.Types.Mixed,
      default: () => [],
    },
  },
  { timestamps: true }
);

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
