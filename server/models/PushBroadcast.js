import mongoose from "mongoose";

const pushBroadcastSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    audience: {
      type: String,
      enum: ["all", "app_users", "customers", "riders", "merchants"],
      required: true,
    },
    deepLink: { type: String, default: null },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    usersTargeted: { type: Number, default: 0 },
    devicesTargeted: { type: Number, default: 0 },
    sentOk: { type: Number, default: 0 },
    sentFailed: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["sending", "completed", "failed"],
      default: "sending",
    },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("PushBroadcast", pushBroadcastSchema);
