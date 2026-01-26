// routes/products.js
const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const authMiddleware = require("../middleware/auth");

// Public
router.get("/", productController.getProducts);

// Protected (add product, update progress)
router.post(
  "/",
  authMiddleware,
  upload.single("file"),
  productController.addProduct,
);
router.post("/progress", authMiddleware, productController.updateProgress);

module.exports = router;
