const User = require('../models/User');

// @desc    Register User
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req,res,next) => {
    try {
        const {
            email, username, password, firstName, lastName,
            birthdate, idCard, phone, gender, interestedGender, type, img
        } = req.body;

        // Basic required checks
        if (!email || !username || !password || !firstName || !lastName || !birthdate || !gender || !interestedGender) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        //Create user
        const user = new User({
            email, username, password, firstName, lastName,
            birthdate, idCard, phone, gender, interestedGender, type, img
        });
        await user.save();

        //Create token
        const token = user.getSignedJwtToken();

        return res.status(201).json({ token, user: user.toJSON() });
    } catch(err) {
        res.status(400).json({success:false, message: err});
        console.log(err.stack);
    }
}


// @desc    Login User
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req,res,next) => {
    try {
        const {email, password} = req.body;

        //Validate email & password
        if(!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Missing Credentials"
            });
        }

        //Check for user
        const user = await User.findOne({email}).select('+password');

        if(!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        //Check if password matches
        const isMatch = await user.matchPassword(password);

        if(!isMatch) {
            return res.status(401).json({
                success:false, 
                message: 'Invalid credentials'
            });
        }

        //Create token
        const token = user.getSignedJwtToken();

        return res.json({success: true, token, user: user.toJSON() });
    } catch(err) {
        return res.status(500).json({success: false, msg: 'Internal Server error'});
    }
}

// @desc    Get current Logged in user
// @route   POST /api/v1/auth/me
// @access  Private

exports.getMe = async (req,res,next) => {
    const user = await User.findById(req.user.id);
    res.status(200).json({
        success: true,
        data: user,
    })
}

// @desc    Generate new token for user
// @route   POST /api/v1/auth/refresh
// @access  Private
exports.refresh = async (req, res) => {
  try {
    // req.user is already populated by auth middleware
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const newToken = user.getSignedJwtToken();

    return res.status(200).json({
      success: true,
      token: newToken,
      user: user.toJSON()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Internal Server error" });
  }
};

