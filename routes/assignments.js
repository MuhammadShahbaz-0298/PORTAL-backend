const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const {
  listAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} = require("../controllers/assignmentController");

router.use(auth);
router.get("/", listAssignments);
router.get("/:id", getAssignment);
router.post("/", requireRole("teacher", "admin"), createAssignment);
router.patch("/:id", requireRole("teacher", "admin"), updateAssignment);
router.delete("/:id", requireRole("teacher", "admin"), deleteAssignment);
module.exports = router;
