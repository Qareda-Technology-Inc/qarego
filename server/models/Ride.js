import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Ride types: motorcycle, pragya (tricycle), comfort (car). Service: RIDE, DELIVERY (parcel), FOOD. */
const rideSchema = new Schema(
  {
    serviceType: {
      type: String,
      enum: ["RIDE", "DELIVERY", "FOOD"],
      default: "RIDE",
    },
    vehicle: {
      type: String,
      enum: ["motorcycle", "pragya", "comfort", "bike", "auto", "cabEconomy", "cabPremium"],
      required: true,
    },
    distance: {
      type: Number,
      required: true,
    },
    pickup: {
      address: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    drop: {
      address: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    // Delivery-only: recipient and parcel info (optional for RIDE)
    parcelMode: {
      type: String,
      enum: ["SEND", "RECEIVE"],
      default: "SEND",
    },
    recipientName: { type: String, default: null },
    recipientPhone: { type: String, default: null },
    deliveryNote: { type: String, default: null },
    parcelDescription: { type: String, default: null },
    parcelPhotoUrl: { type: String, default: null },
    /** Parcel only: recipient handoff code (pickup uses `otp`). */
    deliveryOtp: { type: String, default: null },
    foodOrder: { type: Schema.Types.ObjectId, ref: "FoodOrder", default: null },
    restaurantName: { type: String, default: null },
    /** FOOD courier rides: store module vertical for rider/customer copy */
    storeVertical: {
      type: String,
      enum: ["FOOD", "GROCERY", "PHARMACY"],
      default: null,
    },
    foodOrderSummary: { type: String, default: null },
    fare: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "MOBILE_MONEY"],
      default: "CASH",
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rider: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["SEARCHING_FOR_RIDER", "START", "ARRIVED", "IN_PROGRESS", "COMPLETED"],
      default: "SEARCHING_FOR_RIDER",
    },
    otp: {
      type: String,
      default: null,
    },
    customerRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    riderRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    customerReview: {
      type: String,
      default: null,
    },
    riderReview: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Ride = mongoose.model("Ride", rideSchema);
export default Ride;
