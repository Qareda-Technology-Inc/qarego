import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * A 4-digit sign-in code QareGO made itself (older app versions, review logins, or when
 * Arkesel's OTP service can't be used). Kept in the database so a server restart doesn't lose it;
 * MongoDB deletes it once it expires. Arkesel OTP codes aren't stored here (Arkesel checks them).
 */
const otpCodeSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    /** Wrong guesses since the code was sent; too many and the code is dropped. */
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("OtpCode", otpCodeSchema);
