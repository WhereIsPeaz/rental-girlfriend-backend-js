// models/Review.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ReviewSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
      required: true,
    },
    bookingId: {
      type: String,
      ref: 'Booking',
      required: [true, 'bookingId is required'],
      index: true,
    },
    serviceId: {
      type: String,
      ref: 'Service',
      required: [true, 'serviceId is required'],
      index: true,
    },
    customerId: {
      type: String,
      ref: 'User',
      required: [true, 'customerId is required'],
      index: true,
    },
    rating: {
      type: Number,
      min: [0, 'rating must be at least 0'],
      max: [5, 'rating must be at most 5'],
      required: [true, 'rating is required'],
    },
    comment: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'comment must be 2000 characters or less'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ReviewSchema.index({ serviceId: 1, customerId: 1 }, { unique: true });

ReviewSchema.virtual('id').get(function () {
  return this._id;
});

ReviewSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  if (obj.createdAt instanceof Date) {
    obj.createdAt = obj.createdAt.toISOString();
  }
  return obj;
};

module.exports = mongoose.model('Review', ReviewSchema);
