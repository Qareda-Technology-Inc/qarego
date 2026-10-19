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
    /** REFILL progress: courier taking the empty to the station, then cylinder at the station. */
    gasStage: { type: String, enum: ["TO_STATION", "AT_STATION", null], default: null },
    /** Courier who collected the empty (REFILL); the return leg goes back to them. */
    gasCourier: { type: Schema.Types.ObjectId, ref: "User", default: null },
    collectionRide: { type: Schema.Types.ObjectId, ref: "Ride", default: null },
    /** EXCHANGE: station confirms the customer's empty cylinder came back. */
    gasEmptyReturnedAt: { type: Date, default: null },
    cancelledBy: {
      type: String,
      enum: ["CUSTOMER", "RESTAURANT", "ADMIN", null],
      default: null,
    },
    cancelledAt: { type: Date, default: null },
    /** Paid MoMo orders that were cancelled: refunded manually through Hubtel, then marked here. */
    refundStatus: {
      type: String,
      enum: ["NONE", "DUE", "REFUNDED"],
      default: "NONE",
      index: true,
    },
    refundedAt: { type: Date, default: null },
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
