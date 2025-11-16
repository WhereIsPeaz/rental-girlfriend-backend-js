const mongoose = require('mongoose');
const {randomUUID} = require('crypto');

const MessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: String,
      ref: 'User',
      required: true,
    },
    senderType: {
      type: String,
      enum: ['customer', 'provider'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {_id: false}
);

const ChatSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: randomUUID,
      required: true,
    },
    bookingId: {
      type: String,
      ref: 'Booking',
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: String,
      ref: 'User',
      required: true,
      index: true,
    },
    providerId: {
      type: String,
      ref: 'User',
      required: true,
      index: true,
    },
    messages: [MessageSchema],
  },
  {
    timestamps: true,
  }
);

ChatSchema.virtual('id').get(function () {
  return this._id;
});

ChatSchema.methods.isParticipant = function (userId) {
  if (!userId) return false;
  const normalized = String(userId);
  return this.customerId === normalized || this.providerId === normalized;
};

ChatSchema.methods.toJSON = function () {
  const obj = this.toObject({virtuals: true});
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Chat', ChatSchema);
