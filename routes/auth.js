// Routes for authentication. Login and refresh are public, everything else needs a session.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  changePassword,
} = require("../controllers/authController");

const router = express.Router();

// Only admins and teachers with students.create may make accounts.
router.post("/register", auth, requirePermission("students.create"), register);
router.post("/login", login);
router.post("/refresh", refresh);

// Logout works from the refresh cookie, so it still works when the access token expired.
router.post("/logout", logout);
router.post("/logout-all", auth, logoutAll);
router.get("/me", auth, getMe);
router.post("/change-password", auth, changePassword);

module.exports = router;
