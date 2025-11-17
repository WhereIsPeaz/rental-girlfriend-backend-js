const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');

// @desc    List withdrawals
// @route   GET /api/v1/withdrawals
// @access  Private
exports.listWithdrawals = async (req, res, next) => {
  try {
    const {
      userId,
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // Build filter
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    // Non-admin users can only see their own withdrawals
    if (req.user.type !== 'admin') {
      filter.userId = req.user.id;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const withdrawals = await Withdrawal.find(filter)
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Withdrawal.countDocuments(filter);

    res.status(200).json({
      success: true,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
      },
      data: withdrawals,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get withdrawal by id
// @route   GET /api/v1/withdrawals/:id
// @access  Private
exports.getWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    // Check authorization
    if (req.user.type !== 'admin' && withdrawal.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this withdrawal',
      });
    }

    res.status(200).json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create withdrawal request
// @route   POST /api/v1/withdrawals
// @access  Private
exports.createWithdrawal = async (req, res, next) => {
  try {
    const {
      userId,
      amount,
      bankName,
      accountNumber,
      accountName,
    } = req.body;

    // User can only create withdrawal for themselves unless admin
    const targetUserId = (req.user.type === 'admin' && userId) ? userId : req.user.id;

    // Check if amount is valid
    if (!amount || amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is 100',
      });
    }

    // Calculate user balance from transactions based on transaction type
    const transactions = await Transaction.find({ customerId: targetUserId });
    const balance = transactions.reduce((sum, t) => {
      // Add for topup and refund, subtract for payment and withdrawal
      if (t.type === 'topup' || t.type === 'refund') {
        return sum + (t.amount || 0);
      } else if (t.type === 'payment' || t.type === 'withdrawal') {
        return sum - (t.amount || 0);
      }
      return sum;
    }, 0);

    if (balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance for withdrawal',
      });
    }

    const withdrawalData = {
      userId: targetUserId,
      amount,
      bankName,
      accountNumber,
      accountName,
      status: 'completed', // Auto-approve withdrawal
      requestedAt: new Date(),
      completedAt: new Date(),
    };

    const withdrawal = await Withdrawal.create(withdrawalData);

    // Create withdrawal transaction immediately
    await Transaction.create({
      customerId: targetUserId,
      amount: amount,
      currency: 'THB',
      method: 'bank_transfer',
      type: 'withdrawal',
      status: 'completed',
      note: `ถอนเงินไปบัญชี ${bankName} (${accountNumber})`,
    });

    res.status(201).json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update withdrawal
// @route   PUT /api/v1/withdrawals/:id
// @access  Private
exports.updateWithdrawal = async (req, res, next) => {
  try {
    let withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    // Check authorization
    if (req.user.type !== 'admin' && withdrawal.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this withdrawal',
      });
    }

    const {
      status,
      failureReason,
    } = req.body;

    const updateData = {};

    // Only admin can change status
    if (status !== undefined && req.user.type === 'admin') {
      updateData.status = status;
      
      if (status === 'completed') {
        updateData.completedAt = new Date();
        
        // Create a transaction record for the withdrawal
        await Transaction.create({
          customerId: withdrawal.userId,
          amount: withdrawal.amount,
          currency: 'THB',
          method: 'bank_transfer',
          type: 'withdrawal',
          status: 'completed',
          note: `Withdrawal to ${withdrawal.bankName} (${withdrawal.accountNumber})`,
        });
      } else if (status === 'failed' && failureReason) {
        updateData.failureReason = failureReason;
      }
    }

    withdrawal = await Withdrawal.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete withdrawal (admin only)
// @route   DELETE /api/v1/withdrawals/:id
// @access  Private/Admin
exports.deleteWithdrawal = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found',
      });
    }

    // Only admin can delete
    if (req.user.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete withdrawals',
      });
    }

    await withdrawal.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Withdrawal deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

