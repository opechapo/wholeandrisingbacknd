const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");
const adminMiddleware = require("../middleware/admin");

// ──────────────────────────────────────────────
router.post("/signup", authController.signup);
router.post("/login", authController.login);

// NEW – Change password (only logged-in admin)
router.patch(
  "/password",
  authMiddleware,
  adminMiddleware,
  authController.changePassword,
);

module.exports = router;
