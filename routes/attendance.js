const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const {
  addAttendance,
  listAttendance,
  updateAttendance,
  getAttendanceSummary,
} = require("../controllers/attendanceController");

router.use(auth);
router.get("/", listAttendance);
router.get("/:studentId", getAttendanceSummary);
router.post("/", requireRole("admin", "teacher"), addAttendance);
router.patch("/:id", requireRole("admin", "teacher"), updateAttendance);

module.exports = router;
