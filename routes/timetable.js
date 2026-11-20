// HTTP routes for t im et ab le.
// Applies authentication and permissions before controllers run.
// Routes for timetable entries.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  listEntries,
  createEntry,
  updateEntry,
  archiveEntry,
} = require("../controllers/timetableController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("timetable.view"), listEntries);
router.post("/", requirePermission("timetable.manage"), createEntry);
router.patch("/:id", requirePermission("timetable.manage"), updateEntry);
router.patch("/:id/archive", requirePermission("timetable.manage"), archiveEntry);

module.exports = router;
