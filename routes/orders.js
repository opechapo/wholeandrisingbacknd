const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/auth");

// Anyone logged in can see their own orders (or all if admin)
router.get("/", authMiddleware, orderController.getOrders);

// Analytics — admin only
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

module.exports = router;
