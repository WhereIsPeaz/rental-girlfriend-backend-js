const mongoose = require('mongoose');
const {randomUUID} = require('crypto');

const PAYMENT_METHOD_ENUM = ['credit_card', 'promptpay', 'bank_transfer'];
const PAYMENT_STATUS_ENUM = ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'];

const PaymentSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: randomUUID,
      required: true,
    },
    bookingId: {
      type: String,
      ref: 'Booking',
      required: [true, 'bookingId is required'],
      index: true,
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
    amount: {
      type: Number,
      required: [true, 'amount is required'],
      min: [0, 'amount must be non-negative'],
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHOD_ENUM,
      required: [true, 'paymentMethod is required'],
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS_ENUM,
      default: 'pending',
    },
    transactionId: {
      type: String,
      default: '',
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: [0, 'refundAmount must be non-negative'],
    },
    refundReason: {
      type: String,
      default: '',
      maxlength: 500,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

PaymentSchema.virtual('id').get(function () {
  return this._id;
});

PaymentSchema.methods.toJSON = function () {
  const obj = this.toObject({virtuals: true});
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Payment', PaymentSchema);

