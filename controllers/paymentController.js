// controllers/paymentController.js
// Stripe and all payment processing removed for now

const Order = require("../models/Order");
const Product = require("../models/Product");
// const User = require("../models/User");   // uncomment if you need it later

// Temporarily disabled — returns a message so frontend knows payments are not available yet
exports.createSession = async (req, res) => {
  const { productId, email } = req.body;

  return res.status(503).json({
    msg: "Payment processing is temporarily unavailable. Please check back later or contact support.",
    // You can also return product info if frontend needs to show something
    productId,
    email,
  });
};

// Webhook route kept but does nothing useful yet
// (Render/any host still needs to accept POST to /webhook without crashing)
exports.webhook = async (req, res) => {
  // For now just acknowledge the request so it doesn't spam logs with errors
  console.log("Webhook received (payments disabled)");
  res.status(200).json({ received: true });
};
