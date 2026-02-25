const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/auth");
const mongoose = require("mongoose"); // ADD THIS - for ObjectId validation
const Order = require("../models/Order"); // ADD THIS - for Order model
const Product = require("../models/Product"); // ADD THIS - for populate ref (optional but safe)

router.get("/", authMiddleware, orderController.getOrders);

router.get(
  "/analytics",
  authMiddleware,
  (req, res, next) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ msg: "Admin access only" });
    }
    next();
  },
  orderController.getAnalytics,
);

// NEW: Get single order by ID (with ownership check)
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const orderId = req.params.id;
    const user = req.user;

    if (!user || !user.id) {
      return res.status(401).json({ msg: "Authentication required" });
    }

    console.log(
      `[GET /orders/:id] Requested order: ${orderId} by user: ${user.id} (${user.role})`,
    );

    // Validate ObjectId format first (prevents cast errors)
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ msg: "Invalid order ID format" });
    }

    const order = await Order.findById(orderId).populate(
      "productId",
      "title description price category pricingModel fileUrl featuredImageUrl overview curriculum",
    );

    if (!order) {
      console.log(`[GET /orders/:id] Order not found: ${orderId}`);
      return res.status(404).json({ msg: "Order not found" });
    }

    // Defensive: ensure userId exists
    if (!order.userId) {
      console.error(`[GET /orders/:id] Order ${orderId} has no userId`);
      return res
        .status(500)
        .json({ msg: "Order data corrupted (missing userId)" });
    }

    const isOwner = order.userId.toString() === user.id.toString();
    if (user.role !== "admin" && !isOwner) {
      console.log(
        `[GET /orders/:id] Unauthorized access attempt: user ${user.id} ≠ order owner ${order.userId}`,
      );
      return res
        .status(403)
        .json({ msg: "Unauthorized: You do not own this order" });
    }

    res.json(order);
  } catch (err) {
    console.error("[GET /orders/:id] Server error:", {
      message: err.message,
      stack: err.stack,
      orderId: req.params.id,
      userId: req.user?.id,
    });
    res.status(500).json({ msg: "Server error fetching order details" });
  }
});

module.exports = router;
