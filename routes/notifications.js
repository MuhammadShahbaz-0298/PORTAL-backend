// Routes for notifications. Users only see their own notifications.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { listNotifications, markAsRead } = require("../controllers/notificationController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("notifications.view"), listNotifications);
router.patch("/:id/read", requirePermission("notifications.view"), markAsRead);

module.exports = router;
