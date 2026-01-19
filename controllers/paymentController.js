const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../models/Order");
const Product = require("../models/Product");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const nodemailer = require("nodemailer");
const path = require("path");

// Create Stripe session
exports.createSession = async (req, res) => {
  const { productId, email } = req.body;
  try {
    const product = await Product.findById(productId);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: product.title },
            unit_amount: product.price * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      customer_email: email,
      metadata: { productId: product._id.toString() },
    });
    res.json({ id: session.id });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// Webhook handler
exports.webhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const productId = session.metadata.productId;
    const product = await Product.findById(productId);

    const order = new Order({
      userEmail: session.customer_email,
      productId,
      amount: session.amount_total / 100,
      status: "paid",
    });
    await order.save();

    // Generate PDF receipt
    const doc = new PDFDocument();
    const receiptPath = path.join(
      __dirname,
      `../receipts/receipt_${order._id}.pdf`,
    );
    doc.pipe(fs.createWriteStream(receiptPath));
    doc.fontSize(25).text("Receipt", { align: "center" });
    doc.text(`Product: ${product.title}`);
    doc.text(`Amount: £${order.amount}`);
    doc.text(`Date: ${order.createdAt}`);
    doc.end();

    order.receiptUrl = `/receipts/receipt_${order._id}.pdf`;
    await order.save();

    // Send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PASS,
      },
    });
    await transporter.sendMail({
      from: process.env.NODEMAILER_USER,
      to: order.userEmail,
      subject: "Your Receipt from Whole and Rising",
      text: "Attached is your receipt.",
      attachments: [{ filename: "receipt.pdf", path: receiptPath }],
    });

    // If user logged in (check by email), enroll
    const user = await User.findOne({ email: session.customer_email });
    if (user) {
      order.userId = user._id;
      await order.save();
      product.enrollments.push(user._id);
      product.progress.push({ user: user._id, progress: 0 });
      await product.save();
    }
  }

  res.json({ received: true });
};
