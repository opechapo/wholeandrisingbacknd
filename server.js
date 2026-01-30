const express = require("express");
const connectDB = require("./Config/db");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

console.log("MONGODB_URI:", process.env.MONGODB_URI ? "exists" : "MISSING!");

connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
// app.use("/api/payments", require("./routes/payments"));

// REMOVED: app.use("/uploads", express.static("uploads"));
// No longer needed — ImageKit serves images directly

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = "https://wholeandrising.vercel.app/";

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} - Frontend: ${FRONTEND_URL}`);
});
