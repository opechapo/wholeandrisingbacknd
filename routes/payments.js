const express = require("express");
const router = express.Router();
const paypal = require("@paypal/checkout-server-sdk");
const Order = require("../models/Order");
const Product = require("../models/Product");
const authMiddleware = require("../middleware/auth");

// PayPal environment setup
const environment =
  process.env.PAYPAL_MODE === "live"
    ? new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET,
      )
    : new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET,
      );

const client = new paypal.core.PayPalHttpClient(environment);

// Create PayPal order
router.post("/create-order", authMiddleware, async (req, res) => {
  const { productId } = req.body;
  const userId = req.user.id;
  const userEmail = req.user.email || "guest@example.com";

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ msg: "Product not found" });

    const amount = product.pricingModel === "free" ? 0 : product.price;

    if (amount === 0) {
      // Free product — instant access
      const existingOrder = await Order.findOne({ userId, productId });
      if (existingOrder) {
        return res.json({ id: existingOrder._id, status: "already_accessed" });
      }

      const order = new Order({
        userId,
        userEmail,
        productId,
        amount: 0,
        status: "paid",
        downloadAccess: true,
      });
      await order.save();
      return res.json({ id: order._id, status: "free" });
    }

    // Paid product — create PayPal order
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "GBP",
            value: amount.toFixed(2),
          },
          description: product.title,
          custom_id: `${userId}|${productId}`,
        },
      ],
      application_context: {
        return_url:
          process.env.PAYPAL_RETURN_URL ||
          "https://wholeandrising.vercel.app/payment/success",
        cancel_url:
          process.env.PAYPAL_CANCEL_URL ||
          "https://wholeandrising.vercel.app/payment/cancel",
      },
    });

    const response = await client.execute(request);
    res.json({ id: response.result.id });
  } catch (err) {
    console.error("PayPal create order error:", err);
    res
      .status(500)
      .json({ msg: "Payment initiation failed", error: err.message });
  }
});

// Capture PayPal payment
router.post("/capture-order", authMiddleware, async (req, res) => {
  const { orderID, productId } = req.body;
  const userId = req.user.id;

  try {
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const capture = await client.execute(request);

    if (capture.result.status !== "COMPLETED") {
      return res.status(400).json({ msg: "Payment not completed" });
    }

    const amount = parseFloat(capture.result.purchase_units[0].amount.value);

    const order = new Order({
      userId,
      userEmail: req.user.email || "guest@example.com",
      productId,
      amount,
      paypalOrderId: orderID,
      paypalCaptureId: capture.result.id,
      status: "paid",
      downloadAccess: true,
      receiptUrl:
        capture.result.links.find((l) => l.rel === "receipt")?.href || "",
    });

    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    console.error("PayPal capture error:", err);
    res.status(500).json({ msg: "Payment capture failed", error: err.message });
  }
});

module.exports = router;
