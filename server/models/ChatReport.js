import mongoose from "mongoose";

const { Schema } = mongoose;

/** A customer or rider reporting the other person in an in-trip chat. */
const chatReportSchema = new Schema(
  {
    ride: { type: Schema.Types.ObjectId, ref: "Ride", required: true },
    reporter: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reportedUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: {
      type: String,
      enum: ["ABUSIVE", "HARASSMENT", "SPAM", "SAFETY", "OTHER"],
      required: true,
    },
    details: { type: String, default: "", trim: true, maxlength: 1000 },
    /** The chat as it was when reported, so later deletions don't hide what was said. */
    messages: [
      {
        _id: false,
        sender: { type: Schema.Types.ObjectId, ref: "User" },
        text: String,
        image: String,
        sentAt: Date,
      },
    ],
    /** open → resolved */
    status: { type: String, enum: ["open", "resolved"], default: "open", index: true },
    /** Admin's private note (what was done about it). */
    note: { type: String, default: null, maxlength: 1000 },
    handledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("ChatReport", chatReportSchema);
