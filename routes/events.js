// HTTP routes for e ve nt s.
// Applies authentication and permissions before controllers run.
const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  listEvents,
  createEvent,
  updateEvent,
  archiveEvent,
} = require("../controllers/eventController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("events.view"), listEvents);
router.post("/", requirePermission("events.manage"), createEvent);
router.patch("/:id", requirePermission("events.manage"), updateEvent);
router.patch("/:id/archive", requirePermission("events.manage"), archiveEvent);

module.exports = router;
