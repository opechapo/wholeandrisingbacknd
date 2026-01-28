const express = require("express");
const connectDB = require("./Config/db");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/payments", require("./routes/payments"));
app.use("/uploads", express.static("uploads"));
// app.use("/receipts", express.static(path.join(__dirname, "receipts")));

const authMiddleware = (req, res, next) => {
  // Verify JWT from headers
  // req.user = decoded;
  next();
};

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
