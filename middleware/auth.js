// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SECRET = process.env.JWT_SECRET || 'change_this_secret';

// Protect routes
exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    let token;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1].trim();
    }

    if (!token || token === 'null') {
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }

    const decoded = jwt.verify(token, SECRET);

    // findById works because your _id is a string (UUID)
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error(err.stack);
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

// Grant access to specific roles (uses `type` field from your schema)
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  if (!roles.includes(req.user.type)) {
    return res.status(403).json({
      success: false,
      message: `User type ${req.user.type} is not authorized to access this route`
    });
  }
  next();
};
