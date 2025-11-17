// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

const GENDER_ENUM = ["ชาย", "หญิง"];
const ROLE_ENUM = ["customer", "provider", "admin"];
const AUTO_VERIFY_USER = true;
const SALT_ROUNDS = 10;
const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;

const UserSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: randomUUID,
      required: true,
    },
    email: {
      type: String,
      required: [true, "Required Email"],
      unique: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: [true, "Required Username"],
      unique: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, "Required Password"],
    },
    firstName: {
      type: String,
      required: [true, "Required firstName"],
    },
    lastName: {
      type: String,
      required: [true, "Required lastName"],
    },
    birthdate: {
      type: Date,
      required: [true, "Required Birthdate"],
      set: (val) => {
        // Accept ISO or any Date-like input and convert to YYYY-MM-DD string
        const d = new Date(val);
        if (isNaN(d)) return val; // if invalid, let validation handle it

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");

        return `${yyyy}-${mm}-${dd}`;
      },
    },
    idCard: { type: String, default: "" },
    phone: {
      type: String,
      default: "",
      set: (val) => (typeof val === "string" ? val.trim() : val),
      validate: {
        validator: (value) => !value || PHONE_REGEX.test(value),
        message: "phone must be a valid international number (e.g. +123456789)",
      },
    },
    gender: {
      type: String,
      enum: GENDER_ENUM,
      required: [true, "Required Gender"],
    },
    interestedGender: {
      type: String,
      enum: GENDER_ENUM,
      required: [true, "Required Interested Gender"],
    },
    type: {
      type: String,
      enum: ROLE_ENUM,
      default: "customer",
    },
    img: {
      type: String,
      default: "",
    },
    generalTimeSetting: {
      type: Object,
      default: {}, // shape is flexible; you can tighten later
    },
    joined: {
      type: String,
      default: () => String(new Date().getFullYear()),
    },
    otp: {
      type: String, // store hashed OTP
      default: null,
      select: false, // don't return by default
    },
    otpExpires: {
      type: Date,
      default: null,
      select: false,
    },
    verified: {
      type: Boolean,
      default: AUTO_VERIFY_USER,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// virtual id -> maps to _id
UserSchema.virtual("id").get(function () {
  return this._id;
});

// Hash only when password changed
UserSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

// sign JWT (payload contains your id string)
UserSchema.methods.getSignedJwtToken = function () {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRE || "7d";
  return jwt.sign({ id: this._id }, secret, { expiresIn });
};

UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// tidy JSON: remove __v and keep id virtual
UserSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", UserSchema);
