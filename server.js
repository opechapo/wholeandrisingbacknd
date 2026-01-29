const express = require("express");
const connectDB = require("./Config/db");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

// Debug: log the URI (remove/comment after testing)
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "exists" : "MISSING!");

connectDB(); // ← this should now see the env var

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
// app.use("/api/payments", require("./routes/payments"));

app.use("/uploads", express.static("uploads"));

const PORT = process.env.PORT || 5000; // Render usually injects 10000
const FRONTEND_URL = "https://wholeandrising.vercel.app/";

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ${FRONTEND_URL}`);
});
