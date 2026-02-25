const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../models/Order");
const Product = require("../models/Product");
const authMiddleware = require("../middleware/auth");

// ─── CREATE ORDER FOR FREE PRODUCTS ONLY ───────────────────────────────────────
router.post("/create-order", authMiddleware, async (req, res) => {
  const { productId, email } = req.body; // Email optional
  const userId = req.user.id;
  const userEmail = email || req.user.email || "guest@example.com";

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ msg: "Product not found" });

    if (product.pricingModel !== "free") {
      return res
        .status(400)
        .json({ msg: "Use checkout session for paid products" });
    }

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
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ─── CREATE STRIPE CHECKOUT SESSION FOR PAID PRODUCTS ────────────────────────────
router.post("/create-checkout-session", authMiddleware, async (req, res) => {
  const { productId } = req.body;
  const userId = req.user.id;

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ msg: "Product not found" });

    if (product.pricingModel === "free") {
      return res
        .status(400)
        .json({ msg: "Use create-order for free products" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: product.title,
            },
            unit_amount: product.price * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: process.env.STRIPE_SUCCESS_URL,
      cancel_url: process.env.STRIPE_CANCEL_URL,
      client_reference_id: `${userId}|${productId}`,
      customer_email: req.user.email,
    });

    // Create pending order
    const order = new Order({
      userId,
      userEmail: req.user.email || "guest@example.com",
      productId,
      amount: product.price,
      stripeSessionId: session.id,
      status: "pending",
    });
    await order.save();

    // Return session id AND url (critical for frontend redirect)
    res.json({
      id: session.id,
      url: session.url, // ← This is what the frontend needs
    });
  } catch (err) {
    console.error("Create checkout session error:", err);
    res
      .status(500)
      .json({ msg: "Payment initiation failed", error: err.message });
  }
});

// ─── STRIPE WEBHOOK HANDLER (exported for use in server.js with raw parser) ────────────────────────────
const webhookHandler = async (req, res) => {
  console.log("[WEBHOOK] Received request from Stripe");
  console.log("[WEBHOOK] Headers:", JSON.stringify(req.headers, null, 2));
  console.log(
    "[WEBHOOK] Raw body (first 200 chars):",
    req.body.toString().substring(0, 200),
  );

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
    console.log("[WEBHOOK] Event verified successfully");
    console.log("[WEBHOOK] Event ID:", event.id);
    console.log("[WEBHOOK] Event type:", event.type);
  } catch (err) {
    console.error("[WEBHOOK] Signature verification failed:", err.message);
    console.error("[WEBHOOK] Provided signature:", sig);
    console.error(
      "[WEBHOOK] Expected secret:",
      process.env.STRIPE_WEBHOOK_SECRET ? "Set" : "NOT SET!",
    );
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("[WEBHOOK] Session completed");
    console.log("[WEBHOOK] Session ID:", session.id);
    console.log("[WEBHOOK] Payment status:", session.payment_status);
    console.log("[WEBHOOK] Client reference ID:", session.client_reference_id);
    console.log("[WEBHOOK] Customer email:", session.customer_email);

    const [userId, productId] = (session.client_reference_id || "").split("|");

    if (!userId || !productId) {
      console.error(
        "[WEBHOOK] Invalid client_reference_id - cannot split userId|productId",
      );
      return res.json({ received: true }); // Acknowledge but skip processing
    }

    console.log("[WEBHOOK] Parsed userId:", userId);
    console.log("[WEBHOOK] Parsed productId:", productId);

    try {
      const order = await Order.findOne({ stripeSessionId: session.id });
      if (order) {
        console.log("[WEBHOOK] Found matching order ID:", order._id);
        console.log("[WEBHOOK] Current order status:", order.status);

        order.status = "paid";
        order.stripePaymentIntentId = session.payment_intent;
        order.downloadAccess = true;
        order.receiptUrl = `https://dashboard.stripe.com/${process.env.NODE_ENV === "production" ? "" : "test/"}payments/${session.payment_intent}`;

        // Optional: Generate and send invoice
        try {
          const invoice = await stripe.invoices.create({
            customer: session.customer,
            collection_method: "send_invoice",
            days_until_due: 30,
          });
          console.log("[WEBHOOK] Created invoice ID:", invoice.id);

          await stripe.invoiceItems.create({
            customer: session.customer,
            amount: session.amount_total,
            currency: "gbp",
            description: "Your product purchase",
            invoice: invoice.id,
          });
          console.log("[WEBHOOK] Added invoice item");

          const finalizedInvoice = await stripe.invoices.finalizeInvoice(
            invoice.id,
          );
          await stripe.invoices.sendInvoice(invoice.id);

          order.stripeInvoiceId = invoice.id;
          order.receiptUrl = finalizedInvoice.hosted_invoice_url;
          console.log(
            "[WEBHOOK] Finalized and sent invoice - URL:",
            order.receiptUrl,
          );
        } catch (invoiceErr) {
          console.error(
            "[WEBHOOK] Invoice creation failed:",
            invoiceErr.message,
          );
          // Continue without failing webhook
        }

        await order.save();
        console.log("[WEBHOOK] Order successfully updated to 'paid'");
      } else {
        console.error(
          "[WEBHOOK] No matching order found for session ID:",
          session.id,
        );
      }
    } catch (updateErr) {
      console.error("[WEBHOOK] Error updating order:", updateErr.message);
    }
  } else {
    console.log("[WEBHOOK] Ignored event type:", event.type);
  }

  // Always acknowledge the webhook to Stripe
  res.json({ received: true });
};

router.get("/verify-session/:sessionId", authMiddleware, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const order = await Order.findOne({ stripeSessionId: sessionId });

    if (!order || order.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    res.json({
      status: session.payment_status,
      amount: session.amount_total / 100,
      invoiceUrl: order.receiptUrl,
    });
  } catch (err) {
    console.error("Verify session error:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;
module.exports.webhookHandler = webhookHandler;
