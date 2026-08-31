const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} = require("../controllers/assignmentController");

router.use(auth);
router.get("/", requirePermission("assignments.view"), listAssignments);
router.get("/:id", requirePermission("assignments.view"), getAssignment);
router.post("/", requirePermission("assignments.create"), createAssignment);
router.patch("/:id", requirePermission("assignments.update"), updateAssignment);
router.delete("/:id", requirePermission("assignments.delete"), deleteAssignment);
module.exports = router;
