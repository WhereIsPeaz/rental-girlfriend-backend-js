const mongoose = require('mongoose');
const {randomUUID} = require('crypto');

const WITHDRAWAL_STATUS_ENUM = ['pending', 'completed', 'failed'];

const WithdrawalSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: randomUUID,
      required: true,
    },
    userId: {
      type: String,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'amount is required'],
      min: [100, 'minimum withdrawal amount is 100'],
    },
    bankName: {
      type: String,
      required: [true, 'bankName is required'],
      trim: true,
      maxlength: 100,
    },
    accountNumber: {
      type: String,
      required: [true, 'accountNumber is required'],
      trim: true,
      maxlength: 50,
    },
    accountName: {
      type: String,
      required: [true, 'accountName is required'],
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: WITHDRAWAL_STATUS_ENUM,
      default: 'pending',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: '',
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

WithdrawalSchema.virtual('id').get(function () {
  return this._id;
});

WithdrawalSchema.methods.toJSON = function () {
  const obj = this.toObject({virtuals: true});
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);

