// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const Order = require('../Models/Order');
// const pdfkit = require('pdfkit');
// const fs = require('fs');
// const nodemailer = require('nodemailer');

// // Create checkout session
// exports.createSession = async (req, res) => {
//   const { productId, email } = req.body;
//   const product = await Product.findById(productId); // Fetch product
//   const session = await stripe.checkout.sessions.create({
//     payment_method_types: ['card'],
//     line_items: [{ price_data: { currency: 'gbp', product_data: { name: product.title }, unit_amount: product.price * 100 }, quantity: 1 }],
//     mode: 'payment',
//     success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
//     cancel_url: `${process.env.FRONTEND_URL}/cancel`,
//     customer_email: email,
//   });
//   res.json({ id: session.id });
// };

// // Webhook for fulfillment
// app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   let event;
//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
//   } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

//   if (event.type === 'checkout.session.completed') {
//     const session = event.data.object;
//     // Find/create order
//     const order = new Order({ userEmail: session.customer_email, productId: /* from metadata */, amount: session.amount_total / 100, status: 'paid' });
//     await order.save();

//     // Generate receipt PDF
//     const doc = new pdfkit();
//     doc.pipe(fs.createWriteStream(`receipt_${order._id}.pdf`));
//     doc.text(`Receipt for ${product.title}\nAmount: £${order.amount}\nDate: ${order.createdAt}`);
//     doc.end();
//     order.receiptUrl = `/receipts/receipt_${order._id}.pdf`; // Serve statically
//     await order.save();

//     // Email receipt to student
//     const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.NODEMAILER_USER, pass: process.env.NODEMAILER_PASS } });
//     await transporter.sendMail({
//       from: process.env.NODEMAILER_USER,
//       to: order.userEmail,
//       subject: 'Your Receipt from Whole and Rising',
//       text: 'Attached is your receipt.',
//       attachments: [{ path: `receipt_${order._id}.pdf` }],
//     });

//     // If logged in, enroll user, update progress, etc.
//     // Notify admin (email or dashboard update)
//   }
//   res.json({ received: true });
// });

const Order = require("../models/Order");
const Product = require("../models/Product");

// Get orders (admin or student)
exports.getOrders = async (req, res) => {
  const { role, id } = req.user;
  try {
    let orders;
    if (role === "admin") {
      orders = await Order.find().populate("productId");
    } else {
      orders = await Order.find({ userId: id }).populate("productId");
    }
    res.json(orders);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};

// Analytics (admin)
exports.getAnalytics = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const enrollments = await Product.aggregate([
      { $project: { enrollmentsCount: { $size: "$enrollments" } } },
      { $group: { _id: null, total: { $sum: "$enrollmentsCount" } } },
    ]);
    // Add more: progress avg, etc.
    res.json({ totalOrders, totalEnrollments: enrollments[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
};
