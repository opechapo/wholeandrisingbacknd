const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// Public
router.get("/", productController.getProducts);

// Admin protected
router.post("/", upload.single("file"), productController.addProduct); // Add auth middleware
router.post("/progress", productController.updateProgress); // User auth

module.exports = router;
