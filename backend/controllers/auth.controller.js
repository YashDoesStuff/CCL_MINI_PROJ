const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Faculty = require("../models/Faculty");

// Helper to generate tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );
  const refreshToken = jwt.sign(
    { id: user._id, role: user.role },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Name, email, and password are required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Email already registered" });
    }

    const user = new User({ name, email, password, role });
    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshToken = refreshToken;
    await user.save();

    // For faculty: try to find existing Faculty profile by name (seeded data)
    // or create a new one. Attach facultyProfileId so frontend can match slots.
    let facultyProfileId = null;
    if (role === "faculty") {
      try {
        const cleanName = user.name.replace(/^(Prof\.|Professor|Dr\.|Dr|Mr\.|Mr|Mrs\.|Mrs|Ms\.|Ms|Sir|Madam|Shri|Smt)\s+/i, '').trim();
        // First try to find seeded faculty by name (case-insensitive)
        let facultyDoc = await Faculty.findOne({
          name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
        if (!facultyDoc) {
          // Create a new Faculty profile linked by clean name
          facultyDoc = await Faculty.create({ name: cleanName, subjects: [] });
        }
        facultyProfileId = facultyDoc._id;
      } catch (facErr) {
        if (facErr.code !== 11000) {
          console.warn("Faculty profile lookup/creation warning:", facErr.message);
        }
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email, role: user.role, facultyProfileId },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshToken = refreshToken;
    await user.save();

    // For faculty: resolve their Faculty model _id (different from User._id)
    let facultyProfileId = null;
    if (user.role === "faculty") {
      try {
        const cleanName = user.name.replace(/^(Prof\.|Professor|Dr\.|Dr|Mr\.|Mr|Mrs\.|Mrs|Ms\.|Ms|Sir|Madam|Shri|Smt)\s+/i, '').trim();
        const facultyDoc = await Faculty.findOne({
          name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        }).lean();
        if (facultyDoc) facultyProfileId = facultyDoc._id;
      } catch (e) {
        console.warn("Faculty profile lookup failed:", e.message);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email, role: user.role, facultyProfileId },
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/refresh
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "Refresh token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res
        .status(401)
        .json({ success: false, message: "Refresh token mismatch or user not found" });
    }

    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    return res.status(200).json({
      success: true,
      data: { accessToken: newAccessToken },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "Refresh token is required" });
    }

    const user = await User.findOne({ refreshToken });
    if (user) {
      user.refreshToken = null;
      await user.save();
    }

    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { register, login, refresh, logout };
