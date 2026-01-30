const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const multer = require("multer");
const authMiddleware = require("../middleware/auth");

// IMPORTANT CHANGE: Use MEMORY storage (buffer) instead of disk
const upload = multer({
  storage: multer.memoryStorage(), // ← Files stay in memory → buffer available
  limits: { fileSize: 50 * 1024 * 1024 }, // Optional: 50MB max file size
});

// Public – anyone can see products
router.get("/", productController.getProducts);

// Admin only – protected routes
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

// Optional: progress update route (if still needed)
router.post("/progress", authMiddleware, productController.updateProgress);

module.exports = router;
