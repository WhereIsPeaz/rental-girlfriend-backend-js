// models/Booking.js
const mongoose = require('mongoose');
const {randomUUID} = require('crypto');

const STATUS_ENUM = ['pending', 'confirmed', 'completed', 'cancelled'];
const PAYMENT_STATUS_ENUM = [
  'pending',
  'paid',
  'refunded',
  'partially_refunded',
];
const CANCELLED_BY_ENUM = ['customer', 'provider'];

const isoDateRegex =
  /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD to align with frontend interface

const BookingSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: randomUUID,
      required: true,
    },
    customerId: {
      type: String,
      ref: 'User',
      required: [true, 'customerId is required'],
      index: true,
    },
    providerId: {
      type: String,
      ref: 'User',
      required: [true, 'providerId is required'],
      index: true,
    },
    serviceId: {
      type: String,
      ref: 'Service',
      required: [true, 'serviceId is required'],
      index: true,
    },
    serviceName: {
      type: String,
      required: [true, 'serviceName is required'],
      trim: true,
      maxlength: [160, 'serviceName must be 160 characters or less'],
    },
    date: {
      type: String,
      required: [true, 'date is required'],
      validate: {
        validator: (value) => isoDateRegex.test(value),
        message: 'date must be in YYYY-MM-DD format',
      },
    },
    startTime: {
      type: String,
      required: [true, 'startTime is required'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'endTime is required'],
      trim: true,
    },
    totalHours: {
      type: Number,
      required: [true, 'totalHours is required'],
      min: [0.5, 'totalHours must be at least 0.5'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'totalAmount is required'],
      min: [0, 'totalAmount must be equal or above 0'],
    },
    depositAmount: {
      type: Number,
      required: [true, 'depositAmount is required'],
      min: [0, 'depositAmount must be equal or above 0'],
      validate: {
        validator: function (value) {
          return value <= this.totalAmount;
        },
        message: 'depositAmount cannot be greater than totalAmount',
      },
    },
    status: {
      type: String,
      enum: STATUS_ENUM,
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS_ENUM,
      default: 'pending',
    },
    specialRequests: {
      type: String,
      default: '',
      maxlength: [2000, 'specialRequests must be 2000 characters or less'],
    },
    cancelledBy: {
      type: String,
      enum: CANCELLED_BY_ENUM,
    },
    refundAmount: {
      type: Number,
      min: [0, 'refundAmount cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

BookingSchema.index({ customerId: 1, createdAt: -1 });
BookingSchema.index({ providerId: 1, createdAt: -1 });
BookingSchema.index({ serviceId: 1, date: -1 });

BookingSchema.virtual('id').get(function () {
  return this._id;
});

BookingSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.__v;
  if (obj.createdAt instanceof Date) {
    obj.createdAt = obj.createdAt.toISOString();
  }
  if (obj.updatedAt instanceof Date) {
    obj.updatedAt = obj.updatedAt.toISOString();
  }
  return obj;
};

module.exports = mongoose.model('Booking', BookingSchema);
