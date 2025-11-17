// controllers/bookings.js
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const Chat = require('../models/Chat');
const {ensureChatForBooking} = require('./chat');

const STATUS_ENUM = Booking.schema.path('status').enumValues;
const PAYMENT_STATUS_ENUM = Booking.schema.path('paymentStatus').enumValues;
const CANCELLED_BY_ENUM =
  Booking.schema.path('cancelledBy').enumValues || ['customer', 'provider'];

const sanitizeBooking = (doc) => {
  if (!doc) return null;
  if (typeof doc.toJSON === 'function') {
    const data = doc.toJSON();
    return data;
  }
  const copy = { ...doc };
  delete copy.__v;
  return copy;
};

const formatBookingResponse = (booking, chatId) => {
  const data = sanitizeBooking(booking);
  if (!data) return data;
  data.chatId = chatId || null;
  return data;
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

const ensureAuth = (req, res) => {
  if (!req.user) {
    res
      .status(401)
      .json({ success: false, message: 'Not authenticated' });
    return false;
  }
  return true;
};

const currentUserId = (req) =>
  String(req.user?.id || req.user?._id || '');

const canAccessBooking = (booking, req) => {
  if (!req.user) return false;
  if (req.user.type === 'admin') return true;
  const id = currentUserId(req);
  return booking.customerId === id || booking.providerId === id;
};

exports.listBookings = async (req, res) => {
  try {
    if (!ensureAuth(req, res)) return;

    const userId = currentUserId(req);
    const filter = {};

    if (req.query.customerId) {
      if (req.user.type !== 'admin' && req.query.customerId !== userId) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden for requested customerId' });
      }
      filter.customerId = req.query.customerId;
    }
    if (req.query.providerId) {
      if (req.user.type !== 'admin' && req.query.providerId !== userId) {
        return res
          .status(403)
          .json({ success: false, message: 'Forbidden for requested providerId' });
      }
      filter.providerId = req.query.providerId;
    }

    if (!filter.customerId && !filter.providerId && req.user.type !== 'admin') {
      if (req.user.type === 'provider') {
        filter.providerId = userId;
      } else {
        filter.customerId = userId;
      }
    }

    if (req.query.serviceId) {
      filter.serviceId = req.query.serviceId;
    }
    if (req.query.status) {
      if (!STATUS_ENUM.includes(req.query.status)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid status filter' });
      }
      filter.status = req.query.status;
    }
    if (req.query.paymentStatus) {
      if (!PAYMENT_STATUS_ENUM.includes(req.query.paymentStatus)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid paymentStatus filter' });
      }
      filter.paymentStatus = req.query.paymentStatus;
    }
    if (req.query.dateFrom || req.query.dateTo) {
      filter.date = {};
      if (req.query.dateFrom) {
        filter.date.$gte = req.query.dateFrom;
      }
      if (req.query.dateTo) {
        filter.date.$lte = req.query.dateTo;
      }
    }

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit || '20', 10));

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    let chatMap = new Map();
    const bookingIds = bookings.map((booking) => booking._id);
    if (bookingIds.length) {
      const chats = await Chat.find({bookingId: {$in: bookingIds}}).select('_id bookingId');
      chatMap = new Map(chats.map((chat) => [chat.bookingId, chat._id]));
    }

    return res.json({
      success: true,
      meta: { page, limit, total },
      data: bookings.map((booking) =>
        formatBookingResponse(booking, chatMap.get(String(booking._id)))
      ),
    });
  } catch (err) {
    console.error('listBookings error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getBooking = async (req, res) => {
  try {
    if (!ensureAuth(req, res)) return;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    }
    if (!canAccessBooking(booking, req)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const chat = await Chat.findOne({bookingId: booking._id}).select('_id');
    return res.json({ success: true, data: formatBookingResponse(booking, chat?._id) });
  } catch (err) {
    console.error('getBooking error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createBooking = async (req, res) => {
  try {
    if (!ensureAuth(req, res)) return;

    const userId = currentUserId(req);
    const isAdmin = req.user.type === 'admin';
    const isCustomer = req.user.type === 'customer';

    if (!isAdmin && !isCustomer) {
      return res
        .status(403)
        .json({ success: false, message: 'Only customers or admins can create bookings' });
    }

    const service = await Service.findById(req.body.serviceId);
    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: 'Service not found' });
    }

    const customerId =
      isAdmin && req.body.customerId ? req.body.customerId : userId;
    if (service.providerId === customerId) {
      return res
        .status(400)
        .json({ success: false, message: 'Providers cannot book their own services' });
    }

    const totalHours = toNumber(req.body.totalHours);
    const totalAmount = toNumber(req.body.totalAmount);
    const depositAmount = toNumber(req.body.depositAmount);

    if (totalHours === undefined) {
      return res
        .status(400)
        .json({ success: false, message: 'totalHours is required and must be numeric' });
    }
    if (totalAmount === undefined) {
      return res
        .status(400)
        .json({ success: false, message: 'totalAmount is required and must be numeric' });
    }
    if (depositAmount === undefined) {
      return res
        .status(400)
        .json({ success: false, message: 'depositAmount is required and must be numeric' });
    }

    const bookingPayload = {
      customerId,
      providerId: service.providerId,
      serviceId: service.id || service._id,
      serviceName: service.name,
      date: req.body.date,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      totalHours,
      totalAmount,
      depositAmount,
      specialRequests: req.body.specialRequests,
      status: req.body.status && STATUS_ENUM.includes(req.body.status)
        ? req.body.status
        : undefined,
      paymentStatus:
        req.body.paymentStatus &&
        PAYMENT_STATUS_ENUM.includes(req.body.paymentStatus)
          ? req.body.paymentStatus
          : undefined,
    };

    const booking = await Booking.create(bookingPayload);
    let chat = null;
    try {
      chat = await ensureChatForBooking(booking);
    } catch (chatError) {
      console.error('Failed to auto-create chat for booking:', chatError);
    }
    return res
      .status(201)
      .json({ success: true, data: formatBookingResponse(booking, chat?._id) });
  } catch (err) {
    console.error('createBooking error:', err);
    if (err && err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: 'Validation failed', errors: messages });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    if (!ensureAuth(req, res)) return;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    }
    if (!canAccessBooking(booking, req)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const numericFields = ['totalHours', 'totalAmount', 'depositAmount', 'refundAmount'];
    numericFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        const num = toNumber(req.body[field]);
        if (num === undefined) {
          throw new Error(`${field} must be a valid number`);
        }
        booking[field] = num;
      }
    });

    const stringFields = ['date', 'startTime', 'endTime', 'specialRequests'];
    stringFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        booking[field] = req.body[field];
      }
    });

    if (req.body.status !== undefined) {
      if (!STATUS_ENUM.includes(req.body.status)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid status value' });
      }
      booking.status = req.body.status;
      if (booking.status === 'cancelled') {
        const inferred =
          req.body.cancelledBy && CANCELLED_BY_ENUM.includes(req.body.cancelledBy)
            ? req.body.cancelledBy
            : req.user.type === 'provider'
              ? 'provider'
              : 'customer';
        booking.cancelledBy = inferred;
      } else {
        booking.cancelledBy = undefined;
      }
    }

    if (req.body.paymentStatus !== undefined) {
      if (!PAYMENT_STATUS_ENUM.includes(req.body.paymentStatus)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid paymentStatus value' });
      }
      booking.paymentStatus = req.body.paymentStatus;
    }

    await booking.save();
    const chat = await Chat.findOne({bookingId: booking._id}).select('_id');

    return res.json({ success: true, data: formatBookingResponse(booking, chat?._id) });
  } catch (err) {
    console.error('updateBooking error:', err);
    if (err && err.message && err.message.includes('must be a valid number')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err && err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: 'Validation failed', errors: messages });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    if (!ensureAuth(req, res)) return;

    if (req.user.type !== 'admin') {
      return res
        .status(403)
        .json({ success: false, message: 'Only admins can delete bookings' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    }

    await booking.deleteOne();
    return res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    console.error('deleteBooking error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
