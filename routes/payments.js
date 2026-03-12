const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../models/Order");
const Product = require("../models/Product");
const authMiddleware = require("../middleware/auth");

// ─── CREATE ORDER FOR FREE PRODUCTS (NOW GUEST-FRIENDLY) ───────────────────────
router.post("/create-order", async (req, res) => {
  const { productId, email } = req.body;

  // Email is now REQUIRED for all claims (guest or logged-in)
  if (!email) {
    return res.status(400).json({
      msg: "Email address is required to claim this free product and receive access instructions.",
    });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ msg: "Product not found" });
    }

    if (product.pricingModel !== "free") {
      return res.status(400).json({
        msg: "This product is not free. Use checkout session for paid products.",
      });
    }

    // Check if this email already claimed it (prevents duplicate claims)
    const existingOrder = await Order.findOne({
      userEmail: email.toLowerCase().trim(),
      productId,
      status: "paid",
    });

    if (existingOrder) {
      return res.json({
        id: existingOrder._id,
        status: "already_accessed",
        msg: "This email has already claimed this product.",
      });
    }

    // Create order – no userId for guests
    const order = new Order({
      // userId: undefined for guests
      userEmail: email.trim(),
      productId,
      amount: 0,
      status: "paid",
      downloadAccess: true,
    });

    await order.save();

    return res.json({
      id: order._id,
      status: "free",
      msg: "Free product claimed successfully! Check your email for access instructions.",
    });
  } catch (err) {
    console.error("Create free order error:", err);
    res.status(500).json({
      msg: "Server error while processing free claim",
      error: err.message,
    });
  }
});

// ─── CREATE STRIPE CHECKOUT SESSION FOR PAID PRODUCTS (GUEST-FRIENDLY) ────────
router.post("/create-checkout-session", async (req, res) => {
  const { productId, email } = req.body;

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ msg: "Product not found" });

    if (product.pricingModel === "free") {
      return res
        .status(400)
        .json({ msg: "Use create-order for free products" });
    }

    if (!email) {
      return res.status(400).json({
        msg: "Email is required for purchase receipt and access",
      });
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
      client_reference_id: `guest_${Date.now().toString(36)}|${productId}`,
      customer_email: email.trim(),
    });

    // IMPROVED: support both logged-in and guest users
    let userId = null;
    if (req.user?.id) {
      userId = new mongoose.Types.ObjectId(req.user.id);
    }

    // Create pending order
    const order = new Order({
      userId, // ← now set only if logged in
      userEmail: email.trim(),
      productId,
      amount: product.price,
      stripeSessionId: session.id,
      status: "pending",
    });

    await order.save();

    res.json({
      id: session.id,
      url: session.url,
    });
  } catch (err) {
    console.error("Create checkout session error:", err);
    res
      .status(500)
      .json({ msg: "Payment initiation failed", error: err.message });
  }
});

// ─── STRIPE WEBHOOK HANDLER ────────────────────────────────────────────────────
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

    const parts = (session.client_reference_id || "").split("|");
    const isGuest = parts[0].startsWith("guest_");
    const productId = parts[1] || parts[0];

    if (!productId) {
      console.error("[WEBHOOK] No productId in client_reference_id");
      return res.json({ received: true });
    }

    try {
      const order = await Order.findOne({ stripeSessionId: session.id });
      if (order) {
        console.log("[WEBHOOK] Found matching order ID:", order._id);
        console.log("[WEBHOOK] Current order status:", order.status);

        order.status = "paid";
        order.stripePaymentIntentId = session.payment_intent;
        order.downloadAccess = true;
        order.receiptUrl = `https://dashboard.stripe.com/${process.env.NODE_ENV === "production" ? "" : "test/"}payments/${session.payment_intent}`;

        // Optional: invoice generation (kept as-is)
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

  res.json({ received: true });
};

router.get("/verify-session/:sessionId", authMiddleware, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const order = await Order.findOne({ stripeSessionId: sessionId });

    if (!order || (order.userId && order.userId.toString() !== req.user.id)) {
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
