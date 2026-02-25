const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");
const adminMiddleware = require("../middleware/admin");

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.patch(
  "/password",
  authMiddleware,
  adminMiddleware,
  authController.changePassword,
);

router.get("/ping", authMiddleware, authController.ping);

module.exports = router;
