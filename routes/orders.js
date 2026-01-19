const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

// Auth required
router.get("/", orderController.getOrders);
router.get("/analytics", orderController.getAnalytics); // Admin only

module.exports = router;
