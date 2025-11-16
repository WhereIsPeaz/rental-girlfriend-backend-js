const mongoose = require('mongoose');
const {randomUUID} = require('crypto');

const STATUS_ENUM = ['pending', 'completed', 'failed'];

const TransactionSchema = new mongoose.Schema(
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
    amount: {
      type: Number,
      required: [true, 'amount is required'],
      min: [0.01, 'amount must be greater than zero'],
    },
    currency: {
      type: String,
      default: 'THB',
      uppercase: true,
      trim: true,
    },
    method: {
      type: String,
      default: 'topup',
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: STATUS_ENUM,
      default: 'completed',
    },
    note: {
      type: String,
      maxlength: 500,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

TransactionSchema.virtual('id').get(function () {
  return this._id;
});

TransactionSchema.methods.toJSON = function () {
  const obj = this.toObject({virtuals: true});
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Transaction', TransactionSchema);
