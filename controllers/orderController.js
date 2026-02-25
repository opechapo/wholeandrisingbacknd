const Order = require("../models/Order");
const Product = require("../models/Product");

// Get orders (admin sees all, student sees own)
exports.getOrders = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ msg: "Not authenticated" });
    }

    const { role, id } = req.user;

    let orders;
    if (role === "admin") {
      orders = await Order.find()
        .populate("productId", "title price category") 
        .sort({ createdAt: -1 }); 
    } else {
      orders = await Order.find({ userId: id })
        .populate("productId", "title price category")
        .sort({ createdAt: -1 });
    }

    res.json(orders);
  } catch (err) {
    console.error("Get orders error:", err.stack);
    res.status(500).json({ msg: "Server error fetching orders" });
  }
};

// Analytics (admin only)
exports.getAnalytics = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ msg: "Admin access only" });
    }
    const totalOrders = await Order.countDocuments();
    const enrollments = await Product.aggregate([
      {
        $project: {
          enrollmentsCount: {
            $size: { $ifNull: ["$enrollments", []] }, // ← FIX: safe $size
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$enrollmentsCount" },
        },
      },
    ]);

    const totalRevenue = await Order.aggregate([
      {
        $match: { status: "paid" },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    res.json({
      totalOrders,
      totalEnrollments: enrollments[0]?.total || 0,
      totalRevenue: totalRevenue[0]?.total || 0, 
    });
  } catch (err) {
    console.error("Analytics error:", err.stack);
    res.status(500).json({ msg: "Server error in analytics" });
  }
};
