const bcrypt = require('bcrypt');
const User = require('../models/User'); // adjust import if your model exports differently

const SALT_ROUNDS = 10;
const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateOtpString(length = OTP_LENGTH) {
  // produce zero-padded numeric string
  const max = 10 ** length;
  const n = Math.floor(Math.random() * max);
  return String(n).padStart(length, '0');
}

// @desc Generate a new otp for user
// @route POST /api/v1/auth/otp
// @access Private
exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // find user by email
    const user = await User.findOne({email}).select('+otp +otpExpires');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // generate OTP
    const otpPlain = generateOtpString();
    const otpHash = await bcrypt.hash(otpPlain, SALT_ROUNDS);
    const expires = new Date(Date.now() + OTP_TTL_MS);

    user.otp = otpHash;
    user.otpExpires = expires;
    await user.save();

    // TODO: send otpPlain to user.by SMS / email here.
    // For development we return it in the response; remove in production.
    return res.status(200).json({
      success: true,
      message: 'OTP generated and sent (in production, send via SMS/email)',
      otp: otpPlain, // REMOVE this in production!
      expiresAt: expires.toISOString()
    });
  } catch (err) {
    console.error('requestOtp error', err);
    return res.status(500).json({ success: false, message: 'Internal Server error' });
  }
};

// @desc Verify the otp is matched the same exact user
// @route POST /api/v1/auth/verify-otp
// @access Private
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'email and otp required' });
    }

    // include otp fields
    const user = await User.findOne({email}).select('+otp +otpExpires');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({ success: false, message: 'No OTP requested' });
    }

    if (new Date() > user.otpExpires) {
      // clear expired OTP
      user.otp = null;
      user.otpExpires = null;
      await user.save();
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }

    const match = await bcrypt.compare(otp, user.otp);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }

    // OTP valid -> mark verified and clear otp fields
    user.verified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'OTP verified',
      user: user.toJSON ? user.toJSON() : user
    });
  } catch (err) {
    console.error('verifyOtp error', err);
    return res.status(500).json({ success: false, message: 'Internal Server error' });
  }
};
