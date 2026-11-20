// HTTP routes for a nn ou nc em en ts.
// Applies authentication and permissions before controllers run.
// Routes for announcements. Batch-scoped ownership is checked inside the service.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  archiveAnnouncement,
} = require("../controllers/announcementController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("announcements.view"), listAnnouncements);
router.post("/", requirePermission("announcements.manage"), createAnnouncement);
router.patch("/:id", requirePermission("announcements.manage"), updateAnnouncement);
router.patch("/:id/archive", requirePermission("announcements.manage"), archiveAnnouncement);

module.exports = router;
