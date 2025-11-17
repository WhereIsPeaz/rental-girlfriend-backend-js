// controllers/reviews.js
const Review = require('../models/Review');
const Service = require('../models/Service');
const Booking = require('../models/Booking');

const sanitizeReview = (doc) => {
  if (!doc) return null;
  if (typeof doc.toJSON === 'function') {
    return doc.toJSON();
  }
  const copy = { ...doc };
  delete copy.__v;
  return copy;
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

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

const updateServiceReviewStats = async (serviceId) => {
  if (!serviceId) return;
  try {
    const stats = await Review.aggregate([
      { $match: { serviceId } },
      {
        $group: {
          _id: '$serviceId',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    const avg = stats.length > 0 ? Number(stats[0].avgRating.toFixed(2)) : 0;
    const count = stats.length > 0 ? stats[0].count : 0;

    await Service.findByIdAndUpdate(serviceId, {
      rating: avg,
      reviewCount: count,
    });
  } catch (err) {
    console.error('updateServiceReviewStats error:', err);
  }
};

exports.listReviews = async (req, res) => {
  try {
    const filter = {};
    if (req.query.serviceId) {
      filter.serviceId = req.query.serviceId;
    }
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }
    if (req.query.bookingId) {
      filter.bookingId = req.query.bookingId;
    }

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit || '20', 10));

    const [total, reviews] = await Promise.all([
      Review.countDocuments(filter),
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return res.json({
      success: true,
      meta: { page, limit, total },
      data: reviews.map((review) => sanitizeReview(review)),
    });
  } catch (err) {
    console.error('listReviews error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: 'Review not found' });
    }
    return res.json({ success: true, data: sanitizeReview(review) });
  } catch (err) {
    console.error('getReview error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createReview = async (req, res) => {
  try {
    if (!ensureAuth(req, res)) return;

    const userType = req.user.type;
    if (userType !== 'customer' && userType !== 'admin') {
      return res
        .status(403)
        .json({ success: false, message: 'Only customers or admins can create reviews' });
    }

    if (!req.body.bookingId) {
      return res
        .status(400)
        .json({ success: false, message: 'bookingId is required' });
    }

    const service = await Service.findById(req.body.serviceId);
    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: 'Service not found' });
    }

    const booking = await Booking.findById(req.body.bookingId);
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: 'Booking not found' });
    }

    const serviceIdString = service.id || service._id;
    if (String(booking.serviceId) !== String(serviceIdString)) {
      return res
        .status(400)
        .json({ success: false, message: 'bookingId does not belong to the provided serviceId' });
    }

    const authenticatedUserId = currentUserId(req);
    if (!authenticatedUserId) {
      return res
        .status(400)
        .json({ success: false, message: 'customerId is required' });
    }

    if (userType !== 'admin' && booking.customerId !== authenticatedUserId) {
      return res
        .status(403)
        .json({ success: false, message: 'You can only review your own bookings' });
    }

    if (userType === 'admin' && req.body.customerId && req.body.customerId !== booking.customerId) {
      return res
        .status(400)
        .json({ success: false, message: 'customerId does not match booking' });
    }

    const customerId = booking.customerId;

    if (!customerId) {
      return res
        .status(400)
        .json({ success: false, message: 'Booking is missing customer information' });
    }

    const rating = toNumber(req.body.rating);
    if (rating === undefined) {
      return res
        .status(400)
        .json({ success: false, message: 'rating is required and must be numeric' });
    }

    const reviewPayload = {
      serviceId: booking.serviceId,
      bookingId: booking.id || booking._id,
      customerId,
      rating,
      comment: req.body.comment,
    };

    const review = await Review.create(reviewPayload);
    await updateServiceReviewStats(review.serviceId);

    return res
      .status(201)
      .json({ success: true, data: sanitizeReview(review) });
  } catch (err) {
    console.error('createReview error:', err);
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({
          success: false,
          message: 'You have already reviewed this service',
        });
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

exports.updateReview = async (req, res) => {
  try {
    if (!ensureAuth(req, res)) return;

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: 'Review not found' });
    }

    const userId = currentUserId(req);
    if (req.user.type !== 'admin' && review.customerId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    let shouldUpdateStats = false;

    if (req.body.rating !== undefined) {
      const rating = toNumber(req.body.rating);
      if (rating === undefined) {
        return res
          .status(400)
          .json({ success: false, message: 'rating must be numeric' });
      }
      review.rating = rating;
      shouldUpdateStats = true;
    }

    if (req.body.comment !== undefined) {
      review.comment = req.body.comment;
    }

    await review.save();

    if (shouldUpdateStats) {
      await updateServiceReviewStats(review.serviceId);
    }

    return res.json({ success: true, data: sanitizeReview(review) });
  } catch (err) {
    console.error('updateReview error:', err);
    if (err && err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: 'Validation failed', errors: messages });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    if (!ensureAuth(req, res)) return;

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: 'Review not found' });
    }

    const userId = currentUserId(req);
    if (req.user.type !== 'admin' && review.customerId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await review.deleteOne();
    await updateServiceReviewStats(review.serviceId);

    return res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    console.error('deleteReview error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
