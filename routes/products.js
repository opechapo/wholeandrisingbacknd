const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const multer = require("multer");
const authMiddleware = require("../middleware/auth");
const Order = require("../models/Order");
const axios = require("axios");
const mongoose = require("mongoose");
const Product = require("../models/Product");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get("/", productController.getProducts);

router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "featuredImage", maxCount: 1 },
  ]),
  productController.addProduct,
);

router.put(
  "/:id",
  authMiddleware,
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "featuredImage", maxCount: 1 },
  ]),
  productController.updateProduct,
);

router.delete("/:id", authMiddleware, productController.deleteProduct);

router.post("/progress", authMiddleware, productController.updateProgress);

// ─── PROTECTED DOWNLOAD ROUTE ───────────────────────────────────────────────
router.get("/:id/download", authMiddleware, async (req, res) => {
  try {
    const productId = req.params.id;
    const user = req.user;

    if (!user || !user.id) {
      console.warn("[DOWNLOAD] Missing user authentication");
      return res.status(401).json({ msg: "Authentication required" });
    }

    console.log(
      `[DOWNLOAD] User ${user.id} (${user.role}) requested download for product ${productId}`,
    );

    // Validate IDs early
    if (
      !mongoose.isValidObjectId(productId) ||
      !mongoose.isValidObjectId(user.id)
    ) {
      console.warn("[DOWNLOAD] Invalid ID format");
      return res.status(400).json({ msg: "Invalid product or user ID format" });
    }

    // 1. Find product
    const product = await Product.findById(productId);
    if (!product) {
      console.log(`[DOWNLOAD] Product not found: ${productId}`);
      return res.status(404).json({ msg: "Product not found" });
    }

    if (!product.fileUrl) {
      console.log(`[DOWNLOAD] No file attached to product: ${productId}`);
      return res
        .status(404)
        .json({ msg: "No downloadable file attached to this product" });
    }

    // 2. Verify ownership & access
    const orderQuery = {
      userId: new mongoose.Types.ObjectId(user.id),
      productId: new mongoose.Types.ObjectId(productId),
      status: "paid",
      downloadAccess: true,
    };

    console.log("[DOWNLOAD] Searching for valid order:", orderQuery);

    const order = await Order.findOne(orderQuery);

    if (!order) {
      console.log(
        `[DOWNLOAD] No valid paid order with download access found for user ${user.id} - product ${productId}`,
      );
      return res.status(403).json({
        msg: "You do not have permission to download this product. Ensure you have completed the purchase/claim.",
      });
    }

    console.log(`[DOWNLOAD] Access granted - Order ID: ${order._id}`);

    // 3. Stream file from ImageKit
    const fileResponse = await axios({
      url: product.fileUrl,
      method: "GET",
      responseType: "stream",
      timeout: 30000, // 30 seconds timeout
    });

    // Prepare filename
    const safeTitle = product.title
      ? product.title.replace(/[^a-z0-9]/gi, "_")
      : "product";
    const fileName = `${safeTitle}.pdf`;

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    // Pipe the stream
    fileResponse.data.pipe(res);
  } catch (err) {
    console.error("[DOWNLOAD] Critical error:", {
      message: err.message,
      code: err.code,
      stack: err.stack?.substring(0, 500),
      productId: req.params.id,
      userId: req.user?.id,
      fileUrl: "unknown",
    });

    if (err.response) {
      console.error(
        "[DOWNLOAD] ImageKit response:",
        err.response.status,
        err.response.statusText,
      );
      return res.status(502).json({ msg: "Failed to fetch file from storage" });
    }

    res
      .status(500)
      .json({ msg: "Failed to process download. Please try again later." });
  }
});

module.exports = router;
