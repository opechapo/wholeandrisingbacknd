const Order = require("../models/Order");
const Product = require("../models/Product");
// const User = require("../models/User");   


exports.createSession = async (req, res) => {
  const { productId, email } = req.body;

  return res.status(503).json({
    msg: "Payment processing is temporarily unavailable. Please check back later or contact support.",
    productId,
    email,
  });
};

exports.webhook = async (req, res) => {
  console.log("Webhook received (payments disabled)");
  res.status(200).json({ received: true });
};
