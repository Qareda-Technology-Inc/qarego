import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * A customer cancelled a ride or parcel after the rider had arrived (or during the trip).
 * The cancelled ride itself is deleted, so this is the record that's counted for the late-cancel
 * limit and shown to admin (utils/lateCancel.js).
 */
const lateCancellationSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rider: { type: Schema.Types.ObjectId, ref: "User", default: null },
    ride: { type: Schema.Types.ObjectId, default: null },
    serviceType: { type: String, default: null },
    /** Ride status when it was cancelled: ARRIVED or IN_PROGRESS. */
    stage: { type: String, default: null },
    /** What QareGO paid the rider (0 when the fee was off). */
    riderPaid: { type: Number, default: 0 },
    pickup: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

lateCancellationSchema.index({ customer: 1, createdAt: -1 });
lateCancellationSchema.index({ ride: 1 }, { unique: true, partialFilterExpression: { ride: { $type: "objectId" } } });

export default mongoose.model("LateCancellation", lateCancellationSchema);
