const Payment = require('../models/Payment');
const Booking = require('../models/Booking');

// @desc    List payments
// @route   GET /api/v1/payments
// @access  Private
exports.listPayments = async (req, res, next) => {
  try {
    const {
      bookingId,
      customerId,
      providerId,
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // Build filter
    if (bookingId) filter.bookingId = bookingId;
    if (customerId) filter.customerId = customerId;
    if (providerId) filter.providerId = providerId;
    if (status) filter.status = status;

    // Non-admin users can only see their own payments
    if (req.user.type !== 'admin') {
      filter.$or = [
        { customerId: req.user.id },
        { providerId: req.user.id }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Payment.countDocuments(filter);

    res.status(200).json({
      success: true,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
      },
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get payment by id
// @route   GET /api/v1/payments/:id
// @access  Private
exports.getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    // Check authorization
    if (
      req.user.type !== 'admin' &&
      payment.customerId !== req.user.id &&
      payment.providerId !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this payment',
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create payment
// @route   POST /api/v1/payments
// @access  Private
exports.createPayment = async (req, res, next) => {
  try {
    const {
      bookingId,
      customerId,
      providerId,
      amount,
      paymentMethod,
      status,
      transactionId,
    } = req.body;

    // Verify booking exists
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Only customer can create payment for their booking
    if (req.user.type !== 'admin' && booking.customerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create payment for this booking',
      });
    }

    const paymentData = {
      bookingId,
      customerId: customerId || booking.customerId,
      providerId: providerId || booking.providerId,
      amount,
      paymentMethod,
      status: status || 'pending',
      transactionId: transactionId || '',
    };

    // Set completedAt if status is completed
    if (paymentData.status === 'completed') {
      paymentData.completedAt = new Date();
    }

    const payment = await Payment.create(paymentData);

    res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update payment
// @route   PUT /api/v1/payments/:id
// @access  Private
exports.updatePayment = async (req, res, next) => {
  try {
    let payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    // Check authorization
    if (
      req.user.type !== 'admin' &&
      payment.customerId !== req.user.id &&
      payment.providerId !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this payment',
      });
    }

    const {
      status,
      transactionId,
      refundAmount,
      refundReason,
    } = req.body;

    const updateData = {};

    if (status !== undefined) updateData.status = status;
    if (transactionId !== undefined) updateData.transactionId = transactionId;
    if (refundAmount !== undefined) updateData.refundAmount = refundAmount;
    if (refundReason !== undefined) updateData.refundReason = refundReason;

    // Set timestamps based on status
    if (status === 'completed' && !payment.completedAt) {
      updateData.completedAt = new Date();
    }
    if ((status === 'refunded' || status === 'partially_refunded') && !payment.refundedAt) {
      updateData.refundedAt = new Date();
    }

    payment = await Payment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete payment (admin only)
// @route   DELETE /api/v1/payments/:id
// @access  Private/Admin
exports.deletePayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
    }

    // Only admin can delete
    if (req.user.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete payments',
      });
    }

    await payment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Payment deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

