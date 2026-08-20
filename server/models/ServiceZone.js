import mongoose from "mongoose";

const { Schema } = mongoose;

export const SERVICE_ZONE_TYPES = ["RIDE", "PARCEL", "FOOD", "GROCERY", "PHARMACY"];

/**
 * Geographic coverage zone: center point + radius (km).
 * Empty serviceTypes = all services available in the zone.
 */
const serviceZoneSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    center: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    /** Allowed distance from center in kilometres. */
    radiusKm: { type: Number, required: true, min: 0.1, max: 500 },
    address: { type: String, default: null },
    isActive: { type: Boolean, default: true, index: true },
    /**
     * Services enabled in this zone. Empty / missing = all services.
     */
    serviceTypes: {
      type: [{ type: String, enum: SERVICE_ZONE_TYPES }],
      default: () => [...SERVICE_ZONE_TYPES],
    },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

serviceZoneSchema.index({ isActive: 1, name: 1 });

const ServiceZone = mongoose.model("ServiceZone", serviceZoneSchema);
export default ServiceZone;
