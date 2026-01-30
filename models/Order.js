// models/Order.js
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userEmail: { type: String, required: true },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  amount: { type: Number, required: true },
  paypalOrderId: { type: String }, // PayPal order ID
  paypalCaptureId: { type: String }, // PayPal capture/transaction ID
  status: {
    type: String,
    enum: ["pending", "paid", "failed", "cancelled"],
    default: "pending",
  },
  receiptUrl: { type: String }, // optional PayPal receipt link
  downloadAccess: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
