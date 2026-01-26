// controllers/orderController.js
const Order = require("../models/Order");
const Product = require("../models/Product");

// Get orders (admin sees all, student sees own)
exports.getOrders = async (req, res) => {
  try {
    // If no user (shouldn't happen after middleware), return unauthorized
    if (!req.user) {
      return res.status(401).json({ msg: "Not authenticated" });
    }

    const { role, id } = req.user;

    let orders;
    if (role === "admin") {
      orders = await Order.find().populate("productId");
    } else {
      orders = await Order.find({ userId: id }).populate("productId");
    }

    res.json(orders);
  } catch (err) {
    console.error("Get orders error:", err.message);
    res.status(500).json({ msg: "Server error fetching orders" });
  }
};

// Analytics (admin only for now)
exports.getAnalytics = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ msg: "Admin access only" });
    }

    const totalOrders = await Order.countDocuments();

    const enrollments = await Product.aggregate([
      { $project: { enrollmentsCount: { $size: "$enrollments" } } },
      { $group: { _id: null, total: { $sum: "$enrollmentsCount" } } },
    ]);

    res.json({
      totalOrders,
      totalEnrollments: enrollments[0]?.total || 0,
    });
  } catch (err) {
    console.error("Analytics error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
};
