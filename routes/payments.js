const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// Still keep the routes so frontend doesn't 404
// But they now return disabled messages
router.post("/create-session", paymentController.createSession);

// Webhook must accept raw body — but logic is disabled
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.webhook,
);

module.exports = router;
