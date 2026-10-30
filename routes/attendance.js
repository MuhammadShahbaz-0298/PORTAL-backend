// Routes for attendance. Teachers only see their own batches; students only themselves.

const express = require("express");
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  addAttendance,
  listAttendance,
  updateAttendance,
  getAttendanceSummary,
} = require("../controllers/attendanceController");

const router = express.Router();

router.use(auth);
router.get("/", requirePermission("attendance.view"), listAttendance);
router.get("/:studentId", requirePermission("attendance.view"), getAttendanceSummary);
router.post("/", requirePermission("attendance.manage"), addAttendance);
router.patch("/:id", requirePermission("attendance.manage"), updateAttendance);

module.exports = router;
