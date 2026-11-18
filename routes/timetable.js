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
router.get("/", requirePermission("batches.view"), listEntries);
router.post("/", requirePermission("batches.update"), createEntry);
router.patch("/:id", requirePermission("batches.update"), updateEntry);
router.patch("/:id/archive", requirePermission("batches.update"), archiveEntry);

module.exports = router;
