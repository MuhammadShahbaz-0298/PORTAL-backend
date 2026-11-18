// Routes for 2FA.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { setup, verify, disable } = require("../controllers/twoFactorController");

const router = express.Router();

router.use(auth);
router.post("/setup", requirePermission("profile.view"), setup);
router.post("/verify", requirePermission("profile.view"), verify);
router.post("/disable", requirePermission("profile.view"), disable);

module.exports = router;
