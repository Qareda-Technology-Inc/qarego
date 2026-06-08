import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["customer", "rider", "admin", "merchant", "cook"],
      required: true,
    },
    /** For merchant/cook accounts: the restaurant they operate (cooks scoped here) */
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      default: null,
    },
    /** Who created this staff account (merchant who added a cook) */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // Allow null/undefined for admins
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // Allow null/undefined for customers/riders
    },
    password: {
      type: String,
      select: false, // Don't return password by default
    },
    name: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: false,
    },
    /** Profile photo (Cloudinary URL or /uploads path) */
    profileImage: {
      type: String,
      default: null,
    },
    averageRating: {
      type: Number,
      default: 5.0,
    },
    /** For customers: when true, cannot request new rides */
    isSuspended: {
      type: Boolean,
      default: false,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    // Driver earnings balance (can be negative = owes commission)
    balance: {
      type: Number,
      default: 0,
    },
    /** FCM or Expo push tokens for mobile notifications */
    pushTokens: [
      {
        token: { type: String, required: true },
        provider: { type: String, enum: ["fcm", "expo"], default: "expo" },
        platform: { type: String, default: "unknown" },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    // Real-time status fields
    isOnline: {
      type: Boolean,
      default: false,
    },
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    // Driver (Rider) specific fields
    driverDetails: {
      dob: String,
      gender: String,
      profileImage: String,
      licenseNumber: String,
      licenseFront: String,
      licenseBack: String,
      nationalId: String,
      policeClearance: String,
      vehicle: {
        make: String,
        model: String,
        year: String,
        plateNumber: String,
        color: String,
        /** Ride type this driver is assigned to: motorcycle, pragya, comfort */
        category: {
          type: String,
          enum: ["motorcycle", "pragya", "comfort"],
        },
        registrationDoc: String,
        insuranceDoc: String,
      },
      status: {
        type: String,
        enum: ["active", "pending", "suspended", "suspended_debt"],
        default: "pending",
      },
      /** Rider toggles: RIDE, DELIVERY (parcel), FOOD — default enabled */
      servicePreferences: {
        type: Schema.Types.Mixed,
        default: () => ({
          RIDE: { enabled: true },
          DELIVERY: { enabled: true },
          FOOD: { enabled: true },
        }),
      },
      /** Last applied quick preset: all | ride_only | delivery_only | parcel_only | food_only | custom */
      servicePreset: {
        type: String,
        default: "all",
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ currentLocation: '2dsphere' });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      phone: this.phone,
      username: this.username,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

userSchema.methods.createRefreshToken = function () {
  return jwt.sign(
    { id: this._id, phone: this.phone, username: this.username },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

const User = mongoose.model("User", userSchema);
export default User;
