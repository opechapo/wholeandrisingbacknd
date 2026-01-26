// routes/orders.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const authMiddleware = require("../middleware/auth"); // ← import

// Protected routes (require valid JWT)
router.get("/", authMiddleware, orderController.getOrders);
router.get("/analytics", authMiddleware, orderController.getAnalytics); // only admin should access later

module.exports = router;
