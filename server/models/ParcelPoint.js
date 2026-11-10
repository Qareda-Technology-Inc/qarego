import mongoose from "mongoose";

const { Schema } = mongoose;

export const PARCEL_POINT_KINDS = ["BUS_STATION", "MALL", "SHOP", "OFFICE", "OTHER"];

/**
 * A well-known place the admin adds (bus station, mall, partner shop…) that customers
 * can pick as a parcel pickup or drop-off instead of searching for an address.
 */
const parcelPointSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: PARCEL_POINT_KINDS, default: "OTHER" },
    address: { type: String, default: null },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    /** Where exactly to meet / hand over, shown to the rider (e.g. "Gate 2, VIP ticket office"). */
    instructions: { type: String, default: null },
    phone: { type: String, default: null },
    /** Free text, e.g. "Mon–Sat 6am–9pm". */
    hours: { type: String, default: null },
    canPickup: { type: Boolean, default: true },
    canDrop: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

parcelPointSchema.index({ isActive: 1, name: 1 });

const ParcelPoint = mongoose.model("ParcelPoint", parcelPointSchema);
export default ParcelPoint;
