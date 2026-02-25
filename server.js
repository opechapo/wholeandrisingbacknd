const express = require("express");
const connectDB = require("./Config/db");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

console.log("MONGODB_URI:", process.env.MONGODB_URI ? "exists" : "MISSING!");

connectDB();

const app = express();

// IMPORTANT: Apply CORS and other non-body middlewares first
app.use(cors());

// Mount the webhook route with raw parser BEFORE global json (to preserve raw body for signature verification)
const paymentsRoutes = require("./routes/payments");
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  paymentsRoutes.webhookHandler,
);

// NOW apply the global JSON parser for all other routes
app.use(express.json());

// Your other routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/payments", paymentsRoutes); // ← Mount the router for other payment routes (without webhook)

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = "https://wholeandrising.vercel.app/";

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} - Frontend: ${FRONTEND_URL}`);
});
