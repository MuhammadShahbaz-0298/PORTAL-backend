// Register authenticated notification routes.
// Each operation requires permission and scopes records to the current user.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  listNotifications,
  markAsRead,
  clearAll,
} = require("../controllers/notificationController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("notifications.view"), listNotifications);
router.delete("/", requirePermission("notifications.view"), clearAll);
router.patch("/:id/read", requirePermission("notifications.view"), markAsRead);

module.exports = router;
