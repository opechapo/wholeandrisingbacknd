const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Signup
exports.signup = async (req, res) => {
  const { email, password, role } = req.body;

  try {
    if (!password) {
      return res.status(400).json({ msg: "Password is required" });
    }
    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ msg: "Password must be at least 6 characters" });
    }

    if (role === "admin") {
      // Admin: only password, no email
      if (email) {
        return res.status(400).json({ msg: "Admin accounts do not use email" });
      }

      // Check if admin already exists (you can limit to one admin)
      const existingAdmin = await User.findOne({ role: "admin" });
      if (existingAdmin) {
        return res.status(400).json({ msg: "Admin account already exists" });
      }

      const admin = new User({ password, role: "admin" });
      await admin.save();

      const token = jwt.sign(
        { id: admin._id, role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
      );
      return res.json({ token, role: "admin" });
    }

    // Student signup
    if (!email) {
      return res.status(400).json({ msg: "Email is required for students" });
    }

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });

    user = new User({ email, password, role: "student" });
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: "student" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    res.json({ token, role: "student" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!password) {
      return res.status(400).json({ msg: "Password is required" });
    }

    let user;

    if (email) {
      // Student login (email + password)
      user = await User.findOne({ email });
    } else {
      // Admin login (only password)
      user = await User.findOne({ role: "admin" });
    }

    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    res.json({ token, role: user.role });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};
