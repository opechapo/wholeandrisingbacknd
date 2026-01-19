const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Signup (optional for students, required for admin)
exports.signup = async (req, res) => {
  const { email, password, role } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User exists" });

    user = new User({ email, password, role });
    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// Subscribe to newsletter
exports.subscribe = async (req, res) => {
  const { id } = req.user; // From auth middleware
  try {
    const user = await User.findById(id);
    user.subscribed = true;
    await user.save();
    res.json({ msg: "Subscribed" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};
