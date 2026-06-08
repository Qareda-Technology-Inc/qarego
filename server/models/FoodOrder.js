import mongoose from "mongoose";

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
    total: { type: Number, required: true, min: 0 },
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
    notes: { type: String, default: null },
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
    /** 4-digit code — customer shares with courier at delivery (mirrors linked ride OTP) */
    deliveryCode: { type: String, default: null },
    cancelReason: { type: String, default: null },
    restaurantRating: { type: Number, min: 1, max: 5, default: null },
    restaurantReview: { type: String, default: null },
  },
  { timestamps: true }
);

const FoodOrder = mongoose.model("FoodOrder", foodOrderSchema);
export default FoodOrder;
