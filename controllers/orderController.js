const Order = require("../models/Order");
const Product = require("../models/Product");

// Get orders (admin sees all, student sees own)
exports.getOrders = async (req, res) => {
  try {
    // Safety check (shouldn't be needed after authMiddleware, but good practice)
    if (!req.user) {
      return res.status(401).json({ msg: "Not authenticated" });
    }

    const { role, id } = req.user;

    let orders;
    if (role === "admin") {
      orders = await Order.find()
        .populate("productId", "title price category") // optional: select only needed fields
        .sort({ createdAt: -1 }); // newest first
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

    // Total number of orders
    const totalOrders = await Order.countDocuments();

    // Total enrollments: safely count even if "enrollments" field is missing
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

    // Optional: more useful stats (you can expand later)
    const totalRevenue = await Order.aggregate([
      {
        $match: { status: "paid" }, // only count successful payments
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
      totalRevenue: totalRevenue[0]?.total || 0, // added bonus
      // You can add more metrics here later, e.g. average order value, top products, etc.
    });
  } catch (err) {
    console.error("Analytics error:", err.stack); // better logging with stack
    res.status(500).json({ msg: "Server error in analytics" });
  }
};
