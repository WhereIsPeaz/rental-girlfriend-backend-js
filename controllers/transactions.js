const Transaction = require('../models/Transaction');
const User = require('../models/User');

const ensureAuth = (req, res) => {
  if (!req.user) {
    res.status(401).json({success: false, message: 'Not authenticated'});
    return false;
  }
  return true;
};

const currentUserId = (req) => String(req.user?.id || req.user?._id || '');

const buildTransactionController = ({TransactionModel = Transaction, UserModel = User} = {}) => {
  const resolveUserBalance = async (userId, fallback) => {
    if (!userId) return null;
    if (fallback && typeof fallback === 'number') {
      return fallback;
    }
    const user = await UserModel.findById(userId).select('balance');
    return user ? user.balance ?? 0 : null;
  };

  const findUserById = async (userId) => {
    if (!userId) return null;
    return UserModel.findById(userId);
  };

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
      let balance = null;
      if (req.user.type !== 'admin') {
        balance = await resolveUserBalance(filter.customerId, req.user.balance);
      } else if (req.query.customerId) {
        balance = await resolveUserBalance(req.query.customerId);
      }

      res.json({success: true, data: transactions, balance});
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

      const balance =
        req.user.type !== 'admin'
          ? await resolveUserBalance(tx.customerId, req.user.balance)
          : await resolveUserBalance(tx.customerId);

      res.json({success: true, data: tx, balance});
    } catch (err) {
      console.error('getTransaction error:', err);
      res.status(500).json({success: false, message: 'Unable to fetch transaction'});
    }
  };

  const performTransaction = async (req, res, action) => {
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
        status: req.body.status || 'completed',
        note: req.body.note,
        action,
      };

      if (req.user.type === 'admin' && req.body.customerId) {
        payload.customerId = req.body.customerId;
      } else {
        payload.customerId = currentUserId(req);
      }

      const targetUser = await findUserById(payload.customerId);
      if (!targetUser) {
        return res.status(404).json({success: false, message: 'User not found'});
      }

      const delta = action === 'debit' ? -amount : amount;
      const nextBalance = (targetUser.balance || 0) + delta;

      if (nextBalance < 0) {
        return res
          .status(400)
          .json({success: false, message: 'Insufficient balance to perform this transaction'});
      }

      targetUser.balance = nextBalance;
      await targetUser.save();

      payload.balanceAfter = targetUser.balance;

      const tx = await TransactionModel.create(payload);

      if (currentUserId(req) === payload.customerId) {
        req.user.balance = targetUser.balance;
      }
      res.status(201).json({success: true, data: tx, balance: targetUser.balance});
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

  const createTransaction = (req, res) => performTransaction(req, res, 'credit');

  const paymentTransaction = async (req, res) => {
    try {
      if (!ensureAuth(req, res)) return;

      const amount = Number(req.body?.amount);
      if (!amount || Number.isNaN(amount) || amount <= 0) {
        return res.status(400).json({success: false, message: 'amount must be greater than 0'});
      }

      const providerId = req.body?.providerId;
      if (!providerId) {
        return res.status(400).json({success: false, message: 'providerId is required'});
      }

      const customerId =
        req.user.type === 'admin' && req.body.customerId ? req.body.customerId : currentUserId(req);

      const [customer, provider] = await Promise.all([
        findUserById(customerId),
        findUserById(providerId),
      ]);

      if (!customer) {
        return res.status(404).json({success: false, message: 'Customer not found'});
      }

      if (!provider) {
        return res.status(404).json({success: false, message: 'Provider not found'});
      }

      const nextCustomerBalance = (customer.balance || 0) - amount;
      if (nextCustomerBalance < 0) {
        return res.status(400).json({success: false, message: 'Insufficient balance'});
      }

      customer.balance = nextCustomerBalance;
      provider.balance = (provider.balance || 0) + amount;

      await Promise.all([customer.save(), provider.save()]);

      const payload = {
        amount,
        currency: (req.body.currency || 'THB').toUpperCase(),
        method: req.body.method || 'payment',
        status: req.body.status || 'completed',
        note: req.body.note,
        action: 'debit',
        customerId,
        providerId,
        balanceAfter: customer.balance,
      };

      const tx = await TransactionModel.create(payload);

      if (currentUserId(req) === customerId) {
        req.user.balance = customer.balance;
      }

      res.status(201).json({
        success: true,
        data: tx,
        customerBalance: customer.balance,
        providerBalance: provider.balance,
      });
    } catch (err) {
      console.error('paymentTransaction error:', err);
      if (err && err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        return res
          .status(400)
          .json({success: false, message: 'Validation failed', errors: messages});
      }
      res.status(500).json({success: false, message: 'Unable to process payment'});
    }
  };

  return {
    listTransactions,
    getTransaction,
    createTransaction,
    paymentTransaction,
  };
};

const controller = buildTransactionController();

module.exports = {
  ...controller,
  buildTransactionController,
};
