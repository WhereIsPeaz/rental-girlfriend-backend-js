// controllers/users.js
const User = require('../models/User');

/**
 * Helper: sanitize user object for responses
 */
function sanitizeUser(userDoc) {
  if (!userDoc) return null;
  const u = (typeof userDoc.toJSON === 'function') ? userDoc.toJSON() : userDoc;
  if (u.password) delete u.password;
  if (u.otp) delete u.otp;
  if (u.otpExpires) delete u.otpExpires;
  if (u.__v) delete u.__v;
  return u;
}

/**
 * GET /users
 * PUBLIC
 */
exports.listUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
    const q = (req.query.q || '').trim();

    const filter = {};
    if (q) {
      filter.$or = [
        { email: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } }
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 })
    ]);

    return res.json({
      success: true,
      meta: { page, limit, total },
      data: users.map(u => {
        const clean = u.toJSON();
        delete clean.password;
        delete clean.otp;
        delete clean.otpExpires;
        delete clean.__v;
        return clean;
      })
    });
  } catch (err) {
    console.error('listUsers', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


/**
 * GET /users/:id
 * PUBLIC
 */
exports.getUser = async (req, res) => {
  try {
    const id = req.params.id;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const clean = user.toJSON();
    delete clean.password;
    delete clean.otp;
    delete clean.otpExpires;
    delete clean.__v;

    return res.json({ success: true, data: clean });
  } catch (err) {
    console.error('getUser', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


/**
 * POST /users
 * Create new user (admin only)
 */
exports.createUser = async (req, res) => {
  try {
    if (!req.user || req.user.type !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const {
      email, username, password, firstName, lastName,
      birthdate, idCard, phone, gender, interestedGender, type, img
    } = req.body;

    if (!email || !username || !password || !firstName || !lastName || !birthdate || !idCard || !phone || !gender || !interestedGender || !type || !img) {
      return res.status(400).json({ success: false, message: 'missing field' });
    }

    const user = await User.create({
      email, username, password, firstName, lastName,
      birthdate, idCard, phone, gender, interestedGender, type, img
    });

    return res.status(201).json({ success: true, data: sanitizeUser(user) });
  } catch (err) {
    console.error('createUser', err);
    if (err && err.code === 11000) {
      const key = Object.keys(err.keyValue || {})[0] || 'field';
      return res.status(400).json({ success: false, message: `${key} already exists` });
    }
    if (err && err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: 'Validation failed', errors: messages });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /users/:id
 * Update user (self or admin)
 */
exports.updateUser = async (req, res) => {
  try {
    const id = req.params.id;

    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (req.user.type !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const allowed = ['email','username','firstName','lastName','birthdate','idCard','phone','gender','interestedGender','type','img','joined','verified','generalTimeSetting'];
    const updates = {};
    for (const k of allowed) {
      if (k in req.body) updates[k] = req.body[k];
    }
    if ('password' in req.body) updates.password = req.body.password;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    Object.assign(user, updates);
    await user.save();

    return res.json({ success: true, data: sanitizeUser(user) });
  } catch (err) {
    console.error('updateUser', err);
    if (err && err.code === 11000) {
      const key = Object.keys(err.keyValue || {})[0] || 'field';
      return res.status(400).json({ success: false, message: `${key} already exists` });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * DELETE /users/:id
 * Delete a user (self or admin)
 */
exports.deleteUser = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const id = req.params.id;

    // Allow admin or the user themself
    if (req.user.type !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error('deleteUser', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /users/:id/profile-image
 * Save just the image path of S3 URL sent by frontend in body { img: <url> }
 * (self or admin)
 */
// POST /users/:id/profile-image  — self or admin
exports.uploadProfileImage = async (req, res) => {
  try {
    const id = req.params.id;

    // Must be logged in AND self/admin
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (req.user.type !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Expecting: { "path": "profiles/12345.png" }
    const { path } = req.body;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'path (string) is required'
      });
    }

    // Optional safety: prevent full URLs
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return res.status(400).json({
        success: false,
        message: 'Provide only the S3 object path, not the full URL'
      });
    }

    // Optional safety: ensure no absolute Unix/Windows paths
    if (path.startsWith('/') || /^[A-Za-z]:\\/.test(path)) {
      return res.status(400).json({
        success: false,
        message: 'Provide a relative S3 object path only'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Save only the path into database
    user.img = path;
    await user.save();

    return res.json({
      success: true,
      data: user.toJSON()
    });
  } catch (err) {
    console.error('uploadProfileImage error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


/**
 * PUT /users/:id/general-time-setting
 * Update generalTimeSetting object in user doc
 * (self or admin)
 */
exports.updateGeneralTimeSetting = async (req, res) => {
  try {
    const id = req.params.id;
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (req.user.type !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const setting = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.generalTimeSetting = setting;
    await user.save();

    return res.json({ success: true, data: sanitizeUser(user) });
  } catch (err) {
    console.error('updateGeneralTimeSetting', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
