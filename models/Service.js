// models/Service.js
const mongoose = require('mongoose');
const {randomUUID} = require('crypto');

const ServiceSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: randomUUID,
      required: true,
    },
    providerId: {
      type: String,
      ref: 'User',
      required: [true, 'providerId is required'],
      index: true,
    },
    name: {
      type: String,
      trim: true,
      required: [true, 'name is required'],
      maxlength: [120, 'name must be 120 characters or less'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [2000, 'description must be 2000 characters or less'],
    },
    categories: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) =>
          Array.isArray(arr) &&
          arr.every((val) => typeof val === 'string' && val.trim().length > 0),
        message: 'categories must be an array of non-empty strings',
      },
    },
    priceHour: {
      type: Number,
      required: [true, 'priceHour is required'],
      min: [0, 'priceHour must be equal or above 0'],
    },
    priceDay: {
      type: Number,
      required: [true, 'priceDay is required'],
      min: [0, 'priceDay must be equal or above 0'],
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) =>
          Array.isArray(arr) && arr.every((val) => typeof val === 'string'),
        message: 'images must be an array of strings',
      },
    },
    rating: {
      type: Number,
      min: [0, 'rating cannot be negative'],
      max: [5, 'rating cannot be higher than 5'],
      default: 0,
    },
    reviewCount: {
      type: Number,
      min: [0, 'reviewCount cannot be negative'],
      default: 0,
    },
    bookingCount: {
      type: Number,
      min: [0, 'bookingCount cannot be negative'],
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

ServiceSchema.virtual('id').get(function () {
  return this._id;
});

ServiceSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  obj.createdAt = obj.createdAt
    ? new Date(obj.createdAt).toISOString()
    : obj.createdAt;
  if (obj.updatedAt) {
    obj.updatedAt = new Date(obj.updatedAt).toISOString();
  }
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Service', ServiceSchema);
