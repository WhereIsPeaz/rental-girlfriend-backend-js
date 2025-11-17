// controllers/users.js
const User = require("../models/User");

/**
 * Helper: sanitize user object for responses
 */
function sanitizeUser(userDoc) {
  if (!userDoc) return null;
  const u = typeof userDoc.toJSON === "function" ? userDoc.toJSON() : userDoc;
  if (u.password) delete u.password;
  if (u.otp) delete u.otp;
  if (u.otpExpires) delete u.otpExpires;
  if (u.__v) delete u.__v;
  return u;
}

/**
 * Helper: validate and normalize base64 or data URI image string.
 * Returns { ok: true, dataUri } on success or { ok: false, message } on failure.
 *
 * Accepts:
 *  - full data URI: "data:image/png;base64,AAAA..."
 *  - raw base64 string: "AAAA..." (assumed image/png unless mimeHint provided)
 *
 * Allowed mime types: image/png, image/jpeg, image/jpg, image/gif, image/webp
 * Max size default: 5 MB (configurable).
 */
function validateBase64Image(input, options = {}) {
  const MAX_BYTES = options.maxBytes || 5 * 1024 * 1024; // default 5MB
  const mimeHint = options.mimeHint || null; // optional forced mime if provided

  if (!input || typeof input !== "string") {
    return { ok: false, message: "image must be a string" };
  }

  const trimmed = input.trim();

  // Try data URI match first
  const dataUriMatch = trimmed.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/
  );
  let mimeType = null;
  let b64 = null;

  if (dataUriMatch) {
    mimeType = dataUriMatch[1].toLowerCase();
    b64 = dataUriMatch[2].replace(/\s+/g, "");
  } else {
    // treat as raw base64
    b64 = trimmed.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/=]+$/.test(b64)) {
      return { ok: false, message: "image must be valid base64 or a data URI" };
    }
    mimeType = mimeHint || "image/png";
  }

  // Normalize jpeg mime (some clients use image/jpg)
  if (mimeType === "image/jpg") mimeType = "image/jpeg";

  const allowed = new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
  ]);
  if (!allowed.has(mimeType)) {
    return {
      ok: false,
      message: `unsupported image type: ${mimeType}. allowed: png, jpeg, gif, webp`,
    };
  }

  // Estimate bytes from base64 length: bytes = (len * 3) / 4 - padding
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const approxBytes = Math.floor((b64.length * 3) / 4) - padding;
  if (approxBytes > MAX_BYTES) {
    return {
      ok: false,
      message: `image too large: ${approxBytes} bytes. max ${MAX_BYTES} bytes`,
    };
  }

  // Construct canonical data URI to store
  const dataUri = `data:${mimeType};base64,${b64}`;
  return { ok: true, dataUri, size: approxBytes, mimeType };
}

/**
 * GET /users
 * PUBLIC
 */
exports.listUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, parseInt(req.query.limit || "20", 10));
    const q = (req.query.q || "").trim();

    const filter = {};
    if (q) {
      filter.$or = [
        { email: { $regex: q, $options: "i" } },
        { username: { $regex: q, $options: "i" } },
        { firstName: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
    ]);

    return res.json({
      success: true,
      meta: { page, limit, total },
      data: users.map((u) => {
        const clean = u.toJSON();
        delete clean.password;
        delete clean.otp;
        delete clean.otpExpires;
        delete clean.__v;
        return clean;
      }),
    });
  } catch (err) {
    console.error("listUsers", err);
    return res.status(500).json({ success: false, message: "Server error" });
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
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const clean = user.toJSON();
    delete clean.password;
    delete clean.otp;
    delete clean.otpExpires;
    delete clean.__v;

    return res.json({ success: true, data: clean });
  } catch (err) {
    console.error("getUser", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * POST /users
 * Create new user (admin only)
 *
 * Now accepts optional `img` in req.body (base64 or data URI). If present, it will be validated and stored.
 */
exports.createUser = async (req, res) => {
  try {
    if (!req.user || req.user.type !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const {
      email,
      username,
      password,
      firstName,
      lastName,
      birthdate,
      idCard,
      phone,
      gender,
      interestedGender,
      type,
      img,
    } = req.body;

    // NOTE: img is optional now — do not require it
    if (
      !email ||
      !username ||
      !password ||
      !firstName ||
      !lastName ||
      !birthdate ||
      !idCard ||
      !phone ||
      !gender ||
      !interestedGender ||
      !type
    ) {
      return res.status(400).json({ success: false, message: "missing field" });
    }

    // If img provided, validate it
    let imgToStore = null;
    if (typeof img !== "undefined" && img !== null && img !== "") {
      const v = validateBase64Image(img);
      if (!v.ok) {
        return res
          .status(400)
          .json({ success: false, message: `Invalid image: ${v.message}` });
      }
      imgToStore = v.dataUri;
    }

    const userPayload = {
      email,
      username,
      password,
      firstName,
      lastName,
      birthdate,
      idCard,
      phone,
      gender,
      interestedGender,
      type,
    };
    if (imgToStore) userPayload.img = imgToStore;

    const user = await User.create(userPayload);

    return res.status(201).json({ success: true, data: sanitizeUser(user) });
  } catch (err) {
    console.error("createUser", err);
    if (err && err.code === 11000) {
      const key = Object.keys(err.keyValue || {})[0] || "field";
      return res
        .status(400)
        .json({ success: false, message: `${key} already exists` });
    }
    if (err && err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: messages,
      });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * PUT /users/:id
 * Update user (self or admin)
 *
 * If `img` is present in req.body it will be validated as base64/data URI and saved.
 */
exports.updateUser = async (req, res) => {
  try {
    const id = req.params.id;

    if (!req.user)
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    if (req.user.type !== "admin" && req.user.id !== id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const allowed = [
      "email",
      "username",
      "firstName",
      "lastName",
      "birthdate",
      "idCard",
      "phone",
      "gender",
      "interestedGender",
      "type",
      "img",
      "joined",
      "verified",
      "generalTimeSetting",
    ];
    const updates = {};
    for (const k of allowed) {
      if (k in req.body) updates[k] = req.body[k];
    }
    if ("password" in req.body) updates.password = req.body.password;

    // If img present, validate and normalize to data URI
    if ("img" in updates && updates.img != null && updates.img !== "") {
      const v = validateBase64Image(updates.img);
      if (!v.ok) {
        return res
          .status(400)
          .json({ success: false, message: `Invalid image: ${v.message}` });
      }
      updates.img = v.dataUri;
    }

    const user = await User.findById(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    Object.assign(user, updates);
    await user.save();

    return res.json({ success: true, data: sanitizeUser(user) });
  } catch (err) {
    console.error("updateUser", err);
    if (err && err.code === 11000) {
      const key = Object.keys(err.keyValue || {})[0] || "field";
      return res
        .status(400)
        .json({ success: false, message: `${key} already exists` });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * DELETE /users/:id
 * Delete a user (self or admin)
 */
exports.deleteUser = async (req, res) => {
  try {
    if (!req.user)
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    const id = req.params.id;

    // Allow admin or the user themself
    if (req.user.type !== "admin" && req.user.id !== id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    return res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error("deleteUser", err);
    return res.status(500).json({ success: false, message: "Server error" });
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
    if (!req.user)
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    if (req.user.type !== "admin" && req.user.id !== id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const setting = req.body;
    const user = await User.findById(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    user.generalTimeSetting = setting;
    await user.save();

    return res.json({ success: true, data: sanitizeUser(user) });
  } catch (err) {
    console.error("updateGeneralTimeSetting", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * GET /users/:id/balance
 * Calculate user balance from transactions
 * (self or admin)
 */
exports.getUserBalance = async (req, res) => {
  try {
    const Transaction = require("../models/Transaction");
    const id = req.params.id;

    if (!req.user)
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    if (req.user.type !== "admin" && req.user.id !== id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const user = await User.findById(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Calculate balance from transactions based on transaction type
    const transactions = await Transaction.find({ customerId: id });

    const balance = transactions.reduce((sum, t) => {
      // Add for topup and refund, subtract for payment and withdrawal
      if (t.type === "topup" || t.type === "refund") {
        return sum + (t.amount || 0);
      } else if (t.type === "payment" || t.type === "withdrawal") {
        return sum - (t.amount || 0);
      }
      return sum;
    }, 0);

    // Calculate total earnings (topup and refund transactions)
    const totalEarnings = transactions
      .filter((t) => t.type === "topup" || t.type === "refund")
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate total spent (payment and withdrawal transactions)
    const totalSpent = transactions
      .filter((t) => t.type === "payment" || t.type === "withdrawal")
      .reduce((sum, t) => sum + t.amount, 0);

    // Pending earnings (can be calculated from pending bookings if needed)
    const pendingEarnings = 0; // Placeholder - could be calculated from bookings

    return res.json({
      success: true,
      data: {
        userId: id,
        balance,
        pendingEarnings,
        totalEarnings,
        totalSpent,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("getUserBalance", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
