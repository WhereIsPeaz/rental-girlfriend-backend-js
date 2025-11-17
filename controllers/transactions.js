const Transaction = require('../models/Transaction');

const ensureAuth = (req, res) => {
  if (!req.user) {
    res.status(401).json({success: false, message: 'Not authenticated'});
    return false;
  }
  return true;
};

const currentUserId = (req) => String(req.user?.id || req.user?._id || '');

const buildTransactionController = (TransactionModel = Transaction) => {
  const listTransactions = async (req, res) => {
    try {
      if (!ensureAuth(req, res)) return;

      const filter = {};
      if (req.user.type !== 'admin') {
        filter.customerId = currentUserId(req);
      } else if (req.query.customerId) {
        filter.customerId = req.query.customerId;
      }

      const transactions = await TransactionModel.find(filter).sort({createdAt: -1});
      res.json({success: true, data: transactions});
    } catch (err) {
      console.error('listTransactions error:', err);
      res.status(500).json({success: false, message: 'Unable to fetch transactions'});
    }
  };

  const getTransaction = async (req, res) => {
    try {
      if (!ensureAuth(req, res)) return;

      const tx = await TransactionModel.findById(req.params.id);
      if (!tx) {
        return res.status(404).json({success: false, message: 'Transaction not found'});
      }

      if (req.user.type !== 'admin' && tx.customerId !== currentUserId(req)) {
        return res.status(403).json({success: false, message: 'Forbidden'});
      }

      res.json({success: true, data: tx});
    } catch (err) {
      console.error('getTransaction error:', err);
      res.status(500).json({success: false, message: 'Unable to fetch transaction'});
    }
  };

  const createTransaction = async (req, res) => {
    try {
      if (!ensureAuth(req, res)) return;

      const amount = Number(req.body?.amount);
      if (!amount || Number.isNaN(amount) || amount <= 0) {
        return res.status(400).json({success: false, message: 'amount must be greater than 0'});
      }

      const payload = {
        amount,
        currency: (req.body.currency || 'THB').toUpperCase(),
        method: req.body.method || 'topup',
        type: req.body.type || 'topup', // Add type field from request
        status: req.body.status || 'completed',
        note: req.body.note,
      };

      if (req.user.type === 'admin' && req.body.customerId) {
        payload.customerId = req.body.customerId;
      } else {
        payload.customerId = currentUserId(req);
      }

      const tx = await TransactionModel.create(payload);
      res.status(201).json({success: true, data: tx});
    } catch (err) {
      console.error('createTransaction error:', err);
      if (err && err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res
          .status(400)
          .json({success: false, message: 'Validation failed', errors: messages});
      }
      res.status(500).json({success: false, message: 'Unable to create transaction'});
    }
  };

  return {
    listTransactions,
    getTransaction,
    createTransaction,
  };
};

const controller = buildTransactionController();

module.exports = {
  ...controller,
  buildTransactionController,
};
