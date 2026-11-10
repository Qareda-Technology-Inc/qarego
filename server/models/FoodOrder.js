import mongoose from "mongoose";

import { clientRequestIdIndex } from "../utils/idempotency.js";
const { Schema } = mongoose;

const foodOrderModifierSchema = new Schema(
  {
    groupId: { type: String, default: null },
    groupName: { type: String, required: true },
    optionId: { type: String, default: null },
    optionName: { type: String, required: true },
    priceDelta: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const foodOrderItemSchema = new Schema(
  {
    menuItem: { type: Schema.Types.ObjectId, ref: "MenuItem" },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    modifiers: { type: [foodOrderModifierSchema], default: [] },
  },
  { _id: false }
);

const foodOrderSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    restaurant: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
    restaurantName: { type: String, required: true },
    items: { type: [foodOrderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    serviceFee: { type: Number, required: true, min: 0, default: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    driverFee: { type: Number, required: true, min: 0 },
    /** Store → customer distance (km) when the order was quoted. */
    deliveryDistanceKm: { type: Number, default: null, min: 0 },
    total: { type: Number, required: true, min: 0 },
    /** Frozen split at order creation (admin rates). */
    restaurantCommissionRate: { type: Number, default: null, min: 0, max: 1 },
    /** Placed during the store's commission-free period (restaurantCommissionRate is 0). */
    commissionFree: { type: Boolean, default: false },
    riderCommissionRate: { type: Number, default: null, min: 0, max: 1 },
    restaurantCommission: { type: Number, default: null, min: 0 },
    restaurantNet: { type: Number, default: null, min: 0 },
    riderCommission: { type: Number, default: null, min: 0 },
    riderNet: { type: Number, default: null, min: 0 },
    platformNet: { type: Number, default: null, min: 0 },
    settlementStatus: {
      type: String,
      enum: ["pending", "processing", "settled", "failed", "not_required"],
      default: "pending",
      index: true,
    },
    settlementMethod: {
      type: String,
      enum: ["momo", "cash", "cash_pickup", null],
      default: null,
    },
    settledAt: { type: Date, default: null },
    settlementError: { type: String, default: null },
    settlementDetails: { type: Schema.Types.Mixed, default: null },
    delivery: {
      address: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "MOBILE_MONEY"],
      default: "CASH",
    },
    paymentStatus: {
      type: String,
      enum: ["NOT_REQUIRED", "UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "NOT_REQUIRED",
    },
    paymentReference: { type: String, default: null },
    notes: { type: String, default: null },
    /** Pharmacy prescription photos (Cloudinary URL or /uploads path). */
    prescriptionUrls: { type: [String], default: [] },
    promoCode: { type: String, default: null },
    fulfillmentType: {
      type: String,
      enum: ["DELIVERY", "PICKUP", "SCHEDULED"],
      default: "DELIVERY",
    },
    scheduledFor: { type: Date, default: null },
    /** SCHEDULED orders: when the kitchen should start so the food is ready for the rider. */
    kitchenStartAt: { type: Date, default: null },
    status: {
      type: String,
      enum: [
        "PLACED",
        "CONFIRMED",
        "PREPARING",
        "READY_FOR_PICKUP",
        "PICKED_UP",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "PLACED",
    },
    ride: { type: Schema.Types.ObjectId, ref: "Ride", default: null },
    /** Order sat unaccepted: when the store was reminded and when QareGO's team was alerted. */
    storeReminderSentAt: { type: Date, default: null },
    teamAlertSentAt: { type: Date, default: null },
    /** When the store started preparing (accept). */
    preparingStartedAt: { type: Date, default: null },
    /** Scheduled time to broadcast courier offers (half prep or 5 min before ready, whichever is later). */
    courierBroadcastAt: { type: Date, default: null },
    /** True after early courier broadcast has been sent (or ride created on ready). */
    courierBroadcastSent: { type: Boolean, default: false },
    /** 4-digit code — customer shares with courier at delivery (mirrors linked ride OTP) */
    deliveryCode: { type: String, default: null, select: false },
    /** App-generated id for this checkout attempt; makes retries duplicate-safe. */
    clientRequestId: { type: String, default: null },
    cancelReason: { type: String, default: null },
    /** Cooking gas orders (vertical GAS) */
    gasMode: { type: String, enum: ["REFILL", "EXCHANGE", null], default: null },
    gasSizeKg: { type: Number, default: null },
    /** REFILL bought by amount: cedis of gas to put in the cylinder. Null = fill it up. */
    gasAmount: { type: Number, default: null },
    /**
     * Collect-first orders (gas REFILL, laundry): courier taking it to the store, then at the store.
     * The gas* names predate laundry; they're kept so existing apps keep reading them.
     */
    gasStage: { type: String, enum: ["TO_STATION", "AT_STATION", null], default: null },
    /** Courier who collected the empty (REFILL); the return leg goes back to them. */
    gasCourier: { type: Schema.Types.ObjectId, ref: "User", default: null },
    collectionRide: { type: Schema.Types.ObjectId, ref: "Ride", default: null },
    /** EXCHANGE: station confirms the customer's empty cylinder came back. */
    gasEmptyReturnedAt: { type: Date, default: null },
    /**
     * Sold by QareGO's own gas store (settings.gas.houseStoreId), not a partner station. For a
     * refill the rider fills the cylinder at any filling place near them.
     */
    gasByQarego: { type: Boolean, default: false },
    /** REFILL by QareGO: the listed LPG filling station the rider is sent to (they can switch). */
    gasFillStation: {
      id: { type: String, default: null },
      name: { type: String, default: null },
      address: { type: String, default: null },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    /** REFILL by QareGO: where the rider was when they reached the filling place. */
    gasFillPoint: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    /**
     * Laundry orders (vertical LAUNDRY). Like a gas refill they are collected first: a courier
     * brings the bag to the shop (gasStage/gasCourier/collectionRide track that leg), the shop
     * counts the items and confirms the price, washes, then a courier returns it.
     * Null for every other order.
     */
    laundry: {
      type: new Schema(
        {
          /** What the customer chose at checkout, before the shop counted. */
          estimatedSubtotal: { type: Number, required: true },
          estimatedItemCount: { type: Number, required: true },
          /**
           * estimate: not counted yet · approved: counted, ready to wash (auto when the count
           * isn't dearer) · awaiting_customer: counted dearer, customer must approve ·
           * declined: customer said no, it comes back unwashed and they pay delivery only.
           */
          priceStatus: {
            type: String,
            enum: ["estimate", "awaiting_customer", "approved", "declined"],
            default: "estimate",
          },
          countedAt: { type: Date, default: null },
          countedItemCount: { type: Number, default: null },
          /** Subtotal before the shop's count, kept when the count changed it. */
          previousSubtotal: { type: Number, default: null },
          decidedAt: { type: Date, default: null },
          /** Start of the booked 2-hour collection window; null = collect as soon as accepted. */
          pickupAt: { type: Date, default: null },
          /** Services in the bag (WASH_FOLD, WASH_IRON, DRY_CLEAN, IRON_ONLY). */
          services: { type: [String], default: [] },
          /** Express: faster turnaround for the shop's fee (part of the subtotal, so the shop's). */
          express: { type: Boolean, default: false },
          expressFee: { type: Number, default: 0 },
          /** When the clean laundry is promised back. */
          returnBy: { type: Date, default: null },
          /** Shop's photos when counting (stains, damage, the bag) and its note. */
          countPhotos: { type: [String], default: [] },
          countNote: { type: String, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    /**
     * Prescription requests (vertical PHARMACY): the customer sent a photo or a list instead of a
     * basket. The pharmacist prices it (items, subtotal and fees are filled in then), the customer
     * approves, and only then does the order start. Null for every other order.
     */
    pharmacyQuote: {
      type: new Schema(
        {
          /** awaiting_pharmacy → awaiting_customer → approved | declined (declined = cancelled). */
          priceStatus: {
            type: String,
            enum: ["awaiting_pharmacy", "awaiting_customer", "approved", "declined"],
            default: "awaiting_pharmacy",
          },
          /** What the customer wrote with the photo. */
          request: { type: String, default: null },
          quotedAt: { type: Date, default: null },
          /** Medicines on the prescription the pharmacy doesn't have. */
          unavailable: { type: [String], default: [] },
          pharmacistNote: { type: String, default: null },
          decidedAt: { type: Date, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    cancelledBy: {
      type: String,
      // SYSTEM: cancelled automatically (a mobile money order never paid; utils/unpaidOrders.js).
      enum: ["CUSTOMER", "RESTAURANT", "ADMIN", "SYSTEM", null],
      default: null,
    },
    cancelledAt: { type: Date, default: null },
    /** Paid MoMo orders that were cancelled: refunded through Paystack (or by hand, then marked here). */
    refundStatus: {
      type: String,
      enum: ["NONE", "DUE", "REFUNDED"],
      default: "NONE",
      index: true,
    },
    refundedAt: { type: Date, default: null },
    /** Automatic refund through the payment provider (Paystack): its id, state and any error. */
    refund: {
      type: new Schema(
        {
          providerId: { type: String, default: null },
          status: { type: String, enum: ["requested", "processed", "failed"], default: "requested" },
          requestedAt: { type: Date, default: null },
          error: { type: String, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    restaurantRating: { type: Number, min: 1, max: 5, default: null },
    restaurantReview: { type: String, default: null },
    /** Every status the order went through, with when (filled in automatically below). */
    timeline: {
      type: [{ status: String, at: Date, _id: false }],
      default: () => [],
    },
  },
  { timestamps: true }
);

/*
 * Record each status change in `timeline`, however it's written: order.save() or a
 * findOneAndUpdate/updateOne that sets status. Refunds are recorded the same way.
 */
foodOrderSchema.pre("save", function recordTimeline(next) {
  const at = new Date();
  if (this.isNew) {
    if (!this.timeline?.length) this.timeline = [{ status: this.status || "PLACED", at: this.createdAt || at }];
  } else if (this.isModified("status")) {
    this.timeline.push({ status: this.status, at });
  }
  if (!this.isNew && this.isModified("refundStatus") && this.refundStatus === "REFUNDED") {
    this.timeline.push({ status: "REFUNDED", at });
  }
  next();
});

function recordTimelineOnUpdate(next) {
  const update = this.getUpdate() || {};
  const set = update.$set || {};
  const status = set.status ?? update.status;
  const refund = set.refundStatus ?? update.refundStatus;
  const events = [];
  if (typeof status === "string") events.push({ status, at: new Date() });
  if (refund === "REFUNDED") events.push({ status: "REFUNDED", at: new Date() });
  if (events.length) {
    update.$push = { ...(update.$push || {}), timeline: { $each: events } };
    this.setUpdate(update);
  }
  next();
}
foodOrderSchema.pre("findOneAndUpdate", recordTimelineOnUpdate);
foodOrderSchema.pre("updateOne", recordTimelineOnUpdate);
foodOrderSchema.pre("updateMany", recordTimelineOnUpdate);

foodOrderSchema.index(...clientRequestIdIndex);

// Same rule as Ride codes: only the order's customer may see the delivery code.
export const FOOD_CODE_FIELDS = "+deliveryCode";
const stripCode = (_doc, ret) => {
  delete ret.deliveryCode;
  return ret;
};
foodOrderSchema.set("toJSON", { transform: stripCode });
foodOrderSchema.set("toObject", { transform: stripCode });

const FoodOrder = mongoose.model("FoodOrder", foodOrderSchema);
export default FoodOrder;
