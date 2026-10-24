import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * One thing an admin-portal account did: a change it made (recorded automatically by
 * requireAdmin after a successful request) or a sign-in. See utils/adminActivity.js.
 */
const adminActivitySchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Name and role at the time, so the entry still reads right after a rename or role change. */
    actorName: { type: String, default: null },
    actorRole: { type: String, default: null },
    /** Short machine name of the action, e.g. "rider.approve", "store.free_period". */
    action: { type: String, required: true },
    /** Kind of thing it was done to: rider, vendor, store, customer, trip, order, team, settings… */
    area: { type: String, required: true },
    /** Plain sentence, without the actor: "approved rider Kofi Mensah". */
    summary: { type: String, required: true },
    target: {
      type: { type: String, default: null },
      id: { type: String, default: null },
      label: { type: String, default: null },
    },
    /** Request fields worth keeping (amounts, decisions, changed setting names). Never passwords. */
    details: { type: Schema.Types.Mixed, default: null },
    method: { type: String, default: null },
    path: { type: String, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminActivitySchema.index({ createdAt: -1 });
adminActivitySchema.index({ actor: 1, createdAt: -1 });
adminActivitySchema.index({ area: 1, createdAt: -1 });

export default mongoose.model("AdminActivity", adminActivitySchema);
